import { Copy, Check } from 'lucide-react';

// A real QR code for https://www.reviyo.in (25×25 modules, error correction M),
// precomputed so the landing page does not have to ship the QR library.
const SITE_QR_PATH =
  'M0 0h7v1H0zM8 0h1v1H8zM10 0h1v1H10zM14 0h1v1H14zM18 0h7v1H18zM0 1h1v1H0zM6 1h1v1H6zM8 1h2v1H8zM12 1h1v1H12zM16 1h1v1H16zM18 1h1v1H18zM24 1h1v1H24zM0 2h1v1H0zM2 2h3v1H2zM6 2h1v1H6zM8 2h2v1H8zM11 2h6v1H11zM18 2h1v1H18zM20 2h3v1H20zM24 2h1v1H24zM0 3h1v1H0zM2 3h3v1H2zM6 3h1v1H6zM9 3h3v1H9zM13 3h3v1H13zM18 3h1v1H18zM20 3h3v1H20zM24 3h1v1H24zM0 4h1v1H0zM2 4h3v1H2zM6 4h1v1H6zM8 4h2v1H8zM13 4h2v1H13zM16 4h1v1H16zM18 4h1v1H18zM20 4h3v1H20zM24 4h1v1H24zM0 5h1v1H0zM6 5h1v1H6zM9 5h2v1H9zM13 5h2v1H13zM18 5h1v1H18zM24 5h1v1H24zM0 6h7v1H0zM8 6h1v1H8zM10 6h1v1H10zM12 6h1v1H12zM14 6h1v1H14zM16 6h1v1H16zM18 6h7v1H18zM10 7h5v1H10zM0 8h1v1H0zM3 8h10v1H3zM14 8h1v1H14zM16 8h2v1H16zM20 8h1v1H20zM22 8h3v1H22zM0 9h1v1H0zM3 9h2v1H3zM7 9h1v1H7zM9 9h7v1H9zM17 9h1v1H17zM19 9h5v1H19zM0 10h3v1H0zM4 10h3v1H4zM8 10h2v1H8zM14 10h2v1H14zM18 10h2v1H18zM21 10h1v1H21zM24 10h1v1H24zM0 11h4v1H0zM8 11h2v1H8zM11 11h1v1H11zM14 11h2v1H14zM19 11h1v1H19zM21 11h4v1H21zM0 12h1v1H0zM3 12h1v1H3zM5 12h2v1H5zM8 12h1v1H8zM11 12h2v1H11zM15 12h1v1H15zM18 12h1v1H18zM24 12h1v1H24zM0 13h1v1H0zM2 13h1v1H2zM4 13h1v1H4zM7 13h1v1H7zM9 13h1v1H9zM14 13h4v1H14zM20 13h1v1H20zM23 13h1v1H23zM0 14h4v1H0zM6 14h2v1H6zM9 14h1v1H9zM11 14h2v1H11zM14 14h2v1H14zM17 14h2v1H17zM20 14h5v1H20zM0 15h1v1H0zM5 15h1v1H5zM11 15h1v1H11zM14 15h1v1H14zM17 15h1v1H17zM19 15h1v1H19zM21 15h2v1H21zM24 15h1v1H24zM0 16h1v1H0zM2 16h3v1H2zM6 16h2v1H6zM9 16h1v1H9zM14 16h7v1H14zM22 16h2v1H22zM8 17h6v1H8zM16 17h1v1H16zM20 17h1v1H20zM22 17h2v1H22zM0 18h7v1H0zM8 18h2v1H8zM11 18h1v1H11zM16 18h1v1H16zM18 18h1v1H18zM20 18h1v1H20zM24 18h1v1H24zM0 19h1v1H0zM6 19h1v1H6zM8 19h1v1H8zM10 19h1v1H10zM12 19h1v1H12zM14 19h3v1H14zM20 19h1v1H20zM23 19h2v1H23zM0 20h1v1H0zM2 20h3v1H2zM6 20h1v1H6zM8 20h1v1H8zM12 20h9v1H12zM23 20h2v1H23zM0 21h1v1H0zM2 21h3v1H2zM6 21h1v1H6zM8 21h1v1H8zM14 21h1v1H14zM18 21h1v1H18zM23 21h2v1H23zM0 22h1v1H0zM2 22h3v1H2zM6 22h1v1H6zM9 22h2v1H9zM12 22h1v1H12zM14 22h2v1H14zM17 22h1v1H17zM20 22h5v1H20zM0 23h1v1H0zM6 23h1v1H6zM9 23h1v1H9zM14 23h2v1H14zM19 23h2v1H19zM22 23h3v1H22zM0 24h7v1H0zM8 24h1v1H8zM10 24h1v1H10zM13 24h2v1H13zM16 24h2v1H16zM21 24h1v1H21zM24 24h1v1H24z';

