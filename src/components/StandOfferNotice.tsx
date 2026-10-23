import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { HomeCounterCardPreview } from '@/components/HomeCounterCardPreview';

/** Never advertises shipping while the supplier connection is unverified. */
export function StandOfferNotice({ featured = false, partner = false }: { featured?: boolean; partner?: boolean }) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void supabase.rpc('qr_stand_offer').then(({ data, error }) => {
      if (!cancelled && !error && data?.enabled === true) setAvailable(true);
    }, () => { if (!cancelled) setAvailable(false); });
    return () => { cancelled = true; };
  }, []);
  const copy = <>
    <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">{available ? 'Stand delivery available' : 'Printed stand delivery · coming soon'}</p>
    {featured ? <h2 className="mt-4">Your business name.<br />A place on your counter.</h2> : <h3 className="mt-2 text-base font-semibold text-gray-900">Your business name. Your QR stand.</h3>}
    <p className="mt-2 text-sm leading-relaxed text-gray-600">{available
      ? 'One personalized QR stand is included with your first paid purchase of any plan. Add your Indian delivery address before paying. Renewals do not include another stand.'
      : 'We’re preparing personalized QR stands, printed and delivered to your business in India. The planned offer is one stand with your first purchase of any plan once delivery opens. Physical delivery is not included in purchases made now.'}</p>
    {featured && <ol className="landing-stand-steps">
      <li><strong>Make it yours</strong><span>Your business name above the QR. A small “QR by Reviyo” line below.</span></li>
      <li><strong>Print your card today</strong><span>Customize, download and print from Dashboard → QR code after activation.</span></li>
      <li><strong>Delivery, when it opens</strong><span>{available ? 'Save your address before your first plan payment. One stand per business; no repeat stand on renewal.' : 'Check availability at checkout before paying. No delivery date is promised yet.'}</span></li>
    </ol>}
    {partner ? <p className="mt-3 text-sm font-medium text-gray-800">{available ? 'Ask the owner to confirm their print name and delivery address during activation.' : 'When speaking to owners, offer the printable card today. Do not promise a delivered stand with a current payment.'}</p>
      : <Link to="/signup" className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-brand-900 underline underline-offset-4">Get started with your QR</Link>}
  </>;
  if (featured) return <section id="qr-stand" className="landing-section landing-stand-section"><div className="landing-container landing-stand-layout"><div>{copy}</div><HomeCounterCardPreview /></div></section>;
  return <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 text-left sm:p-6">
    {copy}
    {!partner && <details className="mt-2"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-brand-900">Preview your business name on the card</summary><HomeCounterCardPreview /></details>}
  </div>;
}
