import { useState } from 'react';
import { ReviewCounterCard } from '@/components/ReviewCounterCard';
import { Input } from '@/components/ui';

export function HomeCounterCardPreview() {
  const [name, setName] = useState('');
  return <div className="home-counter-preview max-w-sm rounded-xl border border-gray-200 bg-gray-50 p-4">
    <div className="home-counter-toolbar flex flex-wrap justify-between gap-2 text-xs"><strong>Printable counter card</strong><span>Product preview</span></div>
    <div className="home-counter-body mt-4 space-y-4">
      <Input label="Try your business name on the card" placeholder="e.g. Sunrise Salon" value={name} onChange={event => setName(event.target.value)} maxLength={80} autoComplete="off" />
      <ReviewCounterCard businessName={name.trim() || 'Your business'} qrImage="/images/home/review-qr.svg" qrAlt="Example QR code that opens reviyo.in" printable={false} />
    </div>
    <p className="home-counter-caption mt-3 text-xs leading-relaxed text-gray-600">The same card layout you get in your dashboard. Example QR opens reviyo.in. Your input stays in this preview.</p>
  </div>;
}
