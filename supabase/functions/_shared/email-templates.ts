// Owner emails: payment receipts, AutoPay renewal notices, failed-payment
// notices, and plan-ending reminders. Pure functions with no imports, so the
// tests can render them with plain Node. Sending lives in email.ts.
//
// These business details must match src/config/legal.ts and src/config/plans.ts
// (the Edge Functions cannot import the web app's config);
// tests/project-integrity.test.mjs checks that they do.

export const SENDER = {
  brand: "Reviyo",
  legalName: "Naga Durga Prasad Chunduru, trading as Reviyo",
  supportEmail: "support@reviyo.in",
  siteUrl: "https://www.reviyo.in",
  /** Registered address, printed on receipts. Empty until it is filled in. */
  address: "",
} as const;

export const PLAN_LABELS: Record<string, string> = {
  "6_months": "6 months",
  "12_months": "12 months",
};

export interface Email {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** ₹1,999 from 199900 paise. */
export const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0 })}`;

/** 29 September 2026, in Indian time. */
export const longDate = (iso: string | Date) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

const planLabel = (plan: string) => PLAN_LABELS[plan] ?? plan;

/** One layout for every email: plain paragraphs, an optional table and button, the footer. */
function layout(opts: {
  subject: string;
  intro: string[];
  rows?: [string, string][];
  button?: { label: string; url: string };
  outro?: string[];
}): Email {
  const { subject, intro, rows = [], button, outro = [] } = opts;
  const footer = [
    `${SENDER.brand} · ${SENDER.siteUrl.replace(/^https:\/\//, "")}`,
    `${SENDER.legalName}${SENDER.address ? `, ${SENDER.address}` : ""}`,
    `Questions? Reply to this email or write to ${SENDER.supportEmail}.`,
  ];

  const text = [
    ...intro,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    ...(rows.length ? [""] : []),
    ...(button ? [`${button.label}: ${button.url}`, ""] : []),
    ...outro,
    ...(outro.length ? [""] : []),
    "—",
    ...footer,
  ].join("\n");

  const p = (line: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1f2937">${escapeHtml(line)}</p>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f7f6f2;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px">
<p style="margin:0 0 20px;font-size:20px;font-weight:bold;color:#0e2250">${SENDER.brand}</p>
${intro.map(p).join("\n")}
${rows.length ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:6px 0 18px">${rows
    .map(([label, value]) => `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#4b5563">${escapeHtml(label)}</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;text-align:right;font-weight:bold">${escapeHtml(value)}</td></tr>`)
    .join("")}</table>` : ""}
${button ? `<p style="margin:6px 0 20px"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#0e2250;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 20px;border-radius:8px">${escapeHtml(button.label)}</a></p>` : ""}
${outro.map(p).join("\n")}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0 14px">
${footer.map((line) => `<p style="margin:0 0 4px;font-size:12px;line-height:1.5;color:#6b7280">${escapeHtml(line)}</p>`).join("\n")}
</div></body></html>`;

  return { subject, text, html };
}

const billingUrl = () => `${SENDER.siteUrl}/dashboard/billing`;

export function receiptEmail(input: {
  businessName: string;
  plan: string;
  amountPaise: number;
  paymentId: string;
  orderId: string;
  paidAt: string;
  accessUntil: string | null;
  autopay: boolean;
}): Email {
  return layout({
    subject: `Payment receipt: ${SENDER.brand} ${planLabel(input.plan)} plan for ${input.businessName}`,
    intro: [
      `Thank you. We received your payment for ${input.businessName}.`,
      "This is your payment receipt. Please keep it for your records.",
    ],
    rows: [
      ["Plan", `${SENDER.brand}, ${planLabel(input.plan)}`],
      ["Amount paid", `${rupees(input.amountPaise)} (inclusive of applicable taxes)`],
      ["Paid on", longDate(input.paidAt)],
      ...(input.accessUntil ? ([["Plan active until", longDate(input.accessUntil)]] as [string, string][]) : []),
      ["Payment method", input.autopay ? "AutoPay renewal" : "Razorpay"],
      ["Payment ID", input.paymentId],
      ["Order ID", input.orderId],
    ],
    button: { label: "View billing", url: billingUrl() },
    outro: [
      input.autopay
        ? "Your plan renews automatically until you cancel AutoPay. You will get a notice before each charge."
        : "This plan does not renew automatically. We will remind you before it ends.",
      "Changed your mind? You can get a full refund within 7 days of payment. Just reply to this email.",
    ],
  });
}

export function renewalNoticeEmail(input: {
  businessName: string;
  plan: string;
  amountPaise: number;
  chargeOn: string;
}): Email {
  return layout({
    subject: `Your ${SENDER.brand} plan renews on ${longDate(input.chargeOn)}`,
    intro: [
      `Your ${planLabel(input.plan)} plan for ${input.businessName} renews automatically.`,
      `On or after ${longDate(input.chargeOn)}, ${rupees(input.amountPaise)} will be charged through the AutoPay you set up. Your bank or UPI app will also notify you before the charge.`,
    ],
    rows: [
      ["Plan", `${SENDER.brand}, ${planLabel(input.plan)}`],
      ["Amount", `${rupees(input.amountPaise)} (inclusive of applicable taxes)`],
      ["Charge date", longDate(input.chargeOn)],
    ],
    button: { label: "Manage billing", url: billingUrl() },
    outro: ["Don't want to renew? Cancel AutoPay in Billing before the charge date and you won't be charged."],
  });
}

export function paymentFailedEmail(input: {
  businessName: string;
  plan: string;
  amountPaise: number;
  accessUntil: string | null;
}): Email {
  return layout({
    subject: `Your ${SENDER.brand} renewal payment didn't go through`,
    intro: [
      `We tried to charge ${rupees(input.amountPaise)} for the ${planLabel(input.plan)} plan for ${input.businessName}, but the payment didn't go through.`,
      input.accessUntil
        ? `Your plan stays active until ${longDate(input.accessUntil)}. Please check your UPI app or card, or pay once from Billing, so AI drafting and your dashboard don't pause.`
        : "Please check your UPI app or card, or pay once from Billing, so AI drafting and your dashboard don't pause.",
    ],
    button: { label: "Go to billing", url: billingUrl() },
    outro: ["Your printed QR codes keep sending customers to Google either way."],
  });
}

export function planEndingEmail(input: {
  businessName: string;
  endsOn: string;
  isTrial: boolean;
}): Email {
  const what = input.isTrial ? "free trial" : "plan";
  return layout({
    subject: `Your ${SENDER.brand} ${what} ends on ${longDate(input.endsOn)}`,
    intro: [
      `Your ${what} for ${input.businessName} ends on ${longDate(input.endsOn)}, and AutoPay is not set up, so nothing renews automatically.`,
      "After that, your QR codes still send customers to Google, but AI review drafting, your dashboard, and private feedback pause until you choose a plan.",
    ],
    button: { label: "Choose a plan", url: billingUrl() },
  });
}
