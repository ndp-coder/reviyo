// Runs every migration in PGlite (real Postgres compiled to WebAssembly) with
// Supabase-like roles and default grants, then exercises the money paths:
// the AutoPay trial, charges, retries, and who may call what.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test, before } from 'node:test';

const MIG = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));
const db = new PGlite();

before(async () => {
// --- Supabase-like environment ---------------------------------------------
await db.exec(`
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
  GRANT anon, authenticated, service_role TO postgres;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('app.uid', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  -- What Supabase does: direct grants to each API role on everything new.
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
`);

for (const file of readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort()) {
  try {
    await db.exec(readFileSync(`${MIG}/${file}`, 'utf8'));
  } catch (err) {
    throw new Error(`Migration ${file} failed: ${err.message}`);
  }
}

});

// --- helpers -----------------------------------------------------------------
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];
const rejects = async (sql, params, pattern, label) => {
  try {
    await db.query(sql, params);
  } catch (err) {
    assert.match(err.message, pattern, `${label}: wrong error ${err.message}`);
    return;
  }
  assert.fail(`${label}: expected an error`);
};
// Scenarios build on each other, so they run in order within one test file.
const check = (label, fn) => test(label, fn);
const asUser = async (uid, fn) => {
  await db.exec(`SET app.uid = '${uid}'; SET ROLE authenticated;`);
  try { return await fn(); } finally { await db.exec(`RESET ROLE; SET app.uid = '';`); }
};

const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
before(async () => {
await db.exec(`INSERT INTO auth.users (id, email) VALUES ('${U1}', 'a@x.in'), ('${U2}', 'b@x.in');`);
// handle_new_user may insert profiles via trigger; make sure they exist.
await db.exec(`INSERT INTO profiles (id, email) VALUES ('${U1}','a@x.in'), ('${U2}','b@x.in') ON CONFLICT DO NOTHING;`);
});

// --- scenarios ---------------------------------------------------------------
let B;
check('onboarding creates a business with NO subscription', async () => {
  const biz = await asUser(U1, () =>
    one(`SELECT create_business_with_defaults('Pet Spa','pet-spa','Pet grooming',NULL,NULL,NULL,ARRAY['Staff','Hygiene']) AS b`));
  B = biz.b.id;
  assert.equal((await one(`SELECT count(*)::int AS n FROM subscriptions WHERE business_id=$1`, [B])).n, 0);
  assert.equal((await one(`SELECT business_has_active_subscription($1) AS ok`, [B])).ok, false);
});

const newMandate = async (order, plan = '12_months') =>
  (await one(`INSERT INTO autopay_mandates (business_id,user_id,plan,amount,method,razorpay_customer_id,auth_order_id,consent_version)
              VALUES ($1,$2,$3,$4,'upi','cust_1',$5,'v1') RETURNING id`,
    [B, U1, plan, plan === '12_months' ? 299900 : 199900, order])).id;

let M1;
check('₹1 authorisation starts exactly one 14-day trial', async () => {
  M1 = await newMandate('order_auth_1');
  const r = await one(`SELECT start_autopay_trial('order_auth_1','pay_auth_1','token_1') AS r`);
  assert.equal(r.r.trial_started, true);
  const s = await one(`SELECT status, plan, round(extract(epoch FROM expires_at - now())/86400) AS days FROM subscriptions WHERE business_id=$1`, [B]);
  assert.equal(s.status, 'trial'); assert.equal(s.plan, '12_months'); assert.equal(Number(s.days), 14);
  assert.equal((await one(`SELECT business_has_active_subscription($1) AS ok`, [B])).ok, true);
  assert.equal((await one(`SELECT status FROM autopay_mandates WHERE id=$1`, [M1])).status, 'authorized');
});

check('browser + webhook confirming the same payment is harmless', async () => {
  const r = await one(`SELECT start_autopay_trial('order_auth_1','pay_auth_1','token_1') AS r`);
  assert.equal(r.r.trial_started, false);
  assert.equal((await one(`SELECT count(*)::int AS n FROM subscriptions WHERE business_id=$1`, [B])).n, 1);
});

check('a different payment for the same setup is refused', async () => {
  await rejects(`SELECT start_autopay_trial('order_auth_1','pay_OTHER','token_1')`, [], /different payment/, 'mismatch');
});

check('a second live mandate for the business is refused (and gets no trial)', async () => {
  await newMandate('order_auth_2');
  await rejects(`SELECT start_autopay_trial('order_auth_2','pay_auth_2','token_2')`, [], /already set up/, 'dup');
});

check('nothing is due while the trial has more than 3 days left', async () => {
  assert.equal((await q(`SELECT * FROM autopay_mandates_due_for_charge()`)).length, 0);
});

