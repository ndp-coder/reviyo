import { useState } from 'react';
import { ReviewCounterCard } from '@/components/ReviewCounterCard';
import { Input } from '@/components/ui';

export function HomeCounterCardPreview() {
  const [name, setName] = useState('');
  return <div className="home-counter-preview">
    <div className="home-counter-toolbar"><strong>Printable counter card</strong><span>Product preview</span></div>
    <div className="home-counter-body">
      <Input label="Try your business name on the card" placeholder="e.g. Sunrise Salon" value={name} onChange={event => setName(event.target.value)} maxLength={80} autoComplete="off" />
      <ReviewCounterCard businessName={name.trim() || 'Your business'} qrImage="/images/home/review-qr.svg" qrAlt="Example QR code that opens reviyo.in" printable={false} />
    </div>
    <p className="home-counter-caption">The same card layout you get in your dashboard. Example QR opens reviyo.in. Your input stays in this preview.</p>
  </div>;
}
