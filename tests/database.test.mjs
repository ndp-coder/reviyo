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
const PARTNER = '33333333-3333-3333-3333-333333333333';
const SETUP_OWNER = '77777777-7777-7777-7777-777777777777';
before(async () => {
await db.exec(`INSERT INTO auth.users (id, email) VALUES ('${U1}', 'a@x.in'), ('${U2}', 'b@x.in');`);
// handle_new_user may insert profiles via trigger; make sure they exist.
await db.exec(`INSERT INTO profiles (id, email) VALUES ('${U1}','a@x.in'), ('${U2}','b@x.in') ON CONFLICT DO NOTHING;`);
});

check('partner business setup preserves ownership, consent and referral attribution', async () => {
  await db.exec(`INSERT INTO auth.users(id,email) VALUES('${SETUP_OWNER}','setup-owner@example.in');`);
  await db.exec(`INSERT INTO auth.users(id,email) VALUES('${PARTNER}','setup-partner@example.in') ON CONFLICT DO NOTHING;`);
  await db.exec(`INSERT INTO commission_partners(email,name) SELECT lower(email),'Setup partner' FROM auth.users WHERE id='${PARTNER}' ON CONFLICT(email) DO UPDATE SET active=true;`);
  const args = ['setup-owner@example.in','Prepared salon','Salon',null,null,['Staff','Service']];
  const sql = `SELECT save_partner_business_draft($1,$2,$3,$4,$5,$6) AS id`;
  const draft = (await asUser(PARTNER, () => one(sql,args))).id;
  assert.equal((await asUser(PARTNER, () => one(sql,args))).id,draft,'retry updates same draft');
  assert.equal((await asUser(PARTNER,()=>one(`SELECT count(*)::int AS n FROM partner_business_drafts`))).n,1);
  assert.equal((await asUser(U1,()=>one(`SELECT count(*)::int AS n FROM partner_business_drafts`))).n,0);
  await asUser(PARTNER,()=>rejects(sql,[...args.slice(0,3),'https://evil.example/review',null,args[5]],/Google review link/,'invalid Google link'));
  await asUser(PARTNER,()=>rejects(sql,[...args.slice(0,4),'data:image/svg+xml;base64,PHN2Zz4=',args[5]],/supported logo/,'unsafe logo'));
  assert.equal((await one(`SELECT count(*)::int AS n FROM businesses WHERE owner_id=$1`,[SETUP_OWNER])).n,0,'partner does not create owner business');
  assert.equal((await asUser(SETUP_OWNER,()=>one(`SELECT my_partner_business_draft() AS d`))).d.id,draft);
  const claim = `SELECT claim_partner_business($1,$2,'Owner edited salon','owner-edited-salon','Salon',NULL,NULL,'Welcome',ARRAY['Staff']) AS b`;
  await asUser(U1,()=>rejects(claim,[draft,'v1'],/No pending setup/,'wrong owner'));
  await asUser(SETUP_OWNER,()=>rejects(claim,[draft,null],/Accept the terms/,'missing consent'));
  await asUser(SETUP_OWNER,()=>rejects(`UPDATE partner_business_drafts SET claimed_at=now() WHERE id=$1`,[draft],/permission denied/,'no client draft writes'));
  const biz=(await asUser(SETUP_OWNER,()=>one(claim,[draft,'owner-terms-v1']))).b;
  assert.equal(biz.owner_id,SETUP_OWNER);
  assert.equal(biz.name,'Owner edited salon');
  assert.equal(biz.trial_eligible,false,'partner-prepared businesses require a paid plan');
  await asUser(SETUP_OWNER,()=>rejects(`UPDATE businesses SET trial_eligible=true WHERE id=$1`,[biz.id],/permission denied/,'owner cannot restore trial eligibility'));
  await db.query(`INSERT INTO autopay_mandates(business_id,user_id,plan,amount,method,razorpay_customer_id,auth_order_id,consent_version)
    VALUES($1,$2,'12_months',299900,'upi','customer_partner','setup-owner-auth','v1')`,[biz.id,SETUP_OWNER]);
  const authorization=(await one(`SELECT start_autopay_trial('setup-owner-auth','setup-owner-auth-payment','setup-owner-token') AS r`)).r;
  assert.equal(authorization.trial_started,false,'even a verified authorisation cannot start a partner trial');
  assert.equal(authorization.subscription,null);
  assert.equal((await one(`SELECT start_autopay_trial('setup-owner-auth','setup-owner-auth-payment','setup-owner-token') AS r`)).r.trial_started,false,'retry stays ineligible');
  assert.equal((await one(`SELECT business_has_active_subscription($1) AS ok`,[biz.id])).ok,false,'authorisation does not unlock AI features');
  await rejects(`INSERT INTO subscriptions(business_id,plan,status,starts_at,expires_at) VALUES($1,'12_months','trial',now(),now()+interval '14 days')`,[biz.id],/requires a paid plan/,'all other trial creation paths are blocked');
  assert.equal((await one(`SELECT terms_consent_version FROM profiles WHERE id=$1`,[SETUP_OWNER])).terms_consent_version,'owner-terms-v1');
  assert.equal((await asUser(SETUP_OWNER,()=>one(`SELECT my_partner_business_draft() AS d`))).d,null);
  await asUser(SETUP_OWNER,()=>rejects(claim,[draft,'v1'],/No pending setup/,'duplicate claim'));
  await asUser(PARTNER,()=>rejects(sql,args,/already has a business/,'partner cannot overwrite claimed setup'));
  assert.equal((await asUser(PARTNER,()=>one(`SELECT count(*)::int AS n FROM businesses WHERE id=$1`,[biz.id]))).n,0,'partner cannot access owner business');
  await db.query(`INSERT INTO payment_orders(business_id,user_id,order_id,plan,amount) VALUES($1,$2,'setup-owner-annual','12_months',299900)`,[biz.id,SETUP_OWNER]);
  await one(`SELECT process_paid_order('setup-owner-annual','setup-owner-capture') AS r`);
  assert.equal((await one(`SELECT status FROM subscriptions WHERE business_id=$1`,[biz.id])).status,'active','verified full payment activates partner business');
  assert.ok((await one(`SELECT order_id FROM commission_referrals WHERE email='setup-owner@example.in'`)).order_id,'owner payment links automatically');
  // Keep the later commission scenarios independent.
  await db.exec(`DELETE FROM partner_business_drafts WHERE id='${draft}'; DELETE FROM commission_referrals WHERE email='setup-owner@example.in'; DELETE FROM payment_orders WHERE order_id='setup-owner-annual'; DELETE FROM businesses WHERE id='${biz.id}'; DELETE FROM auth.users WHERE id='${SETUP_OWNER}'; DELETE FROM commission_partners WHERE email='setup-partner@example.in'; DELETE FROM auth.users WHERE id='${PARTNER}';`);
});