const TOPICS = ['Coffee quality', 'Ambience', 'Staff friendliness'];

/**
 * Hero illustration: the customer's draft screen on a phone, next to the
 * printed counter card they scanned. Built in HTML rather than a screenshot so
 * it stays sharp and matches the real screens as they change. The example
 * business and draft are invented and contain no ratings data or counts.
 * There are no stars: customers choose their star rating on Google itself.
 */
export function ProductPreview() {
  return (
    <div
      role="img"
      aria-label="A phone showing a customer's draft Google review for a café, next to the café's printed counter card with a QR code"
      className="relative mx-auto w-full max-w-[22rem] select-none sm:max-w-[27rem]"
    >
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 top-10 rounded-2xl bg-paper" />

      {/* Phone */}
      <div className="relative ml-auto mr-1 w-[15.5rem] rounded-[2.2rem] border-[9px] border-gray-900 bg-white shadow-[0_24px_48px_-20px_rgba(8,22,54,0.45)] sm:mr-4 sm:w-[17.5rem]">
        <div className="flex items-center justify-between px-5 pt-2 text-[10px] font-semibold text-gray-900">
          <span>10:24</span>
          <span className="h-4 w-16 rounded-full bg-gray-900" />
          <span>5G</span>
        </div>
        <div className="px-4 pb-5 pt-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-700 text-[11px] font-bold text-white">K</span>
            <span className="text-[11px] font-medium text-gray-800">Kaveri Café</span>
            <span className="ml-auto text-[10px] text-gray-600">Step 2 of 2</span>
          </div>
          <div className="mt-2 h-1 rounded-full bg-gray-200">
            <div className="h-full w-full rounded-full bg-brand-900" />
          </div>

          <p className="mt-4 text-center text-[15px] font-bold text-gray-900">Your draft review</p>
          <p className="mt-2 text-center text-[10px] text-gray-600">You liked</p>
          <div className="mt-1 flex flex-wrap justify-center gap-1">
            {TOPICS.map((topic) => (
              <span key={topic} className="inline-flex items-center gap-0.5 rounded-full bg-brand-900 px-2 py-0.5 text-[10px] font-medium text-white">
                <Check className="h-2.5 w-2.5" /> {topic}
              </span>
            ))}
          </div>

          <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[9.5px] leading-snug text-amber-900">
            <strong>Drafted by AI</strong> from your taps. Check it matches your visit before posting.
          </p>
          <p className="mt-2 rounded-lg border border-gray-200 p-2.5 text-[11px] leading-relaxed text-gray-800">
            Lovely little café. The filter coffee was strong and fresh, and it’s a calm place to sit for an hour.
            The staff were friendly and never rushed us.
          </p>
          <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-brand-900 py-2 text-[11px] font-semibold text-white">
            <Copy className="h-3 w-3" /> Copy and open Google
          </div>
        </div>
      </div>

      {/* Counter card */}
      <div className="absolute bottom-8 left-0 w-[7.75rem] -rotate-3 rounded-xl border border-gray-200 bg-white p-3 text-center shadow-[0_16px_32px_-16px_rgba(8,22,54,0.35)] sm:w-[10rem]">
        <p className="text-[13px] font-bold text-gray-900">Kaveri Café</p>
        <p className="mt-0.5 text-[9.5px] leading-snug text-gray-600">How was your visit? Tell us about it.</p>
        <svg viewBox="-2 -2 29 29" className="mx-auto mt-2 h-auto w-full max-w-[6.5rem]" shapeRendering="crispEdges">
          <rect x="-2" y="-2" width="29" height="29" fill="#fff" />
          <path d={SITE_QR_PATH} fill="#0e2250" />
        </svg>
        <p className="mt-1.5 text-[9px] text-gray-700">Scan with your phone camera</p>
      </div>
    </div>
  );
}
