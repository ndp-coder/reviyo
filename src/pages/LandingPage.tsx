import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import '@/pages/landing-page.css';
import { MarketingHeader } from '@/components/MarketingHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SkipLink } from '@/components/SkipLink';
import { HomeProductFilm } from '@/components/HomeProductFilm';
import { landingFaqs } from '@/config/faq';
import { industries } from '@/config/industries';
import { TOOL_PATH } from '@/config/seo';
import { legal } from '@/config/legal';
import { PLANS, formatRupees } from '@/config/plans';
import { PlanCards } from '@/components/PlanCards';
import { buttonClasses } from '@/components/ui/button-styles';

const steps = [
  { title: 'A scan starts the conversation.', image: 'scan.svg', alt: 'Illustrated café counter card with a QR and the invitation: How was your visit?', text: 'Put your QR code where customers can see it. Their phone camera opens your review page. No app. No customer signup.' },
  { title: 'Their experience finds its words.', image: 'draft.svg', alt: 'Example review page with Coffee and Service topics and the customer’s own comment, ready to create a draft.', text: 'Customers choose relevant topics and describe their visit. With their consent, AI helps turn their input into an editable draft.' },
  { title: 'They choose what to share.', image: 'share.svg', alt: 'An editable example draft with a Copy and open Google button. The customer chooses whether to post.', text: 'They read it, make changes and copy it to Google. Their rating, their words and their decision to post. Always.' },
];
const features = [
  { title: 'A QR that belongs at your counter', text: 'Download PNG or SVG files and a printable counter card. Use source codes to see whether people scan from a table, bill or counter.' },
  { title: 'A link that goes where you go', text: 'Share your review page after a visit on WhatsApp. You choose the customer and send the message yourself.' },
  { title: 'Topics that fit your business', text: 'Coffee, service, a haircut, a repair. Start with suggestions, then edit the topics to match what you actually do.' },
  { title: 'Room for private feedback, too', text: 'Every customer can send a private note, with the same option to write a Google review. Keep track of what needs a reply.' },
];
const rules = [
  { title: 'Every customer is welcome.', text: 'The same review options, however the visit went. No filtering customers by their experience.' },
  { title: 'No rewards for reviews.', text: 'No discounts, freebies or gifts in return. Just an invitation to share an honest experience.' },
  { title: 'They have the final say.', text: 'Customers check the draft and post it from their own Google account. Reviyo never posts for them.' },
];