check('bypassing the invitation claim still cannot get a partner-prepared trial',async()=>{
  const owner='88888888-8888-8888-8888-888888888888';
  await db.exec(`INSERT INTO auth.users(id,email) VALUES('${owner}','bypass-owner@example.in'),('${PARTNER}','bypass-partner@example.in');
    INSERT INTO commission_partners(email,name) VALUES('bypass-partner@example.in','Partner');`);
  const draft=(await asUser(PARTNER,()=>one(`SELECT save_partner_business_draft('bypass-owner@example.in','Prepared shop','retail_store',NULL,NULL,ARRAY['Service']) AS id`))).id;
  const biz=(await asUser(owner,()=>one(`SELECT create_business_with_defaults('Direct shop','direct-shop','retail_store',NULL,NULL,NULL,ARRAY['Service']) AS b`))).b;
  assert.equal(biz.trial_eligible,false,'eligibility follows the prepared setup even through the ordinary RPC');
  await rejects(`UPDATE businesses SET trial_eligible=true WHERE id=$1`,[biz.id],/managed automatically/,'eligibility remains fixed');
  await db.exec(`DELETE FROM partner_business_drafts WHERE id='${draft}'; DELETE FROM commission_referrals WHERE email='bypass-owner@example.in';`);
  assert.equal((await one(`SELECT trial_eligible FROM businesses WHERE id=$1`,[biz.id])).trial_eligible,false,'deleting a referral does not restore trial eligibility');
  await db.exec(`DELETE FROM businesses WHERE id='${biz.id}'; DELETE FROM auth.users WHERE id='${owner}'; DELETE FROM commission_partners WHERE email='bypass-partner@example.in'; DELETE FROM auth.users WHERE id='${PARTNER}';`);
});

