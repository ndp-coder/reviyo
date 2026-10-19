import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button, Textarea } from '@/components/ui';

const exampleDraft = 'I visited Kaveri Café for a coffee. The service was friendly, although my order took a while to arrive.';
const stages = ['Scan', 'Describe', 'Review'];

/** A local, labelled example. It makes no AI, account or posting requests. */
export function HomeReviewDemo() {
  const [step, setStep] = useState(2);
  const [draft, setDraft] = useState(exampleDraft);
  const heading = useRef<HTMLHeadingElement>(null);
  const interacted = useRef(false);
  useEffect(() => {
    if (interacted.current) heading.current?.focus({ preventScroll: true });
  }, [step]);
  function goTo(next: number) {
    interacted.current = true;
    setStep(next);
  }
  return <div className="review-demo" aria-label="Interactive customer journey example">
    <div className="review-demo-label"><span>Try editing a review</span><span>Prewritten demo</span></div>
    <div className={`review-demo-stage review-demo-stage-${step}`}>
      {step === 0 ? <div className="review-demo-counter">
        <div className="review-demo-print"><p className="review-demo-business">Kaveri Café</p><h2 ref={heading} tabIndex={-1}>How was your visit?</h2><p>Tell us about it.</p><img src="/images/home/review-qr.svg" width="180" height="180" alt="Example QR code that opens the Reviyo homepage" /><p>Scan to write a review</p><span>Powered by Reviyo</span></div>
        <p className="review-demo-caption">Example counter card · QR opens reviyo.in</p>
      </div> : <div className="review-demo-screen">
        <div className="review-demo-screen-header"><strong>Kaveri Café</strong><span>Step {step} of 2</span></div>
        <div className="review-demo-progress" aria-hidden="true"><span style={{ width: step === 1 ? '50%' : '100%' }} /></div>
        {step === 1 ? <>
          <h2 ref={heading} tabIndex={-1}>What would you like to share?</h2><p className="review-demo-help">Customers choose topics and describe their visit. Here’s one example.</p>
          <div className="review-demo-topics"><span>Coffee</span><span>Service</span><span>Waiting time</span></div>
          <p className="review-demo-field-label">The customer’s note</p><blockquote>I ordered a coffee. Service was friendly, but it took a while to arrive.</blockquote>
          <p className="review-demo-help">On a real review page, the customer gives consent before AI helps draft their review.</p>
        </> : <>
          <h2 ref={heading} tabIndex={-1}>Try editing this draft.</h2>
          <p className="review-demo-source">Customer’s note: “Friendly service, but my coffee arrived late.”</p>
          <Textarea aria-label="Edit the sample review" value={draft} onChange={event => setDraft(event.target.value)} rows={4} maxLength={2000} />
          <p className="review-demo-posting">Edit this sample. On the real page, customers copy their words and post on Google themselves.</p>
        </>}
      </div>}
    </div>
    <div className="review-demo-action"><p>{step === 0 ? 'No extra app or Reviyo signup.' : step === 1 ? 'Their experience is the starting point.' : 'Nothing is sent or posted here.'}</p>
      {step < 2 ? <Button onClick={() => goTo(step + 1)} size="sm">{step === 0 ? 'Preview the review page' : 'See the sample draft'}<ArrowRight size={16} aria-hidden="true" /></Button> : <Button variant="outline" size="sm" onClick={() => { setDraft(exampleDraft); goTo(2); }}>Reset sample</Button>}
    </div>
    <nav className="review-demo-steps" aria-label="Example steps">{stages.map((label, index) => <Button key={label} variant="ghost" onClick={() => goTo(index)} aria-current={step === index ? 'step' : undefined}><span>0{index + 1}</span>{label}</Button>)}</nav>
  </div>;
}
