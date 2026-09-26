/**
 * Legal, regulatory, and business-identity configuration.
 *
 * Every value marked TODO_ must be replaced with your real, verifiable details
 * before the site goes live. They are rendered publicly on the Contact,
 * Privacy, Terms, Refund, and Cookie pages, and several of them are hard
 * requirements:
 *
 *  - Razorpay merchant activation requires a published business name, address,
 *    contact email/phone, Terms, Privacy Policy, and Refund/Cancellation Policy.
 *  - The Consumer Protection (E-Commerce) Rules, 2020 require an e-commerce
 *    entity to publish its legal name, registered address, and customer-care
 *    contact details.
 *  - The Digital Personal Data Protection Act, 2023 requires a published
 *    contact for the Data Protection Officer or the person able to answer
 *    questions about personal data processing (s.5(1)(c), s.8(9)).
 *
 * `npm test` fails while any TODO_ placeholder is still present, by design.
 */

export const legal = {
  /** Registered legal name of the entity that operates Reviyo. */
  legalName: 'Naga Durga Prasad Chunduru, trading as Reviyo',
  /** e.g. 'Sole Proprietorship', 'Private Limited Company', 'LLP'. */
  entityType: 'sole proprietorship',
  /** Full registered / principal place of business address, including PIN code. */
  address: 'TODO_REGISTERED_ADDRESS',
  /** Country of the registered address. */
  country: 'India',

  /** General support mailbox. Monitored during the stated support hours. */
  supportEmail: 'TODO_SUPPORT_EMAIL',
  /** Customer-care phone number in international format. */
  supportPhone: '+91 95811 68889',
  /** Stated support hours, shown to customers so response times are honest. */
  supportHours: 'Monday to Friday, 10:00–18:00 IST (excluding public holidays)',
  /** Target first-response time. Keep this a promise you can actually keep. */
  supportResponseTarget: '2 working days',

  /**
   * DPDPA s.13 grievance contact. For a small business this is usually the
   * founder. The name and email must be real and monitored.
   */
  grievanceOfficerName: 'Naga Durga Prasad Chunduru',
  grievanceEmail: 'TODO_GRIEVANCE_EMAIL',
  /** DPDPA s.13(2): grievances must be answered within a stated period. */
  grievanceResponseTarget: '30 days',

  /** Privacy / data-protection enquiries. May be the same as grievanceEmail. */
  privacyEmail: 'TODO_PRIVACY_EMAIL',

  /** GSTIN if registered, otherwise set to null and the UI omits it. */
  gstin: null as string | null,
  /** CIN / LLPIN if incorporated, otherwise null. */
  cin: null as string | null,

  /** Public website origin, used in policy text and canonical links. */
  siteUrl: 'https://www.reviyo.in',

  /** Governing law and exclusive jurisdiction for disputes. */
  governingLaw: 'India',
  jurisdictionCity: 'Vijayawada',

  /**
   * Bump these whenever the substance of a policy changes. The consent version
   * is recorded against each customer review session and each signup so you can
   * prove which notice a person actually agreed to (DPDPA s.6(1)).
   */
  policyLastUpdated: '2026-09-26',
  // .2 (25 Sep): Terms describe the AutoPay trial and automatic renewal.
  // 26 Sep .1: Privacy and Cookie policies list the dashboard's browser storage
  // and say precisely how IP addresses are (not) handled.
  // 26 Sep .2: no star rating is collected; the review page asks what the
  // customer liked, and the notice sits on that one screen.
  consentVersion: '2026-09-26.2',
  /** Recorded on each AutoPay mandate, with the wording shown at the checkbox. */
  autopayTermsVersion: '2026-09-25.1',
  /** Free trial length. Must match start_autopay_trial() in the database. */
  trialDays: 14,

  /**
   * Where personal data is stored and processed. Update these to match your
   * actual Supabase project region and configured AI provider before launch —
   * the Privacy Policy renders them verbatim.
   */
  // The selected project yagchgwgbttxfihlyddm was last verified in ap-northeast-2.
  dataRegion: 'Northeast Asia (Seoul)',
  aiProviderName: 'TODO_AI_PROVIDER_NAME',
  aiProviderPolicyUrl: 'TODO_AI_PROVIDER_POLICY_URL',

  /** How long raw customer review-session text is kept before deletion. */
  sessionRetentionDays: 90,
  /** How long private feedback is kept before deletion. */
  feedbackRetentionDays: 365,
  /** How long analytics events are kept before deletion. */
  analyticsRetentionDays: 395,
} as const;

/** True when a configured value is still an unfilled placeholder. */
export function isPlaceholder(value: string | null): boolean {
  return typeof value === 'string' && value.startsWith('TODO_');
}

/** Renders a value, or a visible warning if it has not been filled in yet. */
export function displayValue(value: string | null): string {
  if (value === null) return '';
  return isPlaceholder(value) ? '[not yet configured]' : value;
}