// --- scenarios ---------------------------------------------------------------
let B;
check('onboarding creates a business with NO subscription', async () => {
  const biz = await asUser(U1, () =>
    one(`SELECT create_business_with_defaults('Pet Spa','pet-spa','Pet grooming',NULL,NULL,NULL,ARRAY['Staff','Hygiene']) AS b`));
  B = biz.b.id;
  assert.equal(biz.b.trial_eligible,true,'ordinary signup still has its existing trial eligibility');
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

check('the email log is server-only and lets each email be claimed once', async () => {
  for (const role of ['anon', 'authenticated']) {
    for (const priv of ['SELECT', 'INSERT', 'DELETE']) {
      const r = await one(`SELECT has_table_privilege($1, 'public.email_log', $2) AS ok`, [role, priv]);
      assert.equal(r.ok, false, `${role} has ${priv} on email_log`);
    }
  }
  const claim = () => q(`INSERT INTO email_log (kind, ref, business_id) VALUES ('receipt', 'order_x', $1) ON CONFLICT DO NOTHING RETURNING kind`, [B]);
  assert.equal((await claim()).length, 1, 'first claim wins');
  assert.equal((await claim()).length, 0, 'second claim is refused');
  await rejects(`INSERT INTO email_log (kind, ref) VALUES ('newsletter', 'x')`, [], /email_log_kind_check/, 'unknown kind');
});

check('website visit counts hold no personal data, skip private pages, and only admins read them', async () => {
  // Counts only: no column could hold an IP, cookie, user, or device identifier.
  const cols = (await q(`SELECT column_name FROM information_schema.columns WHERE table_name = 'site_page_views' ORDER BY column_name`)).map((r) => r.column_name);
  assert.deepEqual(cols, ['day', 'path', 'referrer_host', 'views']);
  for (const role of ['anon', 'authenticated']) {
    for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      const r = await one(`SELECT has_table_privilege($1, 'public.site_page_views', $2) AS ok`, [role, priv]);
      assert.equal(r.ok, false, `${role} has ${priv} on site_page_views`);
    }
  }

  const view = (path, ref = '') => asAnon(() => q(`SELECT record_site_page_view($1, $2)`, [path, ref]));
  await view('/pricing', 'www.Google.com');
  await view('/pricing/', 'google.com');
  await view('/pricing', 'reviyo.in'); // our own site counts as direct
  await view('/', '');
  // Never counted: customer review pages, the app, junk.
  for (const path of ['/r/pet-spa', '/dashboard', '/dashboard/billing', '/admin', '/onboarding', '/<script>', 'pricing']) {
    await view(path, 'google.com');
  }
  const rows = await q(`SELECT path, referrer_host, views FROM site_page_views ORDER BY path, referrer_host`);
  assert.deepEqual(rows, [
    { path: '/', referrer_host: '', views: 1 },
    { path: '/pricing', referrer_host: '', views: 1 },
    { path: '/pricing', referrer_host: 'google.com', views: 2 },
  ]);

  // Owners cannot read it; admins get the summary.
  await asUser(U2, () => rejects(`SELECT site_traffic_summary(30)`, [], /Admins only/, 'owner reads traffic'));
  await asAnon(() => rejects(`SELECT site_traffic_summary(30)`, [], /permission denied/, 'anon reads traffic'));
  await db.exec(`UPDATE profiles SET role = 'admin' WHERE id = '${U2}'`);
  try {
    const summary = (await asUser(U2, () => one(`SELECT site_traffic_summary(7) AS s`))).s;
    assert.equal(summary.today, 4);
    assert.equal(summary.last_7_days, 4);
    assert.equal(summary.by_day.length, 7);
    assert.deepEqual(summary.top_pages[0], { path: '/pricing', views: 3 });
    assert.deepEqual(summary.top_sources.map((s) => s.source).sort(), ['', 'google.com']);
  } finally {
    await db.exec(`UPDATE profiles SET role = 'user' WHERE id = '${U2}'`);
  }
});

let partnerId;
const commissionFixtures = [];
check('only invited partners register referrals; ownership and money cannot be forged', async () => {
  await db.exec(`INSERT INTO auth.users(id,email) VALUES('${PARTNER}','partner@example.in');`);
  partnerId = (await one(`INSERT INTO commission_partners(email,name) VALUES('partner@example.in','Partner') RETURNING id`)).id;
  await asUser(U1, () => rejects(`SELECT register_commission_referral('nobody@example.in')`, [], /Invitation required/, 'ordinary owner'));
  await asUser(PARTNER, () => rejects(`SELECT register_commission_referral('PARTNER@example.in')`, [], /refer yourself/, 'self referral'));
  await asUser(PARTNER, () => rejects(`SELECT register_commission_referral('bad email')`, [], /valid email/, 'bad email'));
  const id = (await asUser(PARTNER, () => one(`SELECT register_commission_referral(' NewOwner@example.in ') AS id`))).id;
  assert.equal((await one(`SELECT email FROM commission_referrals WHERE id=$1`, [id])).email, 'newowner@example.in');
  await asUser(PARTNER, () => rejects(`SELECT register_commission_referral('newowner@EXAMPLE.in')`, [], /already been referred/, 'case-insensitive duplicate'));
  for (const uid of [U1, PARTNER]) {
    await asUser(uid, () => rejects(`UPDATE commission_partners SET active=true`, [], /permission denied/, 'access forgery'));
    await asUser(uid, () => rejects(`INSERT INTO commission_earnings(partner_id,kind,amount,milestone) VALUES($1,'bonus',200000,10)`, [partnerId], /permission denied/, 'earning forgery'));
    await asUser(uid, () => rejects(`SELECT qualify_commission($1,$1)`, [id], /permission denied/, 'qualification forgery'));
    await asUser(uid, () => rejects(`SELECT prepare_commission_payout($1,'source')`, [id], /permission denied/, 'payout forgery'));
  }
  assert.equal((await asUser(U1, () => one(`SELECT count(*)::int AS n FROM commission_referrals`))).n, 0);
  assert.equal((await asUser(PARTNER, () => one(`SELECT count(*)::int AS n FROM commission_referrals`))).n, 1);
  await asAnon(() => rejects(`SELECT * FROM commission_partners`, [], /permission denied/, 'anonymous partner enumeration'));
});

check('first annual payment is linked, but a capture verified less than 14 days ago cannot qualify', async () => {
  for (let i = 1; i <= 21; i++) {
    const uid = `44444444-4444-4444-4444-${String(i).padStart(12, '0')}`;
    const email = `commission${i}@example.in`;
    await db.query(`INSERT INTO auth.users(id,email) VALUES($1,$2)`, [uid,email]);
    const referral = (await one(`INSERT INTO commission_referrals(partner_id,email,created_at) VALUES($1,$2,now()-interval '20 days') RETURNING id`, [partnerId,email])).id;
    const biz = (await one(`INSERT INTO businesses(owner_id,name,slug,category) VALUES($1,'Referral business',$2,'Cafe') RETURNING id`, [uid,`commission-${i}`])).id;
    const order = (await one(`INSERT INTO payment_orders(business_id,user_id,order_id,plan,amount) VALUES($1,$2,$3,'12_months',$4) RETURNING id`, [biz,uid,`commission-order-${i}`,i === 21 ? 199900 : 299900])).id;
    await db.query(`UPDATE payment_orders SET status='paid',payment_id=$2 WHERE id=$1`, [order,`commission-payment-${i}`]);
    commissionFixtures.push({ referral, order, uid, biz });
  }
  const f = commissionFixtures[0];
  assert.equal((await one(`SELECT order_id FROM commission_referrals WHERE id=$1`,[f.referral])).order_id, f.order);
  assert.equal((await one(`SELECT order_id FROM commission_referrals WHERE id=$1`,[commissionFixtures[20].referral])).order_id, null);
  await db.query(`UPDATE commission_referrals SET capture_verified_at=now()-interval '13 days' WHERE id=$1`,[f.referral]);
  assert.equal((await one(`SELECT qualify_commission($1,$2) AS ok`,[f.referral,f.order])).ok,false);
  await asUser(PARTNER, () => rejects(`SELECT register_commission_referral('commission1@example.in')`, [], /already paid/, 'paid owner'));
});

check('20 qualifying owners earn exactly 20 commissions and bonuses at 10 and 20; retries do not duplicate money', async () => {
  for (const f of commissionFixtures.slice(0,20)) {
    await db.query(`UPDATE commission_referrals SET capture_verified_at=now()-interval '15 days' WHERE id=$1`,[f.referral]);
    assert.equal((await one(`SELECT qualify_commission($1,$2) AS ok`,[f.referral,f.order])).ok,true);
    assert.equal((await one(`SELECT qualify_commission($1,$2) AS ok`,[f.referral,f.order])).ok,false);
  }
  assert.deepEqual((await q(`SELECT milestone FROM commission_earnings WHERE kind='bonus' ORDER BY milestone`)).map(r=>r.milestone),[10,20]);
  const total = await one(`SELECT count(*)::int AS n,sum(amount)::int AS amount FROM commission_earnings WHERE partner_id=$1`,[partnerId]);
  assert.deepEqual(total,{n:22,amount:2400000});
  // Renewal is never another referral, even with a fresh annual payment.
  const f=commissionFixtures[0];
  await db.query(`INSERT INTO payment_orders(business_id,user_id,order_id,plan,amount) VALUES($1,$2,'commission-renewal','12_months',299900)`,[f.biz,f.uid]);
  await db.exec(`UPDATE payment_orders SET status='paid',payment_id='commission-renewal-payment' WHERE order_id='commission-renewal'`);
  assert.equal((await one(`SELECT count(*)::int AS n FROM commission_earnings WHERE partner_id=$1`,[partnerId])).n,22);
});

let earningId;
check('payout preparation waits for bank setup and freezes its exact payload across repeated attempts', async () => {
  earningId=(await one(`SELECT id FROM commission_earnings WHERE partner_id=$1 ORDER BY id LIMIT 1`,[partnerId])).id;
  assert.equal((await one(`SELECT prepare_commission_payout($1,'source-one') AS body`,[earningId])).body,null);
  await db.query(`UPDATE commission_partners SET fund_account_id='fa_first',bank_last4='1234' WHERE id=$1`,[partnerId]);
  const body=(await one(`SELECT prepare_commission_payout($1,'source-one') AS body`,[earningId])).body;
  assert.equal(body.fund_account_id,'fa_first');
  assert.equal(body.reference_id,earningId);
  await db.query(`UPDATE commission_partners SET fund_account_id='fa_changed' WHERE id=$1`,[partnerId]);
  assert.deepEqual((await one(`SELECT prepare_commission_payout($1,'source-two') AS body`,[earningId])).body,body);
  await db.query(`UPDATE commission_earnings SET first_attempt_at=now()-interval '7 days' WHERE id=$1`,[earningId]);
  assert.equal((await one(`SELECT prepare_commission_payout($1,'source-two') AS body`,[earningId])).body,null);
  assert.equal((await one(`SELECT status FROM commission_earnings WHERE id=$1`,[earningId])).status,'needs_attention');
});

check('revoking a partner removes private access and pauses new transfers', async () => {
  const other=(await one(`SELECT id FROM commission_earnings WHERE partner_id=$1 AND status='pending' LIMIT 1`,[partnerId])).id;
  await db.query(`UPDATE commission_partners SET active=false WHERE id=$1`,[partnerId]);
  assert.equal((await asUser(PARTNER, () => one(`SELECT count(*)::int AS n FROM commission_earnings`))).n,0);
  await asUser(PARTNER, () => rejects(`SELECT register_commission_referral('new2@example.in')`,[],/Invitation required/,'revoked registration'));
  assert.equal((await one(`SELECT prepare_commission_payout($1,'source') AS body`,[other])).body,null);
  await db.exec(`UPDATE profiles SET role='admin' WHERE id='${U2}'`);
  try { assert.equal((await asUser(U2,()=>one(`SELECT count(*)::int AS n FROM commission_earnings`))).n,22); }
  finally { await db.exec(`UPDATE profiles SET role='user' WHERE id='${U2}'`); }
});

check('developer controls require admin access, record every change and reject stale actions', async () => {
  const sql=`SELECT developer_set_business_access($1,$2,$3,$4)`;
  await asUser(U1,()=>rejects(sql,[B,false,true,'Investigating issue'],/Developer access required/,'owner cannot pause via developer function'));
  await asUser(U1,()=>rejects(`SELECT developer_summary()`,[],/Developer access required/,'owner cannot see system totals'));
  await db.exec(`SET ROLE anon`);
  try { await rejects(`SELECT developer_summary()`,[],/permission denied/,'anonymous summary'); }
  finally { await db.exec(`RESET ROLE`); }
  await db.exec(`UPDATE profiles SET role='admin' WHERE id='${U2}'`);
  try {
    await asUser(U2,()=>rejects(sql,[B,false,true,''],/Enter a reason/,'reason required'));
    await asUser(U2,()=>one(sql,[B,false,true,'Investigating support request']));
    assert.equal((await one(`SELECT is_active FROM businesses WHERE id=$1`,[B])).is_active,false);
    const audit=await one(`SELECT * FROM developer_activity WHERE business_id=$1`,[B]);
    assert.equal(audit.actor_id,U2); assert.equal(audit.action,'pause_business');
    await asUser(U2,()=>rejects(sql,[B,true,true,'Restore from stale screen'],/access changed/,'stale status rejected'));
    await asUser(U2,()=>one(sql,[B,false,false,'Already paused, no change']));
    assert.equal((await one(`SELECT count(*)::int AS n FROM developer_activity`)).n,1,'no duplicate activity for no-op');
    assert.equal((await asUser(U1,()=>one(`SELECT count(*)::int AS n FROM developer_activity`))).n,0);
    await asUser(U2,()=>rejects(`DELETE FROM developer_activity`,[],/permission denied/,'audit cannot be altered in browser'));
    const before=(await asUser(U2,()=>one(`SELECT developer_summary() AS s`))).s;
    await db.query(`INSERT INTO payment_orders(business_id,user_id,order_id,plan,amount) VALUES($1,$2,'dev-summary-order','6_months',199900)`,[B,U1]);
    await db.exec(`UPDATE payment_orders SET status='paid',payment_id='dev-summary-payment' WHERE order_id='dev-summary-order'`);
    const after=(await asUser(U2,()=>one(`SELECT developer_summary() AS s`))).s;
    assert.equal(after.paidTotal-before.paidTotal,199900);
    assert.equal(after.paid30Days-before.paid30Days,199900);
    await asUser(U2,()=>one(sql,[B,true,false,'Support investigation complete']));
    assert.equal((await one(`SELECT is_active FROM businesses WHERE id=$1`,[B])).is_active,true);
    assert.equal((await one(`SELECT count(*)::int AS n FROM developer_activity`)).n,2);
  } finally { await db.exec(`UPDATE profiles SET role='user' WHERE id='${U2}'`); }
});

check('developer directory paginates, searches literally and does not expose payment secrets', async () => {
  await asUser(U1,()=>rejects(`SELECT developer_businesses()`,[],/Developer access required/,'owner directory access'));
  await asUser(PARTNER,()=>rejects(`SELECT developer_operations()`,[],/Developer access required/,'partner payment access'));
  await db.exec(`UPDATE profiles SET role='admin' WHERE id='${U2}'`);
  try {
    const first=(await asUser(U2,()=>one(`SELECT developer_businesses('commission','all',0) AS d`))).d;
    const next=(await asUser(U2,()=>one(`SELECT developer_businesses('commission','all',20) AS d`))).d;
    assert.equal(first.total,21); assert.equal(first.rows.length,20); assert.equal(next.rows.length,1);
    assert.equal(new Set([...first.rows,...next.rows].map(b=>b.id)).size,21);
    assert.equal((await asUser(U2,()=>one(`SELECT developer_businesses('%','all',0) AS d`))).d.total,0,'wildcards treated literally');
    await asUser(U2,()=>rejects(`SELECT developer_businesses('','unknown',0)`,[],/Invalid search/,'bad filter'));
    const row=first.rows[0];
    await asUser(U2,()=>one(`SELECT developer_set_business_access($1,false,true,'Directory filter test')`,[row.id]));
    const paused=(await asUser(U2,()=>one(`SELECT developer_businesses('commission','paused',0) AS d`))).d;
    assert.equal(paused.total,1); assert.equal(paused.rows[0].id,row.id);
    await asUser(U2,()=>one(`SELECT developer_set_business_access($1,true,false,'Directory test complete')`,[row.id]));
    const operations=(await asUser(U2,()=>one(`SELECT developer_operations() AS d`))).d;
    assert.ok(operations.payments.length>0 && operations.payments.length<=50);
    assert.ok(operations.activity.length>=4);
    assert.ok(!JSON.stringify(operations).includes('token_id'));
    assert.ok(!JSON.stringify(operations).includes('razorpay_customer_id'));
  } finally { await db.exec(`UPDATE profiles SET role='user' WHERE id='${U2}'`); }
});

check('monthly trial, ₹500 charges and month-end renewals are idempotent and never earn commission or bonuses', async () => {
  const uid = '88888888-8888-8888-8888-888888888888';
  const email = 'monthly-owner@example.in';
  await db.query(`INSERT INTO auth.users(id,email) VALUES($1,$2)`, [uid,email]);
  const monthlyPartner = (await one(`INSERT INTO commission_partners(email,name) VALUES('monthly-partner@example.in','Monthly test partner') RETURNING id`)).id;
  const referral = (await one(`INSERT INTO commission_referrals(partner_id,email,created_at) VALUES($1,$2,now()-interval '20 days') RETURNING id`, [monthlyPartner,email])).id;
  const biz = (await one(`INSERT INTO businesses(owner_id,name,slug,category) VALUES($1,'Monthly salon','monthly-salon','Salon') RETURNING id`, [uid])).id;
  const mandate = (await one(`INSERT INTO autopay_mandates(business_id,user_id,plan,amount,method,razorpay_customer_id,auth_order_id,consent_version)
    VALUES($1,$2,'1_month',50000,'upi','cust_monthly','monthly-auth','monthly-v1') RETURNING id`, [biz,uid])).id;
  const trial = (await one(`SELECT start_autopay_trial('monthly-auth','monthly-auth-payment','monthly-token') AS r`)).r;
  assert.equal(trial.trial_started,true);
  assert.equal(trial.subscription.plan,'1_month');
  assert.equal((await one(`SELECT round(extract(epoch FROM expires_at-now())/86400)::int AS days FROM subscriptions WHERE business_id=$1`, [biz])).days,14);
  await db.query(`UPDATE subscriptions SET expires_at=now()+interval '2 days' WHERE business_id=$1`, [biz]);
  const due = await one(`SELECT plan,amount FROM autopay_mandates_due_for_charge() WHERE mandate_id=$1`, [mandate]);
  assert.deepEqual(due,{plan:'1_month',amount:50000});

  // A calendar month from January 31 ends on February 28, not March 2.
  await db.query(`UPDATE subscriptions SET expires_at='2027-01-31T12:00:00Z' WHERE business_id=$1`, [biz]);
  const firstOrder = (await one(`INSERT INTO payment_orders(business_id,user_id,order_id,plan,amount,kind,mandate_id)
    VALUES($1,$2,'monthly-charge-1','1_month',50000,'autopay',$3) RETURNING id`, [biz,uid,mandate])).id;
  const paid = (await one(`SELECT settle_autopay_charge('monthly-charge-1','monthly-payment-1',true) AS r`)).r;
  assert.equal(Date.parse(paid.subscription.expires_at),Date.parse('2027-02-28T12:00:00Z'));
  assert.equal(paid.subscription.status,'active');
  const retry = (await one(`SELECT settle_autopay_charge('monthly-charge-1','monthly-payment-1',true) AS r`)).r;
  assert.equal(retry.already_processed,true);
  assert.equal(Date.parse(retry.subscription.expires_at),Date.parse(paid.subscription.expires_at));
  await rejects(`SELECT process_paid_order('monthly-charge-1','another-monthly-payment')`,[],/different payment/,'monthly duplicate payment');
  assert.equal((await one(`SELECT order_id FROM commission_referrals WHERE id=$1`,[referral])).order_id,null);
  // Even an incorrectly linked referral cannot turn a monthly charge into an earning.
  await db.query(`UPDATE commission_referrals SET order_id=$2,capture_verified_at=now()-interval '15 days' WHERE id=$1`, [referral,firstOrder]);
  assert.equal((await one(`SELECT qualify_commission($1,$2) AS ok`,[referral,firstOrder])).ok,false);
  for(let i=1;i<=9;i++) {
    const nextUid=`99999999-9999-9999-9999-${String(i).padStart(12,'0')}`;
    const nextEmail=`monthly${i}@example.in`;
    await db.query(`INSERT INTO auth.users(id,email) VALUES($1,$2)`,[nextUid,nextEmail]);
    await db.query(`INSERT INTO commission_referrals(partner_id,email,created_at) VALUES($1,$2,now()-interval '20 days')`,[monthlyPartner,nextEmail]);
    const nextBiz=(await one(`INSERT INTO businesses(owner_id,name,slug,category) VALUES($1,'Monthly business',$2,'Salon') RETURNING id`,[nextUid,`monthly-${i}`])).id;
    await db.query(`INSERT INTO payment_orders(business_id,user_id,order_id,plan,amount) VALUES($1,$2,$3,'1_month',50000)`,[nextBiz,nextUid,`monthly-once-${i}`]);
    await one(`SELECT process_paid_order($1,$2)`,[`monthly-once-${i}`,`monthly-once-payment-${i}`]);
  }
  assert.equal((await one(`SELECT count(*)::int AS n FROM commission_earnings WHERE partner_id=$1`,[monthlyPartner])).n,0,'ten monthly customers earn neither commission nor bonus');
  assert.equal((await one(`SELECT count(*)::int AS n FROM commission_candidates() WHERE referral_id=$1`,[referral])).n,0);
  await asUser(uid,()=>rejects(`SELECT activate_or_renew_subscription($1,'1_month','forged')`,[biz],/permission denied/,'monthly activation is server-only'));
});
