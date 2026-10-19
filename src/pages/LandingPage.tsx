import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Play } from 'lucide-react';
import '@/pages/landing-page.css';
import { MarketingHeader } from '@/components/MarketingHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SkipLink } from '@/components/SkipLink';
import { HomeProductFilm } from '@/components/HomeProductFilm';
import { HomeReviewDemo } from '@/components/HomeReviewDemo';
import { HomeCounterCardPreview } from '@/components/HomeCounterCardPreview';
import { SetupSupportLinks } from '@/components/SetupSupportLinks';
import { homeFilm } from '@/config/home-film';
import { landingFaqs } from '@/config/faq';
import { industries } from '@/config/industries';
import { TOOL_PATH } from '@/config/seo';
import { legal } from '@/config/legal';
import { PLAN_FEATURES, PLAN_ORDER, PLANS, YEARLY_SAVING, formatRupees, perMonth } from '@/config/plans';
import { buttonClasses } from '@/components/ui/button-styles';

const steps = [
  { title: 'Scan at the counter', description: 'Your QR opens the review page. No extra app or Reviyo account for customers.' },
  { title: 'Describe the experience', description: 'They add their own input. With consent, AI helps put it into an editable draft.' },
  { title: 'Make it their own', description: 'They edit, copy and open Google. Their stars, their account, their decision to post.' },
];