export function LandingPage() {
  return <div className="landing-page min-h-screen">
    <SkipLink />
    <MarketingHeader links={[
      { href: '#how-it-works', label: 'How it works' }, { href: '#product-film', label: 'Watch the demo' },
      { href: '#pricing', label: 'Pricing' }, { href: '#faq', label: 'FAQs' },
    ]} />
    <main id="main-content" tabIndex={-1}>
      <section className="landing-hero"><div className="landing-container landing-hero-grid">
        <div className="landing-hero-copy">
          <p className="landing-context"><span aria-hidden="true" />Google reviews, with a little help from Reviyo</p>
          <h1>Make room for<br />your next<br />Google review.</h1>
          <p className="landing-hero-description">You take care of the experience. We help customers find the words to share it. One scan, an editable draft, and a review they post themselves.</p>
          <div className="landing-hero-actions"><Link to="/signup" className={`${buttonClasses({ size: 'lg' })} landing-primary`}>Start {legal.trialDays}-day free trial</Link><a href="#product-film" className="landing-watch-link"><span className="landing-play-small" aria-hidden="true">▶</span>Watch how it works</a></div>
          <p className="landing-trial-note">₹1 AutoPay check, refunded. Cancel before your trial ends to avoid the plan charge.</p>
          <div className="landing-start-price"><span>Made for local businesses in India.</span><a href="#pricing">Plans from {formatRupees(PLANS['1_month'].price)}/month</a></div>
        </div>
        <figure className="landing-hero-scene">
          <picture><source srcSet="/images/home/cafe-counter-900.webp 900w, /images/home/cafe-counter.webp 1536w" sizes="(max-width: 760px) 100vw, 52vw" type="image/webp" /><img src="/images/home/cafe-counter.webp" alt="Illustrative café scene: an owner welcoming a customer at the counter." width="1536" height="1024" {...{ fetchpriority: 'high' }} /></picture>
          <div className="landing-counter-label"><span className="landing-status-dot" aria-hidden="true" />A small moment. A real connection.</div>
          <div className="landing-hero-draft" aria-hidden="true"><div className="landing-draft-top"><span className="landing-business-letter">K</span><div><strong>Kaveri Café</strong><span>Example review draft</span></div><span className="landing-draft-tag">Yours to edit</span></div><p>“I stopped in for a coffee after work. The staff helped me choose something to order.”</p><div className="landing-draft-bottom"><span>Real experience. Their own words.</span><span className="landing-edit-mark">Edit draft</span></div></div>
          <figcaption className="sr-only">Illustration of a local business and an editable example, not a customer review.</figcaption>
        </figure>
      </div><div className="landing-container landing-principles"><p>No app for customers</p><p>Ready-to-print QR codes</p><p>Customers edit and post</p><p>One location. Every feature.</p></div></section>

      <section id="how-it-works" className="landing-section landing-process-section"><div className="landing-container">
        <div className="landing-section-heading"><div><p className="landing-section-kicker">How it works</p><h2>From “what do I write?”<br />to words of their own.</h2></div><p className="landing-section-description">Three simple steps. No complicated apps or blank-page hesitation. The customer stays in control.</p></div>
        <ol className="landing-steps">{steps.map((step, index) => <li key={step.image}><div className="landing-step-image"><img src={`/images/home/${step.image}`} alt={step.alt} width="720" height="540" loading="lazy" decoding="async" /><span className="landing-step-number">0{index + 1}</span></div><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol>
        <p className="landing-example-note">Illustrative screens. Customers use their real experience and choose their stars on Google.</p>
      </div></section>

      <HomeProductFilm />

      <section id="features" className="landing-section landing-features-section"><div className="landing-container">
        <div className="landing-section-heading"><div><p className="landing-section-kicker">For the everyday work of running a business</p><h2>Less explaining.<br />More getting on with your day.</h2></div><p className="landing-section-description">Set up your page, put out your QR, and give your team one simple way to ask for a review.</p></div>
        <div className="landing-feature-layout"><div className="landing-counter-card-panel"><div className="landing-print-card"><span className="landing-print-business">Your business</span><h3>How was<br />your visit?</h3><img src="/images/home/review-qr.svg" alt="Example QR code linking to the Reviyo website." width="160" height="160" loading="lazy" /><p>Scan to share your experience.</p><span>Powered by Reviyo</span></div><p>On the counter. With the bill.<br />Wherever your customers are.</p></div><dl className="landing-feature-list">{features.map(feature => <div key={feature.title}><dt>{feature.title}</dt><dd>{feature.text}</dd></div>)}</dl></div>
        <div className="landing-tool-strip"><div><h3>Not ready for an account? Start with a free QR.</h3><p>Create a direct Google review link and printable QR code. No signup needed.</p></div><Link to={TOOL_PATH} className={buttonClasses({ variant: 'outline', size: 'lg' })}>Create my free QR code</Link></div>
      </div></section>

      <section className="landing-section landing-trust-section"><div className="landing-container"><div className="landing-trust-heading"><h2>Your reputation is personal.<br />We treat it that way.</h2><p>A useful starting point for a review.<br />The opinion always belongs to the customer.</p></div><ul className="landing-rules">{rules.map(rule => <li key={rule.title}><h3>{rule.title}</h3><p>{rule.text}</p></li>)}</ul></div></section>

      <section className="landing-section landing-industries-section"><div className="landing-container landing-industry-layout"><div><p className="landing-section-kicker">Built for the businesses around us</p><h2>Behind every counter,<br />there’s a story.</h2><p className="landing-section-description">Cafés and clinics. Salons and shops. One business, one location, and the people who walk through your door.</p><Link to="/for" className="landing-text-link">Find your industry</Link></div><ul className="landing-industries">{industries.map(industry => <li key={industry.slug}><Link to={`/for/${industry.slug}`}>{industry.plural.replace(/^\w/, c => c.toUpperCase())}</Link></li>)}</ul></div></section>

      <section id="pricing" className="landing-section landing-pricing-section"><div className="landing-container"><div className="landing-pricing-heading"><p className="landing-section-kicker">Simple from the start</p><h2>Your business. Your pace.</h2><p>Every feature, on every plan. One business and one location.<br />Taxes included. No per-review charges.</p></div><div className="landing-plans"><PlanCards /></div><p className="landing-pricing-note">Start with a {legal.trialDays}-day trial. ₹1 AutoPay check, refunded straight away. Cancel before the trial ends to avoid the plan charge.</p></div></section>

      <section id="faq" className="landing-section"><div className="landing-container landing-faq-layout"><div><p className="landing-section-kicker">A little clarity</p><h2>Good questions.<br />Straight answers.</h2><p className="landing-section-description">Everything else you might want to know before putting a QR on your counter.</p><Link to="/contact" className="landing-text-link">Ask us a question</Link></div><div className="landing-faqs">{landingFaqs.map((item, index) => <details key={item.q} open={index === 0}><summary>{item.q}<ChevronDown size={18} aria-hidden="true" /></summary><p>{item.a}</p></details>)}</div></div></section>

      <section className="landing-final-section"><div className="landing-container"><div className="landing-guides"><h2>A little help getting started.</h2><div><Link to="/guides/google-review-qr-code" className="landing-text-link">Set up your Google review QR</Link><Link to="/guides/ai-google-review-assistant" className="landing-text-link">Understand AI review writing</Link><Link to="/guides" className="landing-text-link">Explore all guides</Link></div></div><div className="landing-final-panel"><div><h2>Your counter.<br />Their next conversation.</h2><p>Give your customers a simpler way to share their experience.</p><p className="landing-final-note">Try Reviyo for {legal.trialDays} days. ₹1 AutoPay check, refunded. Cancel before the trial ends.</p></div><div className="landing-final-actions"><Link to="/signup" className={`${buttonClasses({ size: 'lg' })} landing-light-button`}>Start my free trial</Link><Link to={TOOL_PATH}>Or make a free review QR</Link></div></div></div></section>
    </main><SiteFooter />
  </div>;
}