let trialEnd;
check('mandate becomes due 3 days before the trial ends', async () => {
  await db.exec(`UPDATE subscriptions SET expires_at = now() + interval '2 days' WHERE business_id='${B}'`);
  trialEnd = (await one(`SELECT expires_at FROM subscriptions WHERE business_id=$1`, [B])).expires_at;
  const due = await q(`SELECT * FROM autopay_mandates_due_for_charge()`);
  assert.equal(due.length, 1); assert.equal(due[0].amount, 299900); assert.equal(due[0].token_id, 'token_1');
});

const addCharge = (order) => db.query(
  `INSERT INTO payment_orders (business_id,user_id,order_id,plan,amount,status,kind,mandate_id,charge_after)
   VALUES ($1,$2,$3,'12_months',299900,'created','autopay',$4, now())`, [B, U1, order, M1]);

check('only one charge can be in flight per mandate (no double charging)', async () => {
  await addCharge('order_c1');
  assert.equal((await q(`SELECT * FROM autopay_mandates_due_for_charge()`)).length, 0);
  await rejects(`INSERT INTO payment_orders (business_id,order_id,plan,amount,status,kind,mandate_id)
                 VALUES ($1,'order_c1_dup','12_months',299900,'created','autopay',$2)`, [B, M1], /duplicate key|unique/, 'inflight');
});

check('successful charge: term starts at trial end, 12 months long', async () => {
  await db.exec(`UPDATE payment_orders SET status='attempted' WHERE order_id='order_c1'`);
  await q(`SELECT settle_autopay_charge('order_c1','pay_c1',true)`);
  const s = await one(`SELECT status, starts_at, expires_at FROM subscriptions WHERE business_id=$1`, [B]);
  assert.equal(s.status, 'active');
  assert.equal(new Date(s.starts_at).getTime(), new Date(trialEnd).getTime());
  const expected = await one(`SELECT ($1::timestamptz + interval '12 months') AS e`, [trialEnd]);
  assert.equal(new Date(s.expires_at).getTime(), new Date(expected.e).getTime());
  const m = await one(`SELECT status, failed_attempts FROM autopay_mandates WHERE id=$1`, [M1]);
  assert.equal(m.status, 'active'); assert.equal(m.failed_attempts, 0);
});

check('a duplicate success webhook does not extend twice', async () => {
  const before = (await one(`SELECT expires_at FROM subscriptions WHERE business_id=$1`, [B])).expires_at;
  await q(`SELECT settle_autopay_charge('order_c1','pay_c1',true)`);
  const after = (await one(`SELECT expires_at FROM subscriptions WHERE business_id=$1`, [B])).expires_at;
  assert.equal(new Date(after).getTime(), new Date(before).getTime());
});

check('a failure is counted once even if reported twice', async () => {
  await db.exec(`UPDATE subscriptions SET expires_at = now() + interval '1 day' WHERE business_id='${B}'`);
  await addCharge('order_c2');
  await q(`SELECT settle_autopay_charge('order_c2',NULL,false)`);
  await q(`SELECT settle_autopay_charge('order_c2','pay_x',false)`);
  assert.equal((await one(`SELECT failed_attempts FROM autopay_mandates WHERE id=$1`, [M1])).failed_attempts, 1);
  assert.equal((await one(`SELECT status FROM payment_orders WHERE order_id='order_c2'`)).status, 'failed');
});

check('money captured after a reported failure is still honoured', async () => {
  const before = (await one(`SELECT expires_at FROM subscriptions WHERE business_id=$1`, [B])).expires_at;
  await q(`SELECT settle_autopay_charge('order_c2','pay_late',true)`);
  const after = (await one(`SELECT expires_at FROM subscriptions WHERE business_id=$1`, [B])).expires_at;
  assert.ok(new Date(after) > new Date(before));
  assert.equal((await one(`SELECT status, payment_id FROM payment_orders WHERE order_id='order_c2'`)).status, 'paid');
  assert.equal((await one(`SELECT failed_attempts FROM autopay_mandates WHERE id=$1`, [M1])).failed_attempts, 0);
});

check('three failures in a row stop AutoPay', async () => {
  for (const o of ['order_f1', 'order_f2', 'order_f3']) {
    await addCharge(o);
    await q(`SELECT settle_autopay_charge($1,NULL,false)`, [o]);
  }
  const m = await one(`SELECT status, failed_attempts FROM autopay_mandates WHERE id=$1`, [M1]);
  assert.equal(m.failed_attempts, 3); assert.equal(m.status, 'failed');
  await db.exec(`UPDATE subscriptions SET expires_at = now() + interval '1 day' WHERE business_id='${B}'`);
  assert.equal((await q(`SELECT * FROM autopay_mandates_due_for_charge()`)).length, 0);
});

