import { legal } from '@/config/legal';
import { PLANS, formatRupees } from '@/config/plans';

export interface ReviewGuide {
  slug: string;
  title: string;
  description: string;
  answer: string;
  sections: { title: string; paragraphs: string[]; checklist?: string[] }[];
  comparison?: { heading: string; rows: { option: string; use: string; limitation: string }[] };
  faqs: { q: string; a: string }[];
  related: string[];
}

export const GUIDE_PATH = '/guides';
export const GUIDE_PUBLISHED = '2026-10-01';
export const googleReviewSources = [
  { title: 'Google: tips to get more reviews', url: 'https://support.google.com/business/answer/3474122' },
  { title: 'Google Maps: prohibited and restricted content', url: 'https://support.google.com/contributionpolicy/answer/7400114' },
];

export const reviewGuides: ReviewGuide[] = [
  {
    slug: 'ai-google-review-assistant',
    title: 'Can AI help customers write Google reviews?',
    description: 'How an AI Google review assistant works: customer-selected topics, editable drafts, QR codes, and the difference between writing help and fake reviews.',
    answer: 'Yes. Reviyo is an AI Google review assistant that drafts wording from topics and comments chosen by the customer. Customers read and edit the draft, then paste it into Google and post it themselves. The tool cannot replace a real visit, choose an opinion, or publish a review for someone.',
    sections: [
      { title: 'What an AI review assistant actually does', paragraphs: ['A blank review box can be a hurdle even when someone wants to describe a visit. Writing assistance gives that person a starting point. In Reviyo, a customer scans the business’s QR code, chooses topics that apply to their experience, and can add a comment.', 'The draft is based on that input. A business cannot use it to create experiences for customers who never visited. Customers should delete any sentence that does not accurately describe their visit, and they can write their own text instead.'] },
      { title: 'From a customer’s input to their final review', paragraphs: ['Here is the customer journey, rather than a promise of automatic publishing.'], checklist: ['Scan the business’s QR code with a phone camera.', 'Choose only the topics that apply, and add their own words if they want.', 'Read the suggested draft and change anything inaccurate.', 'Copy the text and open the business’s Google review page.', 'Paste the text, choose a star rating on Google, and decide whether to post.'] },
      { title: 'Selected keywords are context, not instructions to praise', paragraphs: ['Topics such as service or atmosphere identify what the customer wants to discuss. They should not be compulsory praise, staff names, search keywords, or a script supplied by the business. The customer’s comments determine the opinion, including criticism.', 'A useful check is whether the resulting review still represents the customer’s actual experience. Google’s policy requires genuine contributions and prohibits merchants from requesting specific review content.'] },
      { title: 'Writing assistance has clear limits', paragraphs: ['Reviyo does not create Google accounts, post reviews automatically, or guarantee that Google will publish a submission. Customers need to be signed into a Google account to leave a review. Google controls moderation and visibility.', 'Every customer gets the same opportunity to review. A private feedback option must not be used to steer dissatisfied customers away from Google. Nothing should be offered in return for a review. Reviyo is an independent product and is not endorsed by Google.'] },
    ],
    faqs: [
      { q: 'Is there any AI tool for Google reviews?', a: 'Reviyo helps real customers draft Google reviews from their own selected topics and comments. They edit the draft and post it themselves; it does not generate fake experiences or publish automatically.' },
      { q: 'Can AI generate reviews based on customer-selected keywords?', a: 'It can suggest wording from topics and comments the customer chooses. The wording must accurately reflect that customer’s experience, with no business-required praise or keywords.' },
      { q: 'Does Reviyo generate a draft and redirect customers to Google?', a: 'Reviyo provides an editable draft and opens the Google review page. The customer copies and pastes the text, chooses their stars on Google, and submits it themselves.' },
    ], related: ['google-review-qr-code', 'how-to-get-more-google-reviews'],
  },
  {
    slug: 'google-review-qr-code',
    title: 'How to create a Google review QR code',
    description: 'Create a free Google review link and QR code, test the destination, choose where to display it, and decide whether customer-controlled AI drafting is useful.',
    answer: 'A Google review QR code opens a review link when someone scans it. You can create a direct link and downloadable QR code with Reviyo’s free tool. A paid Reviyo review page adds optional AI writing help before customers open Google and submit their own review.',
    sections: [
      { title: 'Start with the correct business profile', paragraphs: ['Check that the Google Business Profile is yours and that its name and address match the location customers visited. A code pointing at the wrong branch is difficult to fix once printed.', 'Use the free review link generator to find your Google Place ID or supply it yourself. Confirm the displayed business details before creating the direct review link. If you already have a review link from your Business Profile, test it on a phone before sharing it.'] },
      { title: 'Create and test before printing', paragraphs: ['The free Reviyo tool gives you a direct Google review link and a QR download. The free link does not include the subscription’s AI drafting flow.'], checklist: ['Open the generated review link and confirm the business name.', 'Download the QR image and leave clear white space around it.', 'Scan it from another phone in the lighting where it will be displayed.', 'Check that it works at the intended print size and viewing distance.', 'Keep the review URL available as a text link for customers who cannot scan.'] },
      { title: 'A direct Google code or an AI-assisted review page?', paragraphs: ['A direct code takes the customer straight to Google. It is a good fit when you only need a link and customers are comfortable writing from scratch.', 'A Reviyo subscription sends customers to a review page first. They can select topics, add a comment, and edit a suggested draft before opening Google. No customer app is required. They still need their own Google account to post.'] },
      { title: 'Placement and wording matter', paragraphs: ['Place a code somewhere easy to notice, such as reception or alongside a receipt. Use a neutral invitation such as “Share your experience on Google.” Offer it to everyone without pressure to write on the premises.', 'Avoid a reward, a required star rating, or a request for specific phrases. Customers should be free to review later or not review at all. For clinics, keep the invitation general and avoid asking people to disclose health details publicly.'] },
    ],
    comparison: { heading: 'Choose the destination that matches your need', rows: [
      { option: 'Direct Google review link', use: 'A free, simple route to the Google review box.', limitation: 'The customer starts with a blank text box.' },
      { option: 'Reviyo review page', use: 'Optional topics and editable AI drafting before Google.', limitation: 'Drafting requires an active plan; the customer still posts manually.' },
    ] },
    faqs: [
      { q: 'Can I give customers a QR code to leave Google reviews?', a: 'Yes. Google’s guidance describes sharing a link or QR code. Ask for genuine feedback without pressure, incentives, or screening by satisfaction.' },
      { q: 'Is there a tool where customers scan a QR code and generate a review?', a: 'Reviyo combines a QR review page with customer-selected topics and an editable draft. Customers then open Google and submit the review themselves.' },
      { q: 'Do customers need an app to scan it?', a: 'No Reviyo app is required. A phone camera can open the link. Posting a Google review requires the customer to sign into a Google account.' },
    ], related: ['ai-google-review-assistant', 'choosing-google-review-software'],
  },
  {
    slug: 'how-to-get-more-google-reviews',
    title: 'How to ask customers for more Google reviews',
    description: 'A practical review collection process for local businesses: neutral requests, QR links, optional writing assistance, and useful measures without buying reviews.',
    answer: 'Make the review link easy to find, ask all customers in the same neutral way, and let them choose when and what to post. A QR code reduces the steps to open Google; optional writing assistance can help customers express their experience. No tool can guarantee a number of reviews or a better rating.',
    sections: [
      { title: 'Build a consistent invitation into the visit', paragraphs: ['Choose a natural moment, such as providing the receipt or completing a service. A short invitation is enough: “If you would like to share your experience, here is our Google review link.” Apply the same approach regardless of how the visit went.', 'Keep the request optional. Do not require customers to complete a review while staff watch, ask for five stars, or impose review quotas on staff. Google’s policy prohibits pressure to leave reviews on the premises and requests for particular content.'] },
      { title: 'Give customers a route they can use later', paragraphs: ['Use a counter QR code, a clickable receipt link, or an appropriate follow-up message. A customer who is busy should be able to open the link later. Do not keep sending reminders after a person declines.', 'Reviyo lets a business prepare a WhatsApp request. WhatsApp opens on the owner’s device, and the owner chooses the recipient and sends it. Reviyo does not automatically message a customer database.'] },
      { title: 'Remove writing friction without changing the opinion', paragraphs: ['A QR code solves finding the review page. An editable draft can help with finding the words. Those are different problems: someone who already knows what to write may prefer a direct Google link.', 'If you use Reviyo’s AI writing help, customers choose topics and add comments. They review the suggestion, make changes, and decide whether to publish. Negative input must remain negative; private feedback must be available without replacing their option to review publicly.'] },
      { title: 'Measure the journey accurately', paragraphs: ['Track review-page opens, started sessions, generated drafts, and clicks through to Google. In Reviyo these measures describe the journey; a click to Google is not proof that a review was posted.', 'Compare those steps to locate friction. If people open the page but do not begin, simplify your topic choices. If they generate drafts but do not proceed, check whether the text is useful and whether instructions are clear. Keep the option to skip or write independently.'] },
      { title: 'Respond to feedback and improve the experience', paragraphs: ['Read reviews on your Google Business Profile and respond appropriately. A review request process cannot substitute for the actual service. Use recurring feedback to address issues in your business.', 'Never buy reviews, give a discount for one, or offer a benefit for changing or removing criticism. Google moderates contributions and decides what remains visible.'] },
    ],
    faqs: [
      { q: 'Which software can help my business collect Google reviews?', a: 'Reviyo offers QR review pages, customer-controlled drafts, WhatsApp request preparation, and journey analytics for a single-location business. A direct Google review link may be enough if you only need a basic invitation.' },
      { q: 'What is the easiest way to collect reviews from customers?', a: 'Choose a simple review link or QR code that opens the correct business, give a neutral optional invitation, and make it usable after the visit. Add drafting help only if customers need it.' },
    ], related: ['google-review-qr-code', 'ai-google-review-assistant'],
  },
  {
    slug: 'google-review-tools-india',
    title: 'Choosing a Google review tool for a business in India',
    description: 'Compare free review QR codes with paid AI drafting for a single-location Indian business. See Reviyo’s actual rupee pricing, trial terms, features, and limits.',
    answer: `For a single-location business in India, start by deciding whether you need only a free review QR code or an editable AI drafting page as well. Reviyo provides a free link tool; subscriptions cost ${formatRupees(PLANS['6_months'].price)} for six months or ${formatRupees(PLANS['12_months'].price)} for twelve months, taxes included.`,
    sections: [
      { title: 'Start with what the business needs', paragraphs: ['A café with one counter may need a very different setup from a chain with several branches. List your requirements before comparing products: review-link generation, printable materials, writing assistance, feedback handling, and reporting.', 'Reviyo’s advertised plans cover one business, one location, and one Google Business Profile. Do not assume one plan covers a chain, review platforms other than Google, or agency accounts. Ask about a requirement that is not listed before subscribing.'] },
      { title: 'Read the full price and renewal terms', paragraphs: [`Both Reviyo plans include the same features. The six-month term is ${formatRupees(PLANS['6_months'].price)}, and the twelve-month term is ${formatRupees(PLANS['12_months'].price)}. Those are term prices, not monthly instalments. Displayed prices include taxes.`, `The ${legal.trialDays}-day trial uses a ₹1 AutoPay authorisation check that is refunded. Cancel before the trial ends to avoid the plan charge. Read the pricing and refund pages for the actual billing, renewal, and cancellation terms rather than relying on a “free trial” label alone.`] },
      { title: 'Check the work involved after setup', paragraphs: ['The owner supplies the correct Google review link, prepares the QR materials, and chooses review topics that suit the business. Customers use the page themselves. WhatsApp requests require the owner to select a customer and send the message.', 'Analytics show activity on the review journey, not a verified count of posted Google reviews. Reviyo’s private feedback inbox contains messages submitted through Reviyo; it is not a replacement for reading and replying to Google reviews on the Business Profile.'] },
      { title: 'Try a real customer journey before committing', paragraphs: ['Test on a phone and verify the business destination. Read a draft based on ordinary topics and another based on criticism. Check that both users have the same ability to open Google and that the draft does not invent details.', 'A useful fit is one your staff can explain in a sentence and customers can use without installing an app. No provider should promise a guaranteed rating, a specific volume of reviews, or automatic public posting on a customer’s behalf.'] },
    ],
    faqs: [
      { q: 'Is there an affordable Google review tool in India?', a: `Reviyo offers a free Google review link and QR generator, plus paid AI-assisted review pages at ${formatRupees(PLANS['6_months'].price)} for six months or ${formatRupees(PLANS['12_months'].price)} for twelve months. Whether it is affordable depends on your requirements and budget.` },
      { q: 'What is the best Google review tool for Indian businesses?', a: 'There is no single best tool for every business. Compare location limits, total term cost, customer effort, reporting, renewal terms, and handling of genuine negative feedback. Reviyo is designed for one business at one location.' },
    ], related: ['choosing-google-review-software', 'google-review-qr-code'],
  },
  {
    slug: 'choosing-google-review-software',
    title: 'How to choose Google review software for a small business',
    description: 'Compare a free Google review link, a QR and AI writing assistant, and broader reputation management. A buyer’s checklist with Reviyo’s scope and limitations.',
    answer: 'Choose Google review software by the job you need done. A free direct review link is enough for basic requests. Reviyo adds a QR review page, editable AI drafting, private feedback, and journey analytics for a single location. Broader reputation management tools may be needed for multiple locations or review platforms.',
    comparison: { heading: 'Three different jobs, three different setups', rows: [
      { option: 'Free Google link or QR code', use: 'Help customers find your Google review box.', limitation: 'No assisted draft, private inbox, or review-journey reporting.' },
      { option: 'Reviyo', use: 'Help customers describe their visit, with optional drafts and QR journey analytics.', limitation: 'One business and one location per plan; customers post on Google themselves.' },
      { option: 'Broader reputation management', use: 'Evaluate for multi-location operations, other review sites, or reply workflows.', limitation: 'Verify each vendor’s features and total cost; these capabilities are not part of Reviyo’s advertised plans.' },
    ] },
    sections: [
      { title: 'Ask these questions before choosing', paragraphs: ['Compare a product against your workflow, rather than treating an unsupported “best tool” claim as a recommendation.'], checklist: ['Does it open the correct Google Business Profile?', 'Can customers use it without installing an app?', 'Can they edit a draft, write independently, or decline?', 'Are invitations available equally, regardless of satisfaction?', 'Are analytics based on observed actions or claimed posted reviews?', 'What are the location limits, term price, AutoPay terms, and cancellation process?'] },
      { title: 'What Reviyo includes', paragraphs: ['Reviyo includes printable QR materials, customised review topics, AI-assisted drafts, a private feedback inbox, WhatsApp request preparation, and analytics on review-page activity. The customer keeps control of the final review and chooses their stars on Google.', 'The free tool creates a direct Google review link and QR code without the paid drafting features. It can be a sensible first step when you have no review invitation process yet.'] },
      { title: 'What Reviyo does not claim to do', paragraphs: ['Reviyo does not buy reviews, guarantee a rating, post on behalf of customers, or automatically send WhatsApp campaigns. It does not verify that a Google click became a published review.', 'Its advertised scope is one business at one location. If you need multiple review platforms, review-reply automation, a chain-wide dashboard, or a full CRM, check other products against those requirements. This guide is published by Reviyo, not an independent ranking of vendors.'] },
      { title: 'Match the process to your trade', paragraphs: ['Restaurants and salons can make a link available with the receipt. Dental clinics and other healthcare businesses should avoid soliciting private health information in public reviews. Jewellery shops can invite feedback about the actual buying experience without prescribing praise.', 'Real estate businesses can offer the same neutral optional invitation after a genuine service interaction. Do not ask clients to disclose financial information, addresses, or transaction details. Choose topics that fit the real service rather than publishing a scripted review.'] },
      { title: 'Evaluate automation carefully', paragraphs: ['Automation can simplify link creation and draft preparation. It should not replace the customer’s decision to write or publish. Be cautious of software that promises public reviews without a customer action.', 'Use a real phone test, read the privacy and refund terms, and compare the total term cost. The right tool is the one that fits your needs and keeps feedback genuine.'] },
    ],
    faqs: [
      { q: 'Is Reviyo a cheaper alternative to reputation management software?', a: 'Reviyo has a narrower single-location scope and published rupee term prices. Compare current vendor costs and required features before calling it cheaper; no competitor price comparison is claimed here.' },
      { q: 'What is the best way to use AI to collect customer reviews?', a: 'Use AI as optional writing assistance based on the customer’s real input. Make the draft editable, keep the invitation neutral, and leave the decision to post with the customer.' },
      { q: 'Is Google review automation fully automatic?', a: 'Link and draft preparation can be assisted. In Reviyo the customer still checks the wording, opens Google, and posts themselves. The owner also sends WhatsApp requests manually.' },
    ], related: ['google-review-tools-india', 'how-to-get-more-google-reviews'],
  },
];

export const getReviewGuide = (slug?: string) => reviewGuides.find((guide) => guide.slug === slug);
