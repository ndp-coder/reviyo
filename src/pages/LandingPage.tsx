import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, QrCode, MessageCircle, Sparkles, Inbox, ChartNoAxesColumnIncreasing, SlidersHorizontal, ShieldCheck, Users, PencilLine, ScanLine, Store, Coffee, Scissors, Utensils, Stethoscope, Dumbbell } from 'lucide-react';
import { Card } from '@/components/ui';
import '@/pages/landing-page.css';
import { MarketingHeader } from '@/components/MarketingHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SkipLink } from '@/components/SkipLink';
import { ProductPreview } from '@/components/ProductPreview';
import { landingFaqs } from '@/config/faq';
import { industries } from '@/config/industries';
import { TOOL_PATH } from '@/config/seo';
import { legal } from '@/config/legal';
import { PlanCards } from '@/components/PlanCards';
import { buttonClasses } from '@/components/ui/button-styles';

const steps = [
  {
    where: 'At your counter',
    title: 'They scan your QR code',
    text: 'Any phone camera opens your review page. There is no app to install and no account to create.',
  },
  {
    where: 'On their phone',
    title: 'They tap what they liked',
    text: 'A few topics like “service” or “pricing”, and a line of their own if they want. AI turns that into a draft. No star rating to give twice: they choose stars on Google.',
  },
  {
    where: 'On Google',
    title: 'They post it themselves',
    text: 'They read the draft, change anything that isn’t right, then copy it and paste it on your Google profile.',
  },
];

const features = [
  {
    title: 'A QR code and a counter card, ready to print',
    text: 'Download your code as PNG or SVG, or print the ready-made card. Add separate codes for tables, bills, or a second counter and see which one gets scanned.',
  },
  {
    title: 'Review requests on WhatsApp',
    text: 'Send your review link after a visit with a message you write once. WhatsApp opens on your phone and you pick the customer; no numbers pass through Reviyo.',
  },
  {
    title: 'Help with the words, not the opinion',
    text: 'The AI uses only the topics and comment the customer gives. It adds no experiences, staff names, or prices they didn’t mention.',
  },
  {
    title: 'A private feedback inbox',
    text: 'Anyone can send you a private note as well as, or instead of, a review. Mark each one new, seen, or resolved.',
  },
  {
    title: 'Numbers you can act on',
    text: 'See how many people opened your page, started, got a draft, and went on to Google, so you know where people drop off.',
  },
  {
    title: 'Topics that fit your trade',
    text: 'Start from suggested topics for your kind of business, then rename, reorder, or add your own at any time.',
  },
];

const rules = [
  {
    title: 'Everyone is asked the same way',
    text: 'However their visit went, every customer sees the same option to post on Google. We never hide it from someone who had a bad day with you.',
  },
  {
    title: 'Nothing is offered in return',
    text: 'No discounts, no freebies, no lucky draws for reviews. Google forbids it, so our Terms do too.',
  },
  {
    title: 'The customer posts, not us',
    text: 'Reviyo never posts on anyone’s behalf. The review goes up under the customer’s own Google account, in words they have checked.',
  },
];

const featureIcons = [QrCode, MessageCircle, Sparkles, Inbox, ChartNoAxesColumnIncreasing, SlidersHorizontal];
const stepIcons = [ScanLine, PencilLine, Check];
const ruleIcons = [Users, ShieldCheck, PencilLine];
const industryIcons = [Stethoscope, Scissors, Utensils, Coffee, Dumbbell];

const capitalise = (text: string) => text.replace(/^\w/, (c) => c.toUpperCase());

