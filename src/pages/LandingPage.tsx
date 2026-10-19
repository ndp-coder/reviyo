import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown } from 'lucide-react';
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
import { PLAN_FEATURES, PLAN_ORDER, PLANS, formatRupees, perMonth, planTerm } from '@/config/plans';
import { buttonClasses } from '@/components/ui/button-styles';

const steps = [
  { title: 'Put your QR where customers will see it.', text: 'Print your counter card or add the code to a bill. Scanning it opens your business’s review page in the phone browser.' },
  { title: 'Give them a starting point.', text: 'Customers choose relevant topics and describe their visit. With their consent, AI turns that input into a draft they can change.' },
  { title: 'Leave the final word to them.', text: 'They check, edit and copy the text. Then they choose their stars and post on Google themselves. Every customer gets the same options.' },
];

export function LandingPage() {
  return <div className="landing-page min-h-screen">
    <SkipLink />
    <MarketingHeader signupLabel="Create account" links={[
      { href: '#how-it-works', label: 'How it works' }, { href: '#setup-help', label: 'Setup help' },
      { href: '#pricing', label: 'Pricing' }, { href: '#product-film', label: 'Watch demo' },
    ]} />
    <main id="main-content" tabIndex={-1}>
      <section className="landing-hero">
        <div className="landing-container landing-hero-grid">
          <div className="landing-hero-copy">
            <p className="landing-context">Google review QR + AI writing help</p>
            <h1>A Google review,<br />in their own words.</h1>
            <p className="landing-hero-description">Scan a QR. Describe the visit. Edit a draft. Customers post the review on Google themselves.</p>
            <div className="landing-hero-price"><strong>{formatRupees(PLANS['1_month'].price)}<span> / month</span></strong><a href="#setup-contact">Need help getting started?</a></div>
          </div>
          <HomeReviewDemo />
          <div className="landing-hero-conversion">
            <div className="landing-hero-actions"><Link to="/signup" className={`${buttonClasses({ size: 'lg' })} landing-primary`}>Create my account<ArrowRight size={18} aria-hidden="true" /></Link><a href="#setup-contact" className={`${buttonClasses({ variant: 'outline', size: 'lg' })} landing-help-button`}>Help me set up</a></div>
            <p className="landing-trial-note">No payment details to create an account. Activate your {legal.trialDays}-day trial during setup with a refundable ₹1 AutoPay check.</p>
            <a href="#product-film" className="landing-text-link landing-hero-film-link">Watch the {Math.round(homeFilm.duration)}-second Telugu walkthrough</a>
          </div>
        </div>
        <div className="landing-container landing-basics"><p>For local businesses in India</p><p>No extra app for customers</p><p>Customers control the final review</p><p>Every feature on every plan</p></div>
      </section>

      <section id="how-it-works" className="landing-section landing-process-section"><div className="landing-container">
        <div className="landing-section-heading"><p className="landing-section-kicker">For your customers</p><div><h2>From your counter to Google.</h2><p className="landing-section-description">One review link. Three straightforward steps.</p></div></div>
        <ol className="landing-process-list">{steps.map((step, index) => <li key={step.title}>
          <div className="landing-step-visual" aria-hidden="true">
            {index === 0 ? <div className="landing-mini-counter"><strong>Your business</strong><span>How was your visit?</span><img src="/images/home/review-qr.svg" width="104" height="104" alt="" loading="lazy" /><span>Scan to write a review</span></div> : index === 1 ? <div className="landing-mini-input"><span>About your visit</span><div><b>Coffee</b><b>Service</b><b>Waiting time</b></div><p>“The service was friendly, but my coffee took a while.”</p><small>Real input, with consent.</small></div> : <div className="landing-mini-draft"><span>Your draft, ready to edit</span><p>“I visited for a coffee. The service was friendly, although my order took a while to arrive.”</p><div>Edit your words <span>→</span> Open Google</div></div>}
          </div>
          <div className="landing-step-copy"><span className="landing-step-index">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></div>
        </li>)}</ol>
        <p className="landing-example-note">Example business and text shown. Customers describe their own experience and choose their rating on Google.</p>
      </div></section>

      <section id="features" className="landing-section landing-features-section"><div className="landing-container">
        <div className="landing-section-heading"><p className="landing-section-kicker">For your business</p><div><h2>One place to run your review setup.</h2><p className="landing-section-description">Set up your business page, print the card and keep track of what happens next.</p></div></div>
        <div className="landing-owner-layout">
          <HomeCounterCardPreview />
          <div className="landing-owner-copy"><h3>Your QR card, ready for the counter.</h3><p>Download the card for your counter. Share your review link in a WhatsApp message you send yourself. Use separate QR source codes to compare scans from tables, bills or reception.</p><p>Private feedback has its own inbox. It’s available to everyone, alongside the same option to review on Google.</p><a href="#pricing" className="landing-text-link">All of this is included on every plan<ArrowRight size={16} aria-hidden="true" /></a></div>
        </div>
        <div className="landing-tool-strip"><div><h3>Just need a direct Google review QR?</h3><p>Make one for free. No account needed. The AI writing assistant is part of the paid plans.</p></div><Link to={TOOL_PATH} className={buttonClasses({ variant: 'outline', size: 'lg' })}>Create a free QR<ArrowRight size={17} aria-hidden="true" /></Link></div>
      </div></section>

      <section id="setup-help" className="landing-section landing-setup-section" aria-labelledby="setup-title"><div className="landing-container">
        <div className="landing-section-heading"><p className="landing-section-kicker">Getting started</p><div><h2 id="setup-title">Your first QR, step by step.</h2><p className="landing-section-description">See the steps before you sign up. You choose your plan and approve billing during setup.</p></div></div>
        <div className="landing-setup-layout">
          <ol className="landing-setup-steps">
            <li><span>1</span><div><h3>Create your account</h3><p>Use your email and a password. No payment details on this form.</p></div></li>
            <li><span>2</span><div><h3>Add your business</h3><p>Enter your business name, Google review link and review topics.</p></div></li>
            <li><span>3</span><div><h3>Choose your plan and start your trial</h3><p>Approve a refundable ₹1 AutoPay check to activate your {legal.trialDays}-day trial. Your selected plan is charged after the trial unless you cancel beforehand.</p></div></li>
            <li><span>4</span><div><h3>Print your card or share your link</h3><p>Invite every customer to describe their experience. They edit and post their own review.</p></div></li>
          </ol>
          <aside id="setup-contact" tabIndex={-1} className="landing-setup-contact" aria-labelledby="setup-contact-title"><h3 id="setup-contact-title">Need a hand with setup?</h3><p>Contact Reviyo support about your Google review link, counter card or billing setup.</p><SetupSupportLinks /><p className="landing-support-phone">{legal.supportPhone}</p><p className="landing-support-hours">{legal.supportHours}. Email response target: {legal.supportResponseTarget}.</p><div className="landing-support-identity"><span>Operated by</span><p>{legal.legalName}</p><span>{legal.address}, {legal.country}</span></div></aside>
        </div>
        <div className="landing-billing-explainer"><div><h3>You stay in control of billing.</h3><p>Cancel AutoPay from Dashboard → Billing before your trial ends to avoid the plan charge. Read the payment and refund terms before authorising.</p></div><div><Link to="/refunds" className="landing-text-link">Refund and cancellation policy</Link><Link to="/contact" className="landing-text-link">Business and support details</Link></div></div>
      </div></section>

      <HomeProductFilm />

      <section id="pricing" className="landing-section landing-pricing-section"><div className="landing-container">
        <div className="landing-section-heading"><p className="landing-section-kicker">Pricing</p><div><h2>Choose how long. Get every feature.</h2><p className="landing-section-description">One business, one location, one Google Business Profile. Taxes included. No per-review charges.</p></div></div>
        <div className="landing-pricing-layout"><div className="landing-plan-list">{PLAN_ORDER.map(planId => {
          const plan = PLANS[planId];
          return <div className="landing-plan-row" key={planId}><div><h3>{plan.label}</h3><p>{plan.months === 1 ? 'Billed monthly with AutoPay' : `Billed once for ${planTerm(planId)} · ${perMonth(planId)}`}</p></div><strong>{formatRupees(plan.price)}</strong></div>;
        })}<div className="landing-pricing-start"><Link to="/signup" className={buttonClasses({ size: 'lg' })}>Create account and choose a plan<ArrowRight size={16} aria-hidden="true" /></Link></div><p className="landing-pricing-note">Start with a {legal.trialDays}-day trial. ₹1 AutoPay check, refunded. Cancel before the trial ends to avoid the plan charge. Choose and confirm your plan during setup.</p></div><div className="landing-included"><h3>Included in every plan</h3><ul>{PLAN_FEATURES.map(feature => <li key={feature}>{feature}</li>)}</ul><Link to="/pricing" className="landing-text-link">Full pricing details</Link></div></div>
      </div></section>

      <section className="landing-policy-section"><div className="landing-container"><h2>Honest reviews. Customer control.</h2><p>Ask every customer. Offer no rewards for reviews. Customers can change the draft, choose their stars and decide whether to post. Reviyo never posts on their behalf.</p><Link to="/terms" className="landing-text-link">Read our terms<ArrowRight size={16} aria-hidden="true" /></Link></div></section>

      <section id="faq" className="landing-section"><div className="landing-container landing-faq-layout"><div><p className="landing-section-kicker">Before you start</p><h2>Questions, answered.</h2><p className="landing-section-description">Need help with your business setup?</p><Link to="/contact" className="landing-text-link">Talk to us<ArrowRight size={16} aria-hidden="true" /></Link></div><div className="landing-faqs">{landingFaqs.map((item, index) => <details key={item.q} open={index === 0}><summary>{item.q}<ChevronDown size={18} aria-hidden="true" /></summary><p>{item.a}</p></details>)}</div></div></section>

      <section className="landing-resources-section"><div className="landing-container landing-resources-layout"><div><h2>For your kind of business.</h2><ul className="landing-industries">{industries.map(industry => <li key={industry.slug}><Link to={`/for/${industry.slug}`}>{industry.plural.replace(/^\w/, c => c.toUpperCase())}<ArrowRight size={14} aria-hidden="true" /></Link></li>)}</ul></div><div className="landing-guides"><h2>A little help getting started.</h2><Link to="/guides/google-review-qr-code" className="landing-text-link">Set up a Google review QR</Link><Link to="/guides/ai-google-review-assistant" className="landing-text-link">How AI review writing works</Link><Link to="/guides" className="landing-text-link">All guides<ArrowRight size={16} aria-hidden="true" /></Link></div></div></section>

      <section className="landing-final-section"><div className="landing-container"><div><h2>Put Reviyo on your counter.</h2><p>Try the full setup for {legal.trialDays} days.</p><p className="landing-trial-note">₹1 AutoPay check, refunded. Cancel before the trial ends to avoid the plan charge.</p></div><div className="landing-final-actions"><Link to="/signup" className={`${buttonClasses({ size: 'lg' })} landing-primary`}>Create my account<ArrowRight size={18} aria-hidden="true" /></Link><a href="#setup-contact" className="landing-text-link">Get setup help</a></div></div></section>
    </main><SiteFooter />
  </div>;
}
