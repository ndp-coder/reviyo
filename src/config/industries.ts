import { getCategoryByValue } from '@/config/categories';
import { legal } from '@/config/legal';

/**
 * Industry landing pages (/for/:slug). Each one targets what an owner in that
 * trade actually searches for ("google reviews for dental clinic", "salon
 * review QR code") and says something specific to that trade, so the pages are
 * genuinely useful rather than near-duplicates.
 *
 * Copy rules (see tests/legal-compliance.test.mjs): promise no outcomes, use no
 * superlatives, invent no statistics, and quote no review counts.
 */
export interface Industry {
  slug: string;
  /** Matches a value in config/categories.ts, for the suggested review topics. */
  category: string;
  /** Plural, lower-case, as used in running text: "dental clinics". */
  plural: string;
  /** Singular, lower-case: "dental clinic". */
  singular: string;
  metaTitle: string;
  metaDescription: string;
  headline: string;
  intro: string;
  /** Where the QR code works best in this kind of business. */
  placement: string[];
  /** What customers of this trade tend to care about when choosing. */
  whyReviewsMatter: string;
  faqs: { q: string; a: string }[];
}

export const industries: Industry[] = [
  {
    slug: 'dental-clinics',
    category: 'dental_clinic',
    plural: 'dental clinics',
    singular: 'dental clinic',
    metaTitle: 'Get More Google Reviews for Your Dental Clinic | Reviyo',
    metaDescription:
      `A QR code at your reception helps patients write genuine Google reviews in under a minute, with AI help to put their visit into words. ${legal.trialDays}-day free trial.`,
    headline: 'More Google reviews for your dental clinic, in your patients’ own words',
    intro:
      'Most patients leave your chair relieved and grateful, then forget to review you by the time they reach the car. Reviyo puts a QR code at reception so they can tap what they liked and get help turning it into a review in their own words before they leave.',
    placement: [
      'At the reception desk, next to the payment counter',
      'On the appointment card or aftercare instructions you hand over',
      'In the WhatsApp message you send with the bill or follow-up reminder',
    ],
    whyReviewsMatter:
      'People choosing a dentist look for signs of gentle treatment, clear explanations, cleanliness, and honest pricing. Reviews that mention these in a patient’s own words speak to exactly those worries.',
    faqs: [
      {
        q: 'Is it appropriate to ask patients for reviews?',
        a: 'Yes, as long as you ask everyone the same way and offer nothing in return. Reviyo shows every patient the same flow however their visit went, and patients can send private feedback to the clinic instead if they prefer.',
      },
      {
        q: 'Will the AI mention treatments the patient didn’t have?',
        a: 'No. The AI only uses the topics the patient tapped and anything they typed. It is instructed never to add treatments, staff names, or prices they did not mention, and the patient edits the draft before posting.',
      },
      {
        q: 'Does Reviyo store patient health information?',
        a: 'No. We never ask for a patient’s name, phone number, or treatment details. Patients are warned not to type personal details, and review text is deleted after 90 days.',
      },
    ],
  },
  {
    slug: 'salons',
    category: 'salon',
    plural: 'salons',
    singular: 'salon',
    metaTitle: 'Google Review QR Code for Salons & Beauty Parlours | Reviyo',
    metaDescription:
      `Help salon clients leave Google reviews while they’re still at the mirror. A QR code, AI-assisted writing in their own words, and a ${legal.trialDays}-day free trial.`,
    headline: 'Turn “I love my hair” at the mirror into a Google review',
    intro:
      'The best moment to ask for a salon review is when the client sees the result. Reviyo gives them a QR code to scan right there, then helps them describe the stylist, the service, and the experience in their own words.',
    placement: [
      'On the styling station mirror or a small stand at each chair',
      'At the billing counter',
      'On the card you hand over with product recommendations',
    ],
    whyReviewsMatter:
      'New clients choose a salon on trust: the stylist’s skill, hygiene, and whether the result matched what was asked for. Reviews that name those things help a first-time visitor book with confidence.',
    faqs: [
      {
        q: 'Can reviews mention the stylist by name?',
        a: 'Only if the client types the name themselves. The AI never adds staff names on its own, so every name in a review is one the client chose to include.',
      },
      {
        q: 'What if a client is unhappy?',
        a: 'They see the same options as everyone else. They can post an honest review on Google or send private feedback to you instead. Reviyo never hides the Google option from unhappy clients.',
      },
      {
        q: 'Does the client need to install anything?',
        a: 'No. They scan the QR code with their phone camera and the page opens in the browser.',
      },
    ],
  },
  {
    slug: 'restaurants',
    category: 'restaurant',
    plural: 'restaurants',
    singular: 'restaurant',
    metaTitle: 'Get More Google Reviews for Your Restaurant | QR Code | Reviyo',
    metaDescription:
      `Put a QR code on the table or bill folder and help diners write genuine Google reviews about the food, service, and ambience. ${legal.trialDays}-day free trial.`,
    headline: 'Get more Google reviews for your restaurant, right at the table',
    intro:
      'Diners decide where to eat by scrolling reviews, but few write one after a good meal. A QR code on the table or bill folder lets them tap what they enjoyed and get help writing a genuine review while the taste is fresh.',
    placement: [
      'On a table tent or inside the bill folder',
      'Printed on the takeaway bag or box',
      'At the billing counter for walk-in and parcel customers',
    ],
    whyReviewsMatter:
      'Diners look for specifics: which dishes are worth ordering, portion sizes, how long the wait is, and value for money. Reviews with those details help the next diner decide, and give you honest feedback on the menu.',
    faqs: [
      {
        q: 'Can we give a free dessert for a review?',
        a: 'No. Offering anything in return for a review breaks Google’s policies and can get reviews removed or your profile restricted. It can also fall foul of Indian consumer rules. Ask every diner, reward none.',
      },
      {
        q: 'Does it work for takeaway and delivery?',
        a: 'Yes. Print the QR code on the bag or box and customers can scan it at home.',
      },
      {
        q: 'Can diners write in Hindi or Telugu?',
        a: 'Diners can type their comment in any language, and they edit the draft before posting, so the final review is always in words they chose.',
      },
    ],
  },
  {
    slug: 'cafes',
    category: 'cafe',
    plural: 'cafés',
    singular: 'café',
    metaTitle: 'Google Review QR Code for Cafés & Coffee Shops | Reviyo',
    metaDescription:
      `Help regulars and first-timers review your café on Google while they sip. A QR code, AI help to put it into words, and a ${legal.trialDays}-day free trial.`,
    headline: 'Your regulars love the coffee. Help them say so on Google.',
    intro:
      'Café customers often linger, which is the perfect time to ask. Reviyo puts a QR code on the counter or table so customers can tap what they liked and get help writing a review about the coffee, food, and vibe.',
    placement: [
      'On the counter next to the payment QR',
      'On a table card or sticker',
      'On cup sleeves or the loyalty card',
    ],
    whyReviewsMatter:
      'People pick cafés for the coffee, the food, whether they can sit and work, and the atmosphere. Reviews that mention these help the right customers find you.',
    faqs: [
      {
        q: 'Won’t customers confuse it with the payment QR?',
        a: 'Keep them apart and label yours clearly, for example “How was your visit? Review us on Google”. The review page shows your café’s name and logo as soon as it opens.',
      },
      {
        q: 'How long does it take a customer?',
        a: 'It is designed for phones and takes a few taps: rate, pick topics, optionally add a line, then review the draft and post it on Google.',
      },
      {
        q: 'Can I see how many people scanned?',
        a: 'Yes. Your dashboard shows how many people opened the page, started a review, created a draft, and continued to Google.',
      },
    ],
  },
  {
    slug: 'gyms',
    category: 'gym',
    plural: 'gyms and fitness studios',
    singular: 'gym',
    metaTitle: 'Get More Google Reviews for Your Gym or Fitness Studio | Reviyo',
    metaDescription:
      'A QR code at the front desk helps members review your gym’s trainers, equipment, and cleanliness on Google, with AI help in their own words. Free trial.',
    headline: 'Members who see results make the best reviewers',
    intro:
      'A member who just hit a personal best or finished their first month is your most convincing reviewer. Reviyo makes it easy for them to tap what they liked and write a genuine Google review from the front desk or the locker room.',
    placement: [
      'At the front desk and check-in counter',
      'In the locker room or near the water station',
      'In the message you send when a member renews',
    ],
    whyReviewsMatter:
      'People comparing gyms want to know about trainers, equipment, crowding at peak hours, cleanliness, and pricing. Honest reviews on those points save them a trial visit and bring you better-matched members.',
    faqs: [
      {
        q: 'When is the best time to ask members?',
        a: 'After a milestone: the end of the first month, a renewal, or a completed programme. Keep the QR code visible so members can scan when they feel like it.',
      },
      {
        q: 'Can trainers see private feedback?',
        a: 'Private feedback goes to the owner’s dashboard. You decide who sees it.',
      },
      {
        q: 'Do members need an account?',
        a: 'No. They scan and go. Reviyo never asks for a name, email, or phone number.',
      },
    ],
  },
  {
    slug: 'jewellery-stores',
    category: 'jewellery_store',
    plural: 'jewellery stores',
    singular: 'jewellery store',
    metaTitle: 'Google Reviews for Jewellery Stores | Build Trust Online | Reviyo',
    metaDescription:
      `Jewellery buyers choose on trust. Help your customers write genuine Google reviews about your designs, purity, and service. ${legal.trialDays}-day free trial.`,
    headline: 'Jewellery is bought on trust. Let your customers vouch for you.',
    intro:
      'Buying jewellery is a considered, often emotional purchase, and trust decides where people buy. Reviyo helps customers put their experience into words, about the designs, the staff’s guidance, and how they were treated, as a Google review.',
    placement: [
      'At the billing desk, next to the certificate or invoice',
      'Inside the jewellery box or pouch',
      'In the thank-you message after a wedding or festival purchase',
    ],
    whyReviewsMatter:
      'Buyers want reassurance about purity, fair pricing, variety, and staff who guide rather than push. Reviews that talk about these build the trust that brings new families through the door.',
    faqs: [
      {
        q: 'Can reviews mention prices or offers?',
        a: 'Only if the customer types them. The AI never adds prices or offers on its own.',
      },
      {
        q: 'Is it suitable for high-value purchases?',
        a: 'Yes. The customer controls every word and posts the review themselves, which is what makes the review credible.',
      },
      {
        q: 'Do you collect customer details?',
        a: 'No. Reviyo does not collect names, phone numbers, or purchase details from your customers.',
      },
    ],
  },
  {
    slug: 'diagnostic-centres',
    category: 'diagnostic_centre',
    plural: 'diagnostic centres and labs',
    singular: 'diagnostic centre',
    metaTitle: 'Get More Google Reviews for Your Diagnostic Centre or Lab | Reviyo',
    metaDescription:
      'Help patients review your diagnostic centre on Google: staff care, waiting time, report turnaround, and cleanliness. No patient data collected. Free trial.',
    headline: 'Help patients tell others about a smooth, careful test visit',
    intro:
      'Patients remember whether the sample collection was painless, the wait was short, and the report came on time. Reviyo lets them tap what they liked and write a genuine Google review, without ever asking for their name or test details.',
    placement: [
      'At the sample collection area or reception',
      'On the report envelope or the SMS/WhatsApp message with the report link',
      'At the home-collection handover',
    ],
    whyReviewsMatter:
      'Choosing a lab is about trust in accuracy, gentle staff, hygiene, waiting time, and how fast reports arrive. Reviews covering these help worried patients pick with confidence.',
    faqs: [
      {
        q: 'Will patient health data be stored?',
        a: 'No. Reviyo never asks for names, phone numbers, or test details, warns patients not to type personal details, and deletes review text after 90 days.',
      },
      {
        q: 'Can I ask only patients who had a good experience?',
        a: 'No, and Reviyo is built to prevent it. Every patient sees the same options, including private feedback. Asking only happy customers breaks Google’s rules on review gating.',
      },
      {
        q: 'Does it work for home sample collection?',
        a: 'Yes. Share the review link in the message you send with the report.',
      },
    ],
  },
  {
    slug: 'service-centres',
    category: 'service_centre',
    plural: 'car and bike service centres',
    singular: 'service centre',
    metaTitle: 'Google Reviews for Car & Bike Service Centres | QR Code | Reviyo',
    metaDescription:
      `A QR code at vehicle delivery helps customers review your service centre on Google: quality, timeliness, transparency. ${legal.trialDays}-day free trial.`,
    headline: 'Earn reviews at the moment you hand back the keys',
    intro:
      'Customers judge a service centre when they collect their vehicle: was it ready on time, was the bill clear, does it run well? Reviyo lets them scan a QR code at delivery and write a genuine Google review about the experience.',
    placement: [
      'At the delivery or billing counter',
      'On the job card or invoice',
      'In the “your vehicle is ready” message',
    ],
    whyReviewsMatter:
      'Vehicle owners worry about overcharging, delays, and whether the problem is actually fixed. Reviews that mention transparent billing and on-time delivery answer exactly those worries.',
    faqs: [
      {
        q: 'Can customers mention the service advisor?',
        a: 'Yes, if they type the name themselves. The AI never adds names on its own.',
      },
      {
        q: 'Is it only for cars?',
        a: 'No. It works for two-wheeler, car, and multi-brand workshops alike.',
      },
      {
        q: 'What if a customer wants to complain privately?',
        a: 'Every customer can send private feedback to your dashboard instead of, or as well as, posting on Google.',
      },
    ],
  },
  {
    slug: 'hotels',
    category: 'small_hotel',
    plural: 'hotels, lodges and homestays',
    singular: 'hotel',
    metaTitle: 'Get More Google Reviews for Your Hotel or Homestay | Reviyo',
    metaDescription:
      `Help guests review your hotel, lodge, or homestay on Google at checkout: rooms, cleanliness, staff, food, and location. ${legal.trialDays}-day free trial.`,
    headline: 'Checkout is your best moment to ask for a Google review',
    intro:
      'Travellers rely heavily on Google reviews to pick a place to stay, but most guests forget once they leave. Reviyo lets guests scan a QR code at checkout and write a genuine review about the room, staff, and stay.',
    placement: [
      'At the reception desk during checkout',
      'On a card in the room',
      'In the checkout or thank-you message on WhatsApp',
    ],
    whyReviewsMatter:
      'Guests look for clean rooms, helpful staff, good food, safety, and an accurate description of the location. Recent reviews on those points strongly shape where travellers book.',
    faqs: [
      {
        q: 'Does this replace OTA reviews?',
        a: 'No. Reviyo helps guests review you on Google, which travellers see when they search for you or look at the map.',
      },
      {
        q: 'Can guests write from their room?',
        a: 'Yes. A card in the room works well; guests can scan any time during their stay.',
      },
      {
        q: 'Do you collect guest details?',
        a: 'No. No names, phone numbers, or booking details are collected.',
      },
    ],
  },
  {
    slug: 'tuition-centres',
    category: 'tuition_centre',
    plural: 'tuition and coaching centres',
    singular: 'tuition centre',
    metaTitle: 'Google Reviews for Tuition & Coaching Centres | Reviyo',
    metaDescription:
      'Parents and students choose coaching centres by reputation. Help them write genuine Google reviews about teaching, material, and results. Free trial.',
    headline: 'Let parents and students speak for your teaching',
    intro:
      'Parents choose a tuition centre largely on what other parents say. Reviyo helps parents and students say what they liked and write genuine Google reviews about the teachers, study material, and progress.',
    placement: [
      'At the front office or fee counter',
      'On report cards or progress reports',
      'In the message after results or a parent–teacher meeting',
    ],
    whyReviewsMatter:
      'Families weigh teacher quality, batch size, study material, communication with parents, and results. Reviews that speak to these carry weight with the next family deciding.',
    faqs: [
      {
        q: 'Can students under 18 use it?',
        a: 'Google requires reviewers to follow its own terms. For younger students, ask the parent to write the review.',
      },
      {
        q: 'Can we mention exam results in the review?',
        a: 'Only if the parent or student types them. The AI never invents results or rankings.',
      },
      {
        q: 'When should we ask?',
        a: 'After a milestone such as results, the end of a term, or a parent–teacher meeting.',
      },
    ],
  },
  {
    slug: 'retail-stores',
    category: 'retail_store',
    plural: 'retail stores',
    singular: 'retail store',
    metaTitle: 'Get More Google Reviews for Your Retail Store | QR Code | Reviyo',
    metaDescription:
      'A QR code at the billing counter helps shoppers review your store on Google: variety, pricing, and helpful staff. AI-assisted, in their own words. Free trial.',
    headline: 'Turn shoppers at your billing counter into Google reviewers',
    intro:
      'Local shoppers often check Google before deciding which store to visit. Reviyo puts a QR code at your billing counter so every customer can say what they liked and write a genuine review about variety, pricing, and service.',
    placement: [
      'At the billing counter next to the payment QR',
      'Printed on the bill or carry bag',
      'On a shelf card near your most popular section',
    ],
    whyReviewsMatter:
      'Shoppers want to know whether you stock what they need, whether prices are fair, and whether staff are helpful. Reviews on those points bring in people who are ready to buy.',
    faqs: [
      {
        q: 'Is this useful for a small shop?',
        a: 'Yes. Reviyo is built for single-location businesses, and one plan covers one business and one Google Business Profile.',
      },
      {
        q: 'Do I need a Google Business Profile?',
        a: 'Yes. Reviews go to your Google Business Profile. If you don’t have one yet, you can create it free at business.google.com.',
      },
      {
        q: 'Can I print the QR code myself?',
        a: 'Yes. Download it as PNG or SVG from your dashboard and print it any size.',
      },
    ],
  },
];

export function getIndustry(slug: string | undefined): Industry | undefined {
  return industries.find((i) => i.slug === slug);
}

export function industryTopics(industry: Industry): string[] {
  return getCategoryByValue(industry.category)?.suggestedTopics ?? [];
}
