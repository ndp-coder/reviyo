import { type ReactNode } from 'react';
import { Check, Copy, Star } from 'lucide-react';
import QRCode from 'qrcode';

/**
 * Pictures of the real product for the marketing pages: the counter card an
 * owner prints and the screens a customer sees. Drawn from the same wording
 * and layout as the live pages, so what visitors see here is what they get.
 * The business is an example; nothing here claims to be a real customer.
 */

export const EXAMPLE_BUSINESS = 'Sunrise Dental Clinic';

/** A real, scannable QR code, drawn synchronously so it prerenders. */
export function QrSvg({ value, className = '' }: { value: string; className?: string }) {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const size = modules.size;
  let path = '';
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (modules.get(row, col)) path += `M${col},${row}h1v1h-1z`;
    }
  }
  return (
    <svg viewBox={`-2 -2 ${size + 4} ${size + 4}`} className={className} role="img" aria-label="QR code">
      <rect x="-2" y="-2" width={size + 4} height={size + 4} fill="#fff" />
      <path d={path} fill="#12213F" shapeRendering="crispEdges" />
    </svg>
  );
}

/** The printable counter card from the QR code page, as it stands on a counter. */
export function CounterCard({ qrValue, className = '' }: { qrValue: string; className?: string }) {
  return (
    <figure className={`w-56 rounded-md border border-line bg-white px-6 pb-6 pt-7 text-center shadow-[0_1px_0_#DCE2EA,0_18px_40px_-18px_rgba(18,33,63,0.35)] ${className}`}>
      <p className="font-semiwide text-lg font-bold leading-tight text-ink">{EXAMPLE_BUSINESS}</p>
      <p className="mt-1 text-sm text-muted">Enjoyed your visit? Tell us about it.</p>
      <QrSvg value={qrValue} className="mx-auto mt-4 h-32 w-32" />
      <figcaption className="mt-3 text-xs text-muted">Scan with your phone camera to write a review</figcaption>
    </figure>
  );
}

export function Phone({
  children,
  className = '',
  screenClassName = '',
}: {
  children: ReactNode;
  className?: string;
  /** e.g. a fixed height, so phones shown side by side line up. */
  screenClassName?: string;
}) {
  return (
    <div className={`rounded-[2rem] border-[7px] border-ink bg-ink shadow-[0_24px_50px_-20px_rgba(18,33,63,0.45)] ${className}`}>
      <div className={`overflow-hidden rounded-[1.55rem] bg-white ${screenClassName}`}>
        <div className="flex h-6 items-center justify-center bg-white" aria-hidden="true">
          <span className="h-1.5 w-12 rounded-full bg-ink/15" />
        </div>
        {children}
      </div>
    </div>
  );
}

function ScreenHeader({ step }: { step: number }) {
  return (
    <div className="px-4 pt-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-ink">{EXAMPLE_BUSINESS}</span>
        <span className="text-muted">Step {step} of 3</span>
      </div>
      <div className="mt-2 h-1 rounded-full bg-line">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${(step / 3) * 100}%` }} />
      </div>
    </div>
  );
}

function Stars({ filled, size = 'h-6 w-6' }: { filled: number; size?: string }) {
  return (
    <div className="flex justify-center gap-1" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${size} ${n <= filled ? 'fill-star text-star' : 'fill-line text-line'}`} />
      ))}
    </div>
  );
}

export function RatingScreen() {
  return (
    <div className="pb-8">
      <ScreenHeader step={1} />
      <div className="px-4 pt-10 text-center">
        <p className="font-semiwide text-lg font-bold text-ink">How was your experience?</p>
        <p className="mt-1 text-xs text-muted">Tap a star to rate from 1 to 5.</p>
        <div className="mt-5">
          <Stars filled={5} size="h-7 w-7" />
        </div>
        <div className="mx-auto mt-1.5 flex max-w-[11rem] justify-between text-[10px] text-muted">
          <span>Poor</span>
          <span>Excellent</span>
        </div>
      </div>
    </div>
  );
}

const TOPICS: [string, boolean][] = [
  ['Doctor', true],
  ['Staff', false],
  ['Painless treatment', true],
  ['Waiting time', true],
  ['Cleanliness', false],
];

export function TopicsScreen() {
  return (
    <div className="pb-5">
      <ScreenHeader step={2} />
      <div className="px-4 pt-6">
        <p className="text-center font-semiwide text-lg font-bold text-ink">What stood out?</p>
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {TOPICS.map(([label, on]) => (
            <span
              key={label}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                on ? 'bg-blue-700 text-white' : 'border border-gray-400 text-gray-700'
              }`}
            >
              {on && <Check className="h-3 w-3" aria-hidden="true" />}
              {label}
            </span>
          ))}
        </div>
        <p className="mt-4 text-[11px] font-medium text-ink">Anything else? (optional)</p>
        <p className="mt-1 rounded-lg border border-gray-400 px-2.5 py-2 text-[11px] text-ink">
          Dr. Rao explained every step first
        </p>
        <p className="mt-4 rounded-lg bg-blue-600 py-2 text-center text-xs font-medium text-white">Write my review</p>
      </div>
    </div>
  );
}

export function DraftScreen({ compact = false }: { compact?: boolean }) {
  return (
    <div className="pb-5">
      <ScreenHeader step={3} />
      <div className="px-4 pt-5">
        <p className="text-center font-semiwide text-lg font-bold text-ink">Your draft review</p>
        <div className="mt-3 rounded-xl border border-line p-3 text-[11px] leading-relaxed text-gray-800">
          Dr. Rao explained every step before starting, and the treatment was painless. I was seen within a few
          minutes of my appointment time. {!compact && 'A calm, careful clinic — I’ll be back for my check-up.'}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] font-medium text-gray-700">
          <span className="rounded-md border border-gray-300 py-1 text-center">Edit it myself</span>
          <span className="rounded-md border border-gray-300 py-1 text-center">Make it shorter</span>
        </div>
        <p className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-xs font-medium text-white">
          <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy review and open Google
        </p>
        <p className="mt-2 text-center text-[10px] leading-snug text-muted">Nothing is posted for you.</p>
      </div>
    </div>
  );
}
