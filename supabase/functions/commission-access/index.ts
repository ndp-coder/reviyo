import { createAdminClient } from "../_shared/autopay.ts";
import { getCorsHeaders, isAllowedBrowserOrigin } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/email.ts";
import { SENDER } from "../_shared/email-templates.ts";
import { razorpayX } from "../_shared/commissions.ts";

function invitationEmailReady(): boolean {
  return Deno.env.get("AUTH_EMAIL_INVITATIONS_ENABLED") === "true" || !!Deno.env.get("SMTP_PASSWORD");
}

async function sendInvitation(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  email: string,
  path: string,
  build: (url: string) => { subject: string; text: string; html: string },
) {
  const redirectTo = `${SENDER.siteUrl}${path}`;
  if (Deno.env.get("AUTH_EMAIL_INVITATIONS_ENABLED") === "true") {
    // Reuse the configured Auth SMTP transport; the mailbox password does not
    // need to be copied into Edge secrets. Auth sends the link to its owner.
    const invitation = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (invitation.error?.code === "email_exists" || invitation.error?.code === "user_already_exists") {
      const returning = await admin.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } });
      if (returning.error) throw new Error("Could not send invitation");
    } else if (invitation.error) throw new Error("Could not send invitation");
    return;
  }
  let link = await admin.auth.admin.generateLink({ type: "invite", email, options: { redirectTo } });
  if (link.error?.code === "email_exists" || link.error?.code === "user_already_exists") {
    link = await admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
  }
  if (link.error || !link.data.properties?.action_link) throw new Error("Could not create invitation");
  await sendEmail(email, build(link.data.properties.action_link));
}