export function LandingPage() {
  return <div className="landing-page min-h-screen">
    <SkipLink />
    <MarketingHeader signupLabel="Get started" links={[
      { href: '#how-it-works', label: 'How it works' }, { href: '#product-film', label: 'Watch demo' },
      { href: '#pricing', label: 'Pricing' }, { href: '#setup-contact', label: 'Talk to us' },
    ]} />
    <main id="main-content" tabIndex={-1}>
      <section className="landing-hero" aria-labelledby="home-title">
        <div className="landing-container">
          <div className="landing-hero-copy">
            <p className="landing-context">Google review QR codes, with a writing assistant.</p>
            <h1 id="home-title">Make a Google review<br />easier to write.</h1>
            <p className="landing-hero-description">A QR code helps customers turn their experience into an editable draft.<br className="desktop-break" /> They choose the final words and post on Google themselves.</p>
            <div className="landing-hero-actions"><Link to="/signup" className={`${buttonClasses({ size: 'lg' })} landing-primary`}>Get started<ArrowRight size={18} aria-hidden="true" /></Link><a href="#product-film" className="landing-watch-button"><Play size={16} aria-hidden="true" />Watch the demo<span>{Math.round(homeFilm.duration)} sec</span></a></div>
            <p className="landing-hero-terms">From {formatRupees(PLANS['1_month'].price)}/month. {legal.trialDays}-day trial with a refundable ₹1 AutoPay check.</p>
          </div>
          <HomeReviewDemo />
          <div className="landing-hero-foot"><span>Made for local businesses in India</span><a href="#setup-contact">Need a hand getting set up?<ArrowRight size={15} aria-hidden="true" /></a></div>
        </div>
      </section>

      <section id="how-it-works" className="landing-section landing-process-section"><div className="landing-container">
        <div className="landing-section-heading"><h2>From your counter to Google.<br />In three simple steps.</h2><p>From a card on your counter to a review the customer chooses to post.</p></div>
        <ol className="landing-process-list">{steps.map((step, index) => <li key={step.title}><span className="landing-step-number">{index + 1}</span><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol>
        <p className="landing-process-policy">Every customer gets the same options. No incentives. No automatic posting.</p>
      </div></section>

      <HomeProductFilm />

      <section id="features" className="landing-section landing-owner-section"><div className="landing-container landing-owner-layout">
        <div className="landing-owner-copy"><p className="landing-section-kicker">Ready for the real world</p><h2>Your review setup,<br />ready for the counter.</h2><p>Your business name, your review link, your topics. Set it up once and put it where the next customer can see it.</p><dl className="landing-owner-features"><div><dt>Print your QR</dt><dd>Download PNG or SVG, or print your counter card.</dd></div><div><dt>Share your link</dt><dd>Send your own review request on WhatsApp.</dd></div><div><dt>See what happens</dt><dd>Follow scans, drafts and clicks to Google. Private feedback has its own inbox.</dd></div></dl><a href="#pricing" className="landing-text-link">Included on every plan<ArrowRight size={16} aria-hidden="true" /></a></div>
        <HomeCounterCardPreview />
      </div></section>

      <section id="pricing" className="landing-section landing-pricing-section"><div className="landing-container">
        <div className="landing-pricing-heading"><p className="landing-section-kicker">Simple pricing</p><h2>One business. Every feature.</h2><p>Choose your billing term. One location and one Google Business Profile.<br className="desktop-break" /> Taxes included. No per-review charges.</p></div>
        <div className="landing-pricing-options">{PLAN_ORDER.map(planId => {
          const plan = PLANS[planId];
          const annual = plan.months === 12;
          return <article key={planId} className={`landing-price-option${annual ? ' landing-price-annual' : ''}`}>
            <div className="landing-price-title"><h3>{plan.label}</h3>{annual && <span>Save {formatRupees(YEARLY_SAVING)} vs monthly</span>}</div>
            <p className="landing-plan-amount">{formatRupees(plan.price)}<span> / {plan.months === 1 ? 'month' : `${plan.months} months`}</span></p>
            <p className="landing-plan-term">{plan.months === 1 ? 'Monthly billing with AutoPay' : `One payment for the term · ${perMonth(planId)}`}</p>
            <Link to="/signup" aria-label={`Get started with Reviyo; ${plan.label.toLowerCase()} pricing shown`} className={`${buttonClasses({ variant: annual ? 'primary' : 'outline', size: 'lg' })} landing-plan-button`}>Get started<ArrowRight size={16} aria-hidden="true" /></Link>
          </article>;
        })}</div>
        <div className="landing-plan-includes"><h3>Always included</h3><ul>{PLAN_FEATURES.map(feature => <li key={feature}>{feature}</li>)}</ul></div>
        <p className="landing-pricing-note">Creating an account needs no payment details. Choose and confirm your plan during setup. Activate your {legal.trialDays}-day trial with a refundable ₹1 AutoPay check. Cancel before it ends to avoid the plan charge. <Link to="/refunds">Refund and cancellation policy</Link>.</p>
      </div></section>

      <section id="setup-contact" className="landing-section landing-contact-section" aria-labelledby="setup-title" tabIndex={-1}><div className="landing-container landing-contact-layout">
        <div><p className="landing-section-kicker">A little help to get going</p><h2 id="setup-title">Help with your first QR.</h2><p>Ask us about finding your Google review link, setting up your page or printing your first counter card.</p><SetupSupportLinks /><p className="landing-support-hours">{legal.supportHours}. Email response target: {legal.supportResponseTarget}.</p></div>
        <div className="landing-setup-guide"><h3>What happens after signup?</h3><ol><li><span>1</span><p>Create your account with an email and password.</p></li><li><span>2</span><p>Add your business, Google review link and topics.</p></li><li><span>3</span><p>Choose a plan, approve the trial AutoPay check, then print or share your QR.</p></li></ol><p>Cancel AutoPay from Dashboard → Billing before the trial ends to avoid the plan charge.</p><Link to="/contact" className="landing-text-link">Support and business details<ArrowRight size={16} aria-hidden="true" /></Link></div>
      </div></section>

      <section id="faq" className="landing-section landing-faq-section"><div className="landing-container landing-faq-layout"><div><p className="landing-section-kicker">Before you start</p><h2>A few good questions.</h2><p>Real experiences. Customer control.<br />Here’s how we keep it that way.</p><Link to="/contact" className="landing-text-link">Ask us something else<ArrowRight size={16} aria-hidden="true" /></Link></div><div className="landing-faqs">{landingFaqs.map(item => <details key={item.q}><summary>{item.q}<ChevronDown size={18} aria-hidden="true" /></summary><p>{item.a}</p></details>)}</div></div></section>

      <section className="landing-resources-section"><div className="landing-container"><div className="landing-resources-top"><h2>For the businesses around us.</h2><Link to="/for" className="landing-text-link">Explore industries<ArrowRight size={16} aria-hidden="true" /></Link></div><ul className="landing-industries">{industries.map(industry => <li key={industry.slug}><Link to={`/for/${industry.slug}`}>{industry.plural.replace(/^\w/, c => c.toUpperCase())}</Link></li>)}</ul><div className="landing-guides"><Link to="/guides/google-review-qr-code">Set up a Google review QR</Link><Link to="/guides/ai-google-review-assistant">How AI review writing works</Link><Link to="/guides">All guides<ArrowRight size={14} aria-hidden="true" /></Link></div></div></section>

      <section className="landing-final-section"><div className="landing-container"><div><h2>Make it easier to leave a review.</h2><p>Start with Reviyo, or make a free direct Google review QR.</p></div><div className="landing-final-actions"><Link to="/signup" className={`${buttonClasses({ size: 'lg' })} landing-primary`}>Get started<ArrowRight size={18} aria-hidden="true" /></Link><Link to={TOOL_PATH}>Create a free QR</Link></div></div></section>
    </main><SiteFooter />
  </div>;
}
