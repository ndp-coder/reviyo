import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { HomeCounterCardPreview } from '@/components/HomeCounterCardPreview';

/** Never advertises shipping while the supplier connection is unverified. */
export function StandOfferNotice() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void supabase.rpc('qr_stand_offer').then(({ data, error }) => {
      if (!cancelled && !error && data?.enabled === true) setAvailable(true);
    }, () => { if (!cancelled) setAvailable(false); });
    return () => { cancelled = true; };
  }, []);
  return <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 text-left sm:p-6">
    <h3 className="text-base font-semibold text-gray-900">Your business name. Your QR stand.</h3>
    <p className="mt-2 text-sm leading-relaxed text-gray-600">{available
      ? 'One personalized QR stand is included with your first paid purchase of any plan. Add your Indian delivery address before paying. Renewals do not include another stand.'
      : 'Customize your counter card with your business name and a small “QR by Reviyo” line. Printed stand delivery is coming soon; it is not included in purchases yet.'}</p>
    <Link to="/signup" className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-brand-900 underline underline-offset-4">Get started with your QR</Link>
    <details className="mt-2"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-brand-900">Preview your business name on the card</summary><HomeCounterCardPreview /></details>
  </div>;
}
