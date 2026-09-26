/**
 * Landing-page FAQ. Shared with the FAQPage structured data in config/seo.ts so
 * what search engines read always matches what visitors see.
 */
export const landingFaqs: { q: string; a: string }[] = [
  { q: 'Does this create fake reviews?', a: 'No. Reviyo helps customers write genuine reviews based on their own input. The AI never invents experiences, staff names, or facts. The customer controls and submits the final review on Google.' },
  { q: 'Does it automatically post to Google?', a: 'No. The customer copies the review text and pastes it on Google themselves. We never submit reviews automatically. We open the Google review page for the customer and they do the posting.' },
  { q: 'Do you filter negative reviews?', a: 'No. Every customer, regardless of their rating, follows the same flow and gets the same ability to generate and post a Google review. We also offer private feedback for all customers.' },
  { q: 'Is it affiliated with Google?', a: 'No. Reviyo is not affiliated with Google. We simply help customers express their experience and direct them to your Google review page.' },
  { q: 'Can I offer a discount for leaving a review?', a: 'No, and our Terms forbid it. Offering anything of value in exchange for a review breaks Google’s policies and can get your reviews removed or your Business Profile suspended. It can also fall foul of Indian consumer law. Ask everyone, incentivise nobody.' },
  { q: 'What data do you collect from my customers?', a: 'Their star rating, the topics they tap, and anything they choose to type — and nothing else. No name, no email, no phone number, no IP address, no tracking cookies. We show them exactly this before they start, and we delete it after 90 days.' },
  { q: 'Can I get a refund?', a: 'Yes. Full refund within 7 days of payment, no reason needed. After that, we refund pro-rata if the service is materially broken or we discontinue it. The full detail is in our Refund & Cancellation Policy.' },
];

/** FAQ on the free Google review link generator, shared with its FAQPage data. */
export const reviewLinkToolFaqs: { q: string; a: string }[] = [
  {
    q: 'What is a Google review link?',
    a: 'It is a direct link that opens the “write a review” box for your business on Google. Customers who tap it skip searching for you on Maps, so far more of them finish the review.',
  },
  {
    q: 'Is this tool really free?',
    a: 'Yes. The link and QR code are yours to keep and print. Nothing is stored and you don’t need an account.',
  },
  {
    q: 'What is a Google Place ID?',
    a: 'A unique ID Google gives every place on Google Maps, usually starting with “ChIJ”. Google’s Place ID Finder shows yours when you search for your business name.',
  },
  {
    q: 'Can I offer a discount to customers who leave a review?',
    a: 'No. Google’s policies forbid offering anything in return for reviews, and it can get reviews removed or your profile restricted. Ask every customer the same way and reward none.',
  },
  {
    q: 'Will the QR code stop working?',
    a: 'No. It points straight at your Google review link and does not pass through any Reviyo server, so it keeps working even if you never sign up.',
  },
];
