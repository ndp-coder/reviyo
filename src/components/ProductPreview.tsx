import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, CheckCircle2, Coffee, MousePointer2, Pause, Play, RotateCcw, ScanLine, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui';
import '@/components/product-preview.css';

// A real QR code for https://reviyo.in (25×25 modules, error correction M),
// precomputed so the landing page does not have to ship the QR library. This is
// every dark module except the three corner finder patterns, which are drawn
// separately below with rounded corners.
const SITE_QR_DATA_PATH =
  'M9 0h1v1H9zM12 0h2v1H12zM15 0h1v1H15zM9 1h1v1H9zM11 1h5v1H11zM8 2h1v1H8zM13 2h1v1H13zM16 2h1v1H16zM8 3h1v1H8zM10 3h3v1H10zM14 3h1v1H14zM8 4h1v1H8zM10 4h1v1H10zM12 4h1v1H12zM16 4h1v1H16zM8 5h5v1H8zM15 5h2v1H15zM8 6h1v1H8zM10 6h1v1H10zM12 6h1v1H12zM14 6h1v1H14zM16 6h1v1H16zM8 7h1v1H8zM14 7h2v1H14zM0 8h1v1H0zM2 8h5v1H2zM9 8h3v1H9zM18 8h5v1H18zM2 9h1v1H2zM5 9h1v1H5zM7 9h2v1H7zM10 9h1v1H10zM13 9h2v1H13zM16 9h1v1H16zM19 9h1v1H19zM23 9h1v1H23zM0 10h1v1H0zM2 10h1v1H2zM6 10h2v1H6zM10 10h2v1H10zM13 10h3v1H13zM17 10h2v1H17zM20 10h2v1H20zM23 10h2v1H23zM0 11h2v1H0zM5 11h1v1H5zM9 11h5v1H9zM16 11h3v1H16zM24 11h1v1H24zM0 12h2v1H0zM4 12h1v1H4zM6 12h3v1H6zM11 12h2v1H11zM14 12h1v1H14zM17 12h4v1H17zM22 12h3v1H22zM0 13h2v1H0zM4 13h2v1H4zM10 13h1v1H10zM17 13h1v1H17zM19 13h1v1H19zM21 13h1v1H21zM23 13h1v1H23zM0 14h1v1H0zM2 14h2v1H2zM6 14h1v1H6zM9 14h1v1H9zM11 14h2v1H11zM15 14h7v1H15zM23 14h2v1H23zM0 15h1v1H0zM2 15h3v1H2zM7 15h1v1H7zM10 15h2v1H10zM14 15h1v1H14zM16 15h1v1H16zM19 15h2v1H19zM24 15h1v1H24zM0 16h1v1H0zM2 16h1v1H2zM6 16h1v1H6zM11 16h1v1H11zM16 16h5v1H16zM22 16h1v1H22zM8 17h1v1H8zM10 17h1v1H10zM12 17h5v1H12zM20 17h2v1H20zM9 18h2v1H9zM13 18h2v1H13zM16 18h1v1H16zM18 18h1v1H18zM20 18h1v1H20zM22 18h3v1H22zM8 19h3v1H8zM12 19h2v1H12zM16 19h1v1H16zM20 19h2v1H20zM23 19h2v1H23zM8 20h1v1H8zM12 20h1v1H12zM14 20h7v1H14zM22 20h1v1H22zM24 20h1v1H24zM8 21h2v1H8zM17 21h2v1H17zM20 21h5v1H20zM8 22h5v1H8zM15 22h2v1H15zM21 22h2v1H21zM24 22h1v1H24zM11 23h1v1H11zM14 23h1v1H14zM16 23h1v1H16zM19 23h3v1H19zM24 23h1v1H24zM8 24h4v1H8zM17 24h8v1H17z';

const FINDER_ORIGINS = [
  [0, 0],
  [18, 0],
  [0, 18],
] as const;


const STEPS = ['Scan the code', 'Choose topics', 'Edit your draft', 'Post on Google', 'Shared by you'];
const DURATIONS = [2400, 2200, 3200, 2200];

