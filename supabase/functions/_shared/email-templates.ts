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
  address: "Vijayawada",
} as const;

export const PLAN_LABELS: Record<string, string> = {
  "1_month": "1 month",
  "6_months": "6 months",
  "12_months": "12 months",
};

export interface Email {
  subject: string;
  text: string;
  html: string;
  attachments?: { filename: string; content: string; contentType: string }[];
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

// ============================================
// Free printed QR kit (table stand + tent card)
// ============================================

export interface PrintAddress {
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string;
}

/** The address as lines, ready to copy onto a parcel. */
export function addressLines(a: PrintAddress): string[] {
  return [
    a.recipient_name,
    a.address_line1,
    ...(a.address_line2 ? [a.address_line2] : []),
    `${a.city}, ${a.state} ${a.pincode}`,
    `Phone: ${a.phone}`,
  ];
}

const qrPageUrl = () => `${SENDER.siteUrl}/dashboard/qr`;

/** To the print partner: what to make and where to send it. Files attached. */
export function printOrderEmail(input: {
  orderRef: string;
  businessName: string;
  address: PrintAddress;
  standFile: string;
  tentCardFile: string;
}): Email {
  return layout({
    subject: `Print order ${input.orderRef}: QR stand and table card for ${input.businessName}`,
    intro: [
      `New print order from ${SENDER.brand}. Please print the two attached files and ship both items to the address below.`,
      `1. ${input.standFile}: insert for an acrylic table stand, 4 × 6 inches (101.6 × 152.4 mm), portrait.`,
      `2. ${input.tentCardFile}: table tent card. Print flat at 105 × 296 mm on 300 gsm card, then fold along the middle (the grey ticks at the edges mark the fold). The top half is upside down on purpose, so both sides read upright once folded.`,
      "Both files are vector SVGs at actual size with a white background. Please keep the QR codes at 100% size and don't add any border or text to them. If Poppins isn't installed, any bold sans-serif font is fine.",
      "Ship to:",
      ...addressLines(input.address),
    ],
    rows: [
      ["Order", input.orderRef],
      ["Business name on the print", input.businessName],
    ],
    outro: [`When it ships, reply with the courier name and tracking number, and mention order ${input.orderRef}.`],
  });
}

/** To the owner, once the order has gone to the printer. */
export function printOrderPlacedEmail(input: { businessName: string; address: PrintAddress }): Email {
  return layout({
    subject: `Your free QR stand and table card for ${input.businessName} are being printed`,
    intro: [
      `Good news: we've sent your free printed QR kit for ${input.businessName} to the printer. It has a QR table stand and a table tent card, both with your business name and your review QR code.`,
      "It will be delivered to:",
      ...addressLines(input.address),
    ],
    button: { label: "Track it in your dashboard", url: qrPageUrl() },
    outro: [
      "We'll email you the tracking number as soon as it ships.",
      "Address wrong? Reply to this email straight away and we'll fix it before it ships.",
    ],
  });
}

/** To the owner: paid, but we don't know where to send the kit yet. */
export function printAddressNeededEmail(input: { businessName: string }): Email {
  return layout({
    subject: `Where should we send your free QR stand for ${input.businessName}?`,
    intro: [
      `Thanks for your payment. Your plan includes a free printed QR kit for ${input.businessName}: a QR table stand and a table tent card with your business name and review QR code.`,
      "Add your delivery address and we'll send it to the printer straight away.",
    ],
    button: { label: "Add delivery address", url: qrPageUrl() },
  });
}

/** To the owner, when the kit ships. */
export function printShippedEmail(input: {
  businessName: string;
  courier: string;
  trackingNumber: string;
  address: PrintAddress;
}): Email {
  return layout({
    subject: `Your QR stand and table card for ${input.businessName} have shipped`,
    intro: [`Your free printed QR kit for ${input.businessName} is on its way.`],
    rows: [
      ["Courier", input.courier],
      ["Tracking number", input.trackingNumber],
    ],
    button: { label: "See it in your dashboard", url: qrPageUrl() },
    outro: ["Delivering to:", ...addressLines(input.address)],
  });
}