export function LandingPage() {
  return (
    <div className="landing-page min-h-screen bg-white">
      <SkipLink />
      <MarketingHeader links={[
        { href: '#how-it-works', label: 'How it works' },
        { href: '#features', label: 'Features' },
        { to: '/for', label: 'Industries' },
        { href: '#pricing', label: 'Pricing' },
        { href: '#faq', label: 'FAQ' },
      ]} />
      <main id="main-content" tabIndex={-1}>
        <section className="landing-hero">
          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-copy">
              <p className="landing-context"><Store size={16} aria-hidden="true" /> Made for local businesses in India</p>
              <h1>A simple scan.<br />A review in their<br className="hidden xl:block" /> own words.</h1>
              <p className="landing-hero-description">Make it easier for customers to share their experience on Google. One QR code, a little help with the words, and a review they edit and post themselves.</p>
              <div className="landing-hero-actions">
                <Link to="/signup" className={`${buttonClasses({ size: 'lg' })} landing-primary`}>Start {legal.trialDays}-day free trial <ArrowRight size={18} aria-hidden="true" /></Link>
                <a href="#how-it-works" className={`${buttonClasses({ variant: 'outline', size: 'lg' })}`}>See how it works</a>
              </div>
              <p className="landing-trial-note">₹1 AutoPay check, refunded. Cancel before the trial ends and pay nothing.</p>
              <div className="landing-hero-promises"><span><Check size={15} aria-hidden="true" /> No customer app</span><span><Check size={15} aria-hidden="true" /> Their words, their choice</span></div>
            </div>
            <div className="landing-demo-wrap"><ProductPreview /></div>
          </div>
          <div className="landing-container landing-tool-strip">
            <div><QrCode size={22} aria-hidden="true" /><p><strong>Just need a Google review link?</strong><span>Create your link and a printable QR code for free.</span></p></div>
            <Link to={TOOL_PATH}>Try the free tool <ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
        </section>

        <section id="how-it-works" className="landing-section">
          <div className="landing-container">
            <div className="landing-section-heading"><div><h2>A small moment at your counter.<br />A simpler way to share it.</h2><p>From scanning your code to sharing a review. The customer stays in control at every step.</p></div><span className="landing-process-tag"><ScanLine size={18} aria-hidden="true" /> How it works</span></div>
            <ol className="landing-steps">{steps.map((step, index) => {
              const Icon = stepIcons[index];
              return <li key={step.title}><div className="landing-step-top"><span className="landing-step-icon"><Icon size={25} aria-hidden="true" /></span><span className="landing-step-number">Step {index + 1}</span></div><p className="landing-step-location">{step.where}</p><h3>{step.title}</h3><p>{step.text}</p></li>;
            })}</ol>
          </div>
        </section>

        <section id="features" className="landing-section landing-features-section">
          <div className="landing-container">
            <div className="landing-section-heading"><div><h2>Ready for your everyday business.</h2><p>From the first scan to the follow-up. Everything is included in every plan.</p></div></div>
            <div className="landing-feature-layout">
              <Card className="landing-feature-lead">
                <span className="landing-feature-icon"><QrCode size={27} aria-hidden="true" /></span>
                <h3>One link. Wherever your customers are.</h3>
                <p>Put your QR code on the counter, on a table, or with a bill. Share the same review page after a visit on WhatsApp.</p>
                <div className="landing-placement" aria-hidden="true"><div><Store size={28} /><span>At the counter</span></div><div><QrCode size={28} /><span>On the bill</span></div><div><MessageCircle size={28} /><span>After the visit</span></div></div>
                <Link to={TOOL_PATH} className="landing-text-link">Make your first QR code <ArrowRight size={17} aria-hidden="true" /></Link>
              </Card>
              <dl className="landing-feature-list">{features.map((feature, index) => {
                const Icon = featureIcons[index];
                return <div key={feature.title}><span className="landing-feature-icon"><Icon size={21} aria-hidden="true" /></span><div><dt>{feature.title}</dt><dd>{feature.text}</dd></div></div>;
              })}</dl>
            </div>
          </div>
        </section>

        <section className="landing-section landing-trust-section">
          <div className="landing-container">
            <div className="landing-trust-heading"><ShieldCheck size={30} aria-hidden="true" /><h2>Real experiences.<br />Always the customer’s voice.</h2><p>Three rules built into Reviyo. No shortcuts that put your Google Business Profile at risk.</p></div>
            <ul className="landing-rules">{rules.map((rule, index) => { const Icon = ruleIcons[index]; return <li key={rule.title}><Icon size={24} aria-hidden="true" /><h3>{rule.title}</h3><p>{rule.text}</p></li>; })}</ul>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-container landing-industry-layout">
            <div><h2>For the places<br />people come back to.</h2><p className="landing-section-description">Cafés, clinics, salons, shops. Built for small, single-location businesses and the customers who walk through their doors.</p><Link to="/for" className="landing-text-link">Explore your industry <ArrowRight size={17} aria-hidden="true" /></Link></div>
            <ul className="landing-industries">{industries.map((industry, index) => { const Icon = industryIcons[index] ?? Store; return <li key={industry.slug}><Link to={`/for/${industry.slug}`}><Icon size={20} aria-hidden="true" /><span>{capitalise(industry.plural)}</span><ArrowRight size={16} aria-hidden="true" /></Link></li>; })}</ul>
          </div>
        </section>

        <section id="pricing" className="landing-section landing-pricing-section">
          <div className="landing-container">
            <div className="landing-pricing-heading"><h2>Simple plans. Everything included.</h2><p>One business, one location. Every feature on both plans, taxes included.<br />No add-ons. No per-review charges.</p></div>
            <div className="landing-plans"><PlanCards /></div>
            <p className="landing-pricing-note">Start with a {legal.trialDays}-day trial. ₹1 AutoPay check, refunded straight away. Cancel before the trial ends to avoid the plan charge.</p>
          </div>
        </section>

        <section id="faq" className="landing-section">
          <div className="landing-container landing-faq-layout">
            <div><h2>A few things<br />you might be wondering.</h2><p className="landing-section-description">Straight answers before you get started.</p><Link to="/contact" className="landing-text-link">Talk to us <ArrowRight size={17} aria-hidden="true" /></Link></div>
            <div className="landing-faqs">{landingFaqs.map((item, index) => <details key={item.q} open={index === 0}><summary>{item.q}<ChevronDown size={19} aria-hidden="true" /></summary><p>{item.a}</p></details>)}</div>
          </div>
        </section>

        <section className="landing-final-section">
          <div className="landing-container landing-final-panel">
            <div><span className="landing-final-icon"><ScanLine size={32} aria-hidden="true" /></span><h2>Your next review<br />starts with a simple scan.</h2><p>Try Reviyo at your counter for {legal.trialDays} days.</p><p className="landing-final-note">₹1 AutoPay check, refunded. Cancel any time before the trial ends.</p></div>
            <div className="landing-final-actions"><Link to="/signup" className={`${buttonClasses({ size: 'lg' })} landing-light-button`}>Start your free trial <ArrowRight size={18} aria-hidden="true" /></Link><Link to={TOOL_PATH}>Or create a free review link</Link></div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