Deno.serve(async (req: Request) => {
  const headers = { ...getCorsHeaders(req), "Content-Type": "application/json" };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!isAllowedBrowserOrigin(req)) return json({ error: "Origin not allowed" }, 403);
  try {
    const admin = await createAdminClient();
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user || !user.email_confirmed_at) return json({ error: "Sign in with a verified email" }, 401);
    const body = await req.json();
    if (body.action === "invite" || body.action === "access" || body.action === "setup") {
      const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin") return json({ error: "Developer access required" }, 403);
      if (body.action === "setup") return json({
        emailReady: invitationEmailReady(),
        payoutsReady: !!Deno.env.get("RAZORPAYX_KEY_ID") && !!Deno.env.get("RAZORPAYX_KEY_SECRET") && !!Deno.env.get("RAZORPAYX_ACCOUNT_NUMBER"),
        enabled: Deno.env.get("COMMISSION_PAYOUTS_ENABLED") === "true",
        schedulerReady: (Deno.env.get("COMMISSION_CRON_SECRET") ?? "").length >= 32,
      });
      if (body.action === "access") {
        if (typeof body.active !== "boolean" || typeof body.id !== "string") return json({ error: "Invalid access change" }, 400);
        const { error } = await admin.from("commission_partners").update({ active: body.active }).eq("id", body.id);
        if (error) throw error;
        return json({ ok: true });
      }
      const email = String(body.email ?? "").trim().toLowerCase();
      const name = String(body.name ?? "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || name.length < 2 || name.length > 100) return json({ error: "Enter a name and valid email" }, 400);
      if (!invitationEmailReady()) return json({ error: "Invitation email is not configured" }, 503);
      // Existing rows retain their access state. Resending never unrevokes one.
      const { error: insertError } = await admin.from("commission_partners").upsert({ email, name, invited_by: user.id }, { onConflict: "email", ignoreDuplicates: true });
      if (insertError) throw insertError;
      const { data: partner } = await admin.from("commission_partners").select("active").eq("email", email).single();
      if (!partner?.active) return json({ error: "Restore partner access before sending another invitation" }, 400);
      await sendInvitation(admin, email, "/partners", (url) => {
      const escaped = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
      return {
        subject: "Your private Reviyo partner invitation",
        text: `You have been invited to the private Reviyo partner dashboard. Sign in: ${url}\nRegister referrals before their first payment. Earn Rs 1,000 after a Rs 2,999 annual payment has been unrefunded for 14 days, plus Rs 2,000 at every 10 qualifying owners. Add your bank details in the dashboard for automatic payouts.`,
        html: `<p>You have been invited to the private Reviyo partner dashboard.</p><p><a href="${escaped}">Accept invitation</a></p><p>Register referrals before their first payment. Earn ₹1,000 after a ₹2,999 annual payment has been unrefunded for 14 days, plus ₹2,000 at every 10 qualifying owners. Add your bank details in the dashboard for automatic payouts.</p>`,
      };
      });
      const { error: sentError } = await admin.from("commission_partners").update({ invitation_sent_at: new Date().toISOString() }).eq("email", email);
      if (sentError) throw sentError;
      return json({ ok: true });
    }
    if (body.action === "invite-owner") {
      const { data: partner } = await admin.from("commission_partners").select("id").eq("email", user.email!.toLowerCase()).eq("active", true).maybeSingle();
      if (!partner) return json({ error: "Invitation required" }, 403);
      if (!invitationEmailReady()) return json({ error: "Invitation email is not configured. Your saved setup is safe; resend once email is configured." }, 503);
      const { data: draft } = await admin.from("partner_business_drafts").select("id,referral_id,claimed_at,invitation_sent_at").eq("id", String(body.id ?? "")).maybeSingle();
      if (!draft || draft.claimed_at) return json({ error: "Pending business setup not found" }, 404);
      const { data: referral } = await admin.from("commission_referrals").select("email").eq("id", draft.referral_id).eq("partner_id", partner.id).maybeSingle();
      if (!referral) return json({ error: "Pending business setup not found" }, 404);
      if (draft.invitation_sent_at && Date.now() - Date.parse(draft.invitation_sent_at) < 60000) return json({ error: "Wait a minute before resending" }, 429);
      await sendInvitation(admin, referral.email, "/onboarding", (url) => {
      const escaped = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
      return { subject: "Review your Reviyo business setup", text: `A Reviyo partner has prepared your business setup. Review and edit the details, accept the terms, then choose your plan: ${url}`, html: `<p>A Reviyo partner has prepared your business setup.</p><p><a href="${escaped}">Review your business details</a></p><p>You can edit the details before accepting the terms and choosing your plan.</p>` };
      });
      const { error } = await admin.from("partner_business_drafts").update({ invitation_sent_at: new Date().toISOString() }).eq("id", draft.id);
      if (error) throw error;
      return json({ ok: true });
    }
    if (body.action === "bank") {
      if (body.consent !== true) return json({ error: "Authorise RazorpayX to receive your bank details first" }, 400);
      const { data: partner } = await admin.from("commission_partners").select("id,name,email,fund_account_id,contact_id")
        .eq("email", user.email!.toLowerCase()).eq("active", true).maybeSingle();
      if (!partner) return json({ error: "Invitation required" }, 403);
      if (partner.fund_account_id) return json({ error: "Bank details are already registered. Contact the developer to change them." }, 409);
      const name = String(body.name ?? "").trim();
      const account = String(body.account ?? "").trim();
      const ifsc = String(body.ifsc ?? "").trim().toUpperCase();
      if (name.length < 2 || name.length > 100 || !/^\d{9,18}$/.test(account) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return json({ error: "Enter valid account holder, account number and IFSC" }, 400);
      const contact = partner.contact_id ? { id: partner.contact_id } : await razorpayX("contacts", { name: partner.name, email: partner.email, type: "vendor", reference_id: partner.id });
      if (typeof contact.id !== "string" || !contact.id.startsWith("cont_")) throw new Error("Contact registration failed");
      const { error: contactError } = await admin.from("commission_partners").update({ contact_id: contact.id }).eq("id", partner.id).eq("active", true).is("fund_account_id", null);
      if (contactError) throw contactError;
      const fund = await razorpayX("fund_accounts", { contact_id: contact.id, account_type: "bank_account", bank_account: { name, ifsc, account_number: account } });
      if (typeof fund.id !== "string" || !fund.id.startsWith("fa_") || fund.contact_id !== contact.id) throw new Error("Bank registration failed");
      const { data: saved, error: saveError } = await admin.from("commission_partners").update({ fund_account_id: fund.id, bank_last4: account.slice(-4), bank_setup_at: new Date().toISOString() })
        .eq("id", partner.id).eq("active", true).is("fund_account_id", null).select("id");
      if (saveError) throw saveError;
      if (!saved?.length) return json({ error: "Access or bank details changed. Refresh the page." }, 409);
      return json({ ok: true });
    }
    return json({ error: "Unknown action" }, 400);
  } catch {
    return json({ error: "Could not complete this request. Check the configuration or try again." }, 500);
  }
});