check('a new setup after failure works but gives no second trial', async () => {
  await db.exec(`DELETE FROM autopay_mandates WHERE auth_order_id='order_auth_2'`);
  await newMandate('order_auth_3', '6_months');
  const r = await one(`SELECT start_autopay_trial('order_auth_3','pay_auth_3','token_3') AS r`);
  assert.equal(r.r.trial_started, false);
  const due = await q(`SELECT * FROM autopay_mandates_due_for_charge()`);
  assert.equal(due.length, 1); assert.equal(due[0].amount, 199900);
});

check('old failed mandate is not revived over the new one by a late capture', async () => {
  await db.exec(`UPDATE payment_orders SET status='failed' WHERE order_id='order_f3'`);
  await q(`SELECT settle_autopay_charge('order_f3','pay_f3_late',true)`);
  assert.equal((await one(`SELECT status FROM autopay_mandates WHERE id=$1`, [M1])).status, 'failed');
  assert.equal((await one(`SELECT count(*)::int AS n FROM autopay_mandates WHERE business_id=$1 AND status IN ('authorized','active','paused')`, [B])).n, 1);
});

check('browsers (anon/authenticated) cannot call any money function', async () => {
  for (const fn of [
    'start_autopay_trial(text,text,text)', 'settle_autopay_charge(text,text,boolean)',
    'autopay_mandates_due_for_charge()', 'process_paid_order(text,text)',
    'activate_or_renew_subscription(uuid,text,text)', 'claim_topic_suggestion(uuid)',
    'purge_expired_personal_data(int,int,int)', 'preserve_financial_records_for_erasure(uuid)',
  ]) {
    for (const role of ['anon', 'authenticated']) {
      const r = await one(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS ok`, [role, `public.${fn}`]);
      assert.equal(r.ok, false, `${role} can execute ${fn}`);
    }
    assert.equal((await one(`SELECT has_function_privilege('service_role', $1, 'EXECUTE') AS ok`, [`public.${fn}`])).ok, true, `service_role cannot execute ${fn}`);
  }
});

check('owners see only their own mandates, and cannot write them', async () => {
  const mine = await asUser(U1, () => q(`SELECT id FROM autopay_mandates`));
  assert.ok(mine.length >= 1);
  const theirs = await asUser(U2, () => q(`SELECT id FROM autopay_mandates`));
  assert.equal(theirs.length, 0);
  // Browsers have no write privilege on the table at all (and no RLS write
  // policy), so the write is refused outright rather than matching no rows.
  await asUser(U1, async () => {
    await assert.rejects(
      db.query(`UPDATE autopay_mandates SET status='active' WHERE business_id=$1 RETURNING id`, [B]),
      /permission denied/,
    );
  });
});

check('an expired business cannot start new QR review sessions', async () => {
  await db.exec(`UPDATE subscriptions SET expires_at = now() - interval '1 day' WHERE business_id='${B}'`);
  await rejects(`SELECT * FROM create_review_session('pet-spa')`, [], /Business not found/, 'qr');
});

check('an expired business\'s printed QR code still leads to its Google review page, and nothing more', async () => {
  const lapsed = () => asAnon(() => q(`SELECT * FROM get_lapsed_business_review_link('pet-spa')`));
  const sessions = async () => (await one(`SELECT count(*)::int AS n FROM review_sessions WHERE business_id = $1`, [B])).n;

  // No Google link saved: nothing to send the customer to.
  assert.equal((await lapsed()).length, 0);

  await db.exec(`UPDATE businesses SET google_review_url = 'https://g.page/r/pet-spa/review' WHERE id = '${B}'`);
  const before = await sessions();
  const rows = await lapsed();
  assert.equal(rows.length, 1);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['business_google_review_url', 'business_logo_url', 'business_name']);
  assert.equal(rows[0].business_google_review_url, 'https://g.page/r/pet-spa/review');
  assert.equal(await sessions(), before, 'no review session is created');

  // A business with a live plan uses the full review flow instead.
  await db.exec(`UPDATE subscriptions SET expires_at = now() + interval '1 day' WHERE business_id = '${B}'`);
  assert.equal((await lapsed()).length, 0);
  await db.exec(`UPDATE subscriptions SET expires_at = now() - interval '1 day' WHERE business_id = '${B}'`);

  // A deactivated business gets nothing.
  await db.exec(`UPDATE businesses SET is_active = false WHERE id = '${B}'`);
  assert.equal((await lapsed()).length, 0);
  await db.exec(`UPDATE businesses SET is_active = true WHERE id = '${B}'`);
});

check('topic-suggestion rate limit: 10 per hour', async () => {
  for (let i = 0; i < 10; i += 1) assert.equal((await one(`SELECT claim_topic_suggestion($1) AS ok`, [U1])).ok, true);
  assert.equal((await one(`SELECT claim_topic_suggestion($1) AS ok`, [U1])).ok, false);
});

// --- owner write permissions and public review-page limits --------------------
const asAnon = async (fn) => {
  await db.exec(`SET ROLE anon;`);
  try { return await fn(); } finally { await db.exec(`RESET ROLE;`); }
};
const deniedFor = async (run, sql, params, label) =>
  run(() => assert.rejects(db.query(sql, params), /permission denied/, label));

check('owners edit only their profile fields, never slug, rows, or customer data', async () => {
  await db.exec(`UPDATE subscriptions SET expires_at = now() + interval '30 days', status = 'active' WHERE business_id='${B}'`);
  const user = (fn) => asUser(U1, fn);

  const renamed = await user(() => q(`UPDATE businesses SET name = 'Pet Spa & Salon' WHERE id = $1 RETURNING name`, [B]));
  assert.equal(renamed[0].name, 'Pet Spa & Salon');

  await deniedFor(user, `UPDATE businesses SET slug = 'stolen' WHERE id = $1`, [B], 'slug change');
  await deniedFor(user, `UPDATE businesses SET is_active = false WHERE id = $1`, [B], 'deactivate');
  await deniedFor(user, `DELETE FROM businesses WHERE id = $1`, [B], 'direct delete');
  await deniedFor(user, `INSERT INTO businesses (owner_id, name, slug, category) VALUES ($1, 'X', 'x-biz', 'Other')`, [U1], 'direct insert');
  await deniedFor(user, `UPDATE review_sessions SET rating = 5 WHERE business_id = $1`, [B], 'rewrite ratings');
  await deniedFor(user, `UPDATE profiles SET email = 'other@x.in' WHERE id = $1`, [U1], 'profile email');

  await user(() => q(`UPDATE profiles SET full_name = 'Asha' WHERE id = $1`, [U1]));
  await rejects(`UPDATE businesses SET name = repeat('n', 201) WHERE id = $1`, [B], /businesses_name_length/, 'name length');
  await rejects(`UPDATE businesses SET logo_url = 'data:image/png;base64,' || repeat('A', 600000) WHERE id = $1`, [B], /businesses_logo_url_size/, 'logo size');
});

let T;
check('the public review page is limited: session required, one scan per visit, capped events and messages', async () => {
  const session = await asAnon(() => one(`SELECT session_token FROM create_review_session('pet-spa')`));
  T = session.session_token;
  const track = (token, type, meta = '{}') =>
    asAnon(() => q(`SELECT track_event('pet-spa', $1, $2, $3::jsonb)`, [token, type, meta]));

  await assert.rejects(track(null, 'qr_page_view'), /Session not found/, 'event without a session');
  await track(T, 'qr_page_view');
  await track(T, 'qr_page_view');
  const views = await one(`SELECT count(*)::int AS n FROM analytics_events e JOIN review_sessions s ON s.id = e.review_session_id WHERE s.session_token = $1 AND e.event_type = 'qr_page_view'`, [T]);
  assert.equal(views.n, 1, 'a repeated page view counts once');

  await assert.rejects(track(T, 'review_copied', JSON.stringify({ pad: 'x'.repeat(5000) })), /Invalid event metadata/, 'oversized metadata');
  for (let i = 0; i < 99; i += 1) await track(T, 'review_copied');
  await assert.rejects(track(T, 'review_copied'), /Too many events/, 'event cap');

  const send = () => asAnon(() => q(`SELECT submit_private_feedback($1, 'Parking was hard to find', 3, 'v1')`, [T]));
  await send(); await send(); await send();
  await assert.rejects(send(), /Too many messages/, 'feedback cap');

  await assert.rejects(
    asAnon(() => q(`SELECT update_review_session($1, NULL, repeat('c', 2001))`, [T])),
    /Comment too long/,
    'comment length',
  );
});

check('owners can change feedback status but not the customer\'s words', async () => {
  const user = (fn) => asUser(U1, fn);
  const updated = await user(() => q(`UPDATE private_feedback SET status = 'seen' WHERE business_id = $1 RETURNING status`, [B]));
  assert.ok(updated.length >= 1 && updated.every((r) => r.status === 'seen'));
  await deniedFor(user, `UPDATE private_feedback SET message = 'edited' WHERE business_id = $1`, [B], 'edit message');
  await deniedFor(user, `DELETE FROM private_feedback WHERE business_id = $1`, [B], 'delete feedback');
});