/** An illustrative customer journey, never a real review or automatic post. */
export function ProductPreview() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setReducedMotion(preference.matches); if (preference.matches) setStep(4); };
    update(); preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (paused || reducedMotion || step >= 4) return;
    const timer = window.setTimeout(() => setStep(step + 1), DURATIONS[step]);
    return () => window.clearTimeout(timer);
  }, [step, paused, reducedMotion]);

  return <figure className="review-demo mx-auto w-full max-w-[34rem]" data-step={step} data-paused={paused}>
    <div className="review-demo-toolbar">
      <span className="flex items-center gap-2 text-sm font-semibold text-brand-900"><span className="h-2 w-2 rounded-full bg-accent-700" />See a review take shape</span>
      {!reducedMotion && <Button variant="ghost" size="sm" aria-label={step === 4 ? 'Replay review animation' : paused ? 'Play review animation' : 'Pause review animation'} onClick={() => { if (step === 4) { setStep(0); setPaused(false); } else setPaused(!paused); }}>
        {step === 4 ? <RotateCcw className="h-4 w-4" /> : paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        {step === 4 ? 'Replay' : paused ? 'Play' : 'Pause'}
      </Button>}
    </div>
    <div className="review-demo-stage" aria-hidden="true">
      <div className="review-demo-counter">
        <div className="review-demo-cafe"><Coffee size={19} /><span>Kaveri Café</span></div>
        <p>How was your visit?</p>
        <div className="review-demo-qr">
          <svg viewBox="-2 -2 29 29" className="h-full w-full">
            <path d={SITE_QR_DATA_PATH} fill="#102454" shapeRendering="crispEdges" />
            {FINDER_ORIGINS.map(([x,y]) => <g key={x + '-' + y}><rect x={x} y={y} width="7" height="7" rx="1" fill="#102454" /><rect x={x+1} y={y+1} width="5" height="5" rx=".5" fill="white" /><rect x={x+2} y={y+2} width="3" height="3" rx=".3" fill="#102454" /></g>)}
          </svg>
          {step === 0 && <span className="review-demo-scan" />}
          {step > 0 && <span className="review-demo-scanned"><Check size={20} /></span>}
        </div>
        <span className="review-demo-scan-caption">{step === 0 ? 'Point. Scan. Open.' : 'Review page opened'}</span>
      </div>
      <div className="review-demo-window">
        <div className="review-demo-address"><span className="flex gap-1"><i /><i /><i /></span><span>reviyo.in</span><span className="w-7" /></div>
        <div className="review-demo-content" key={step}>
          <div className="review-demo-business"><span>K</span><div><strong>Kaveri Café</strong><p>Your visit. Your words.</p></div></div>
          {step === 0 ? <div className="review-demo-opening"><ScanLine size={42} strokeWidth={1.4} /><h3>One scan to get started</h3><p>No app to install.</p><span className="review-demo-loading"><i /><i /><i /></span></div>
          : step === 1 ? <><h3>What would you like to mention?</h3><p className="review-demo-hint">You choose what goes into your review.</p><div className="review-demo-topics"><span className="review-demo-topic selected">Coffee <Check size={14} /></span><span className="review-demo-topic selected second">Friendly service <Check size={14} /></span><span className="review-demo-topic">The atmosphere</span></div><div className="review-demo-action"><Sparkles size={15} /> Create my draft</div><MousePointer2 className="review-demo-pointer" size={25} /></>
          : step === 2 ? <><h3>Make it sound like you</h3><p className="review-demo-hint">An editable starting point.</p><div className="review-demo-draft"><span>The coffee was lovely and the service was friendly.</span><span className="review-demo-edit"> I stopped in this morning.<i /></span></div><div className="review-demo-action">Copy &amp; open Google <ArrowUpRight size={15} /></div></>
          : step === 3 ? <><div className="review-demo-google"><span>G</span> Google review</div><p className="review-demo-hint">The customer pastes their words and chooses to post.</p><div className="review-demo-draft">The coffee was lovely and the service was friendly. I stopped in this morning.</div><div className="review-demo-action google-post">Post</div><MousePointer2 className="review-demo-pointer posting" size={25} /></>
          : <div className="review-demo-success"><span><CheckCircle2 size={44} strokeWidth={1.5} /></span><h3>Shared in your own words</h3><p>Reviewed, edited and posted<br />by the customer.</p><div className="review-demo-review">“The coffee was lovely and the service was friendly. I stopped in this morning.”</div></div>}
        </div>
      </div>
      <span className="review-demo-connection" />
    </div>
    <div className="review-demo-progress" aria-hidden="true">{STEPS.slice(0,4).map((label,index) => <div key={label} className={index <= step ? 'complete' : ''}><span>{index < step ? <Check size={12} /> : index+1}</span><p>{['Scan', 'Choose', 'Edit', 'Post'][index]}</p></div>)}</div>
    <figcaption className="review-demo-caption"><span aria-live="off">{STEPS[step]}.</span> Illustration only. Customers always choose what to share.</figcaption>
  </figure>;
}
