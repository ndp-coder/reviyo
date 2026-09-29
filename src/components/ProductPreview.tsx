import { BatteryFull, Globe, Settings, Signal, SwitchCamera, Wifi, ZapOff } from 'lucide-react';

// A real QR code for https://www.reviyo.in (25×25 modules, error correction M),
// precomputed so the landing page does not have to ship the QR library. This is
// every dark module except the three corner finder patterns, which are drawn
// separately below with rounded corners.
const SITE_QR_DATA_PATH =
  'M8 0h1v1H8zM10 0h1v1H10zM14 0h1v1H14zM8 1h2v1H8zM12 1h1v1H12zM16 1h1v1H16zM8 2h2v1H8zM11 2h6v1H11zM9 3h3v1H9zM13 3h3v1H13zM8 4h2v1H8zM13 4h2v1H13zM16 4h1v1H16zM9 5h2v1H9zM13 5h2v1H13zM8 6h1v1H8zM10 6h1v1H10zM12 6h1v1H12zM14 6h1v1H14zM16 6h1v1H16zM10 7h5v1H10zM0 8h1v1H0zM3 8h10v1H3zM14 8h1v1H14zM16 8h2v1H16zM20 8h1v1H20zM22 8h3v1H22zM0 9h1v1H0zM3 9h2v1H3zM7 9h1v1H7zM9 9h7v1H9zM17 9h1v1H17zM19 9h5v1H19zM0 10h3v1H0zM4 10h3v1H4zM8 10h2v1H8zM14 10h2v1H14zM18 10h2v1H18zM21 10h1v1H21zM24 10h1v1H24zM0 11h4v1H0zM8 11h2v1H8zM11 11h1v1H11zM14 11h2v1H14zM19 11h1v1H19zM21 11h4v1H21zM0 12h1v1H0zM3 12h1v1H3zM5 12h2v1H5zM8 12h1v1H8zM11 12h2v1H11zM15 12h1v1H15zM18 12h1v1H18zM24 12h1v1H24zM0 13h1v1H0zM2 13h1v1H2zM4 13h1v1H4zM7 13h1v1H7zM9 13h1v1H9zM14 13h4v1H14zM20 13h1v1H20zM23 13h1v1H23zM0 14h4v1H0zM6 14h2v1H6zM9 14h1v1H9zM11 14h2v1H11zM14 14h2v1H14zM17 14h2v1H17zM20 14h5v1H20zM0 15h1v1H0zM5 15h1v1H5zM11 15h1v1H11zM14 15h1v1H14zM17 15h1v1H17zM19 15h1v1H19zM21 15h2v1H21zM24 15h1v1H24zM0 16h1v1H0zM2 16h3v1H2zM6 16h2v1H6zM9 16h1v1H9zM14 16h7v1H14zM22 16h2v1H22zM8 17h6v1H8zM16 17h1v1H16zM20 17h1v1H20zM22 17h2v1H22zM8 18h2v1H8zM11 18h1v1H11zM16 18h1v1H16zM18 18h1v1H18zM20 18h1v1H20zM24 18h1v1H24zM8 19h1v1H8zM10 19h1v1H10zM12 19h1v1H12zM14 19h3v1H14zM20 19h1v1H20zM23 19h2v1H23zM8 20h1v1H8zM12 20h9v1H12zM23 20h2v1H23zM8 21h1v1H8zM14 21h1v1H14zM18 21h1v1H18zM23 21h2v1H23zM9 22h2v1H9zM12 22h1v1H12zM14 22h2v1H14zM17 22h1v1H17zM20 22h5v1H20zM9 23h1v1H9zM14 23h2v1H14zM19 23h2v1H19zM22 23h3v1H22zM8 24h1v1H8zM10 24h1v1H10zM13 24h2v1H13zM16 24h2v1H16zM21 24h1v1H21zM24 24h1v1H24z';

const FINDER_ORIGINS = [
  [0, 0],
  [18, 0],
  [0, 18],
] as const;

// The phone is held at a slight angle. The card seen through its camera is
// turned back by the same amount, so it lines up with the real one.
const PHONE_TILT = 'rotate-[-5deg]';
const FEED_TILT = 'rotate-[5deg]';

/**
 * Hero illustration: a customer's phone camera scanning the QR code on a café's
 * counter card, with the link the phone offers to open. Built in HTML rather
 * than a picture so it stays sharp at any size. The example business is
 * invented, and the card asks every customer the same neutral question.
 *
 * Everything inside is sized in `em`, and the font size follows the width of
 * the container, so the whole scene scales as one picture instead of
 * reflowing on small screens.
 */
export function ProductPreview() {
  return (
    <div
      role="img"
      aria-label="A phone camera scanning the QR code on a café's counter card, ready to open the café's review page"
      className="mx-auto w-full max-w-[30rem] select-none [container-type:inline-size]"
    >
      <div className="relative h-[33em] w-[30em] [font-size:min(1rem,3.3333cqw)]">
        {/* The counter */}
        <div className="absolute inset-x-0 bottom-0 top-[3em] overflow-hidden rounded-[1.5em] bg-paper">
          <div className="absolute inset-x-0 bottom-0 h-[8em] border-t border-stone-300 bg-stone-200/70" />
        </div>

        <div className="absolute bottom-[4.25em] left-[1.5em] w-[12em]">
          <CounterCard />
          {/* Stand */}
          <div className="relative -mx-[0.6em] -mt-[0.6em] h-[1.5em] rounded-[0.35em] border-t-[0.35em] border-brand-700 bg-brand-900 shadow-[0_0.6em_1em_-0.4em_rgba(8,22,54,0.5)]" />
        </div>
        <Phone />
      </div>
    </div>
  );
}

/** The printed card. `scanning` adds the camera's frame around the code. */
function CounterCard({ scanning = false }: { scanning?: boolean }) {
  return (
    <div className="rounded-[1em] border border-gray-200 bg-white px-[1em] pb-[1.4em] pt-[1.2em] text-center shadow-[0_1.5em_2.5em_-1.25em_rgba(8,22,54,0.35)]">
      <div className="flex items-center justify-center gap-[0.45em]">
        <span className="flex h-[1.6em] w-[1.6em] items-center justify-center rounded-[0.4em] bg-accent-700 text-white">
          <span className="text-[0.75em] font-bold">K</span>
        </span>
        <span className="text-[0.9em] font-bold text-gray-900">Kaveri Café</span>
      </div>
      <p className="mt-[0.6em] text-[0.62em] leading-snug text-gray-600">How was your visit? Tell us about it.</p>

      <div className="relative mx-auto mt-[0.9em] h-[8.5em] w-[8.5em]">
        {scanning && (
          <span className="absolute -inset-[0.5em]">
            <span className="absolute left-0 top-0 h-[1.4em] w-[1.4em] rounded-tl-[0.5em] border-l-[0.22em] border-t-[0.22em] border-accent-500" />
            <span className="absolute right-0 top-0 h-[1.4em] w-[1.4em] rounded-tr-[0.5em] border-r-[0.22em] border-t-[0.22em] border-accent-500" />
            <span className="absolute bottom-0 left-0 h-[1.4em] w-[1.4em] rounded-bl-[0.5em] border-b-[0.22em] border-l-[0.22em] border-accent-500" />
            <span className="absolute bottom-0 right-0 h-[1.4em] w-[1.4em] rounded-br-[0.5em] border-b-[0.22em] border-r-[0.22em] border-accent-500" />
          </span>
        )}
        <svg viewBox="0 0 25 25" className="h-full w-full">
          <path d={SITE_QR_DATA_PATH} className="fill-brand-900" shapeRendering="crispEdges" />
          {FINDER_ORIGINS.map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <rect x={x + 0.5} y={y + 0.5} width="6" height="6" rx="1.6" className="fill-none stroke-brand-900" strokeWidth="1" />
              <rect x={x + 2} y={y + 2} width="3" height="3" rx="0.8" className="fill-brand-900" />
            </g>
          ))}
        </svg>
      </div>

      <p className="mt-[0.9em] whitespace-nowrap text-[0.56em] font-medium text-gray-700">Scan with your phone camera</p>
    </div>
  );
}

function Phone() {
  return (
    <div
      className={`absolute right-[1.75em] top-[0.75em] h-[29.5em] w-[13.75em] ${PHONE_TILT} rounded-[2.3em] bg-gray-900 p-[0.45em] shadow-[inset_0_0_0_0.12em_#4b5563,0_2em_3em_-1.5em_rgba(8,22,54,0.55)]`}
    >
      {/* Side buttons */}
      <span className="absolute -left-[0.15em] top-[6em] h-[2.2em] w-[0.15em] rounded-l-[0.1em] bg-gray-700" />
      <span className="absolute -left-[0.15em] top-[8.8em] h-[2.2em] w-[0.15em] rounded-l-[0.1em] bg-gray-700" />
      <span className="absolute -right-[0.15em] top-[7.4em] h-[3.4em] w-[0.15em] rounded-r-[0.1em] bg-gray-700" />

      <div className="flex h-full flex-col overflow-hidden rounded-[1.9em] bg-black text-white">
        {/* Status bar and camera controls */}
        <div className="flex h-[2.45em] flex-shrink-0 items-center justify-between px-[1.35em] pt-[0.15em]">
          <span className="text-[0.62em] font-semibold">10:24</span>
          <span className="flex items-center gap-[0.2em]">
            <Signal className="h-[0.75em] w-[0.75em]" strokeWidth={2.5} />
            <Wifi className="h-[0.75em] w-[0.75em]" strokeWidth={2.5} />
            <BatteryFull className="h-[0.85em] w-[0.85em]" strokeWidth={2} />
          </span>
        </div>
        <div className="flex h-[1.9em] flex-shrink-0 items-center justify-between px-[1.1em]">
          <ZapOff className="h-[0.9em] w-[0.9em]" />
          <Settings className="h-[0.9em] w-[0.9em]" />
        </div>

        {/* Viewfinder: the same counter, seen through the camera */}
        <div className="relative h-[17em] flex-shrink-0 overflow-hidden bg-stone-300">
          <div className={`absolute inset-0 ${FEED_TILT}`}>
            <div className="absolute -inset-x-[3em] -bottom-[3em] h-[8.5em] border-t border-stone-400 bg-stone-400/60" />
            <div className="absolute left-1/2 top-[0.6em] w-[12em] -translate-x-1/2 text-[0.76em]">
              <CounterCard scanning />
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-[0.9em] flex justify-center">
            <span className="flex h-[2.1em] items-center gap-[0.4em] rounded-full bg-white pl-[0.6em] pr-[0.8em] text-gray-900 shadow-[0_0.4em_1em_-0.2em_rgba(0,0,0,0.45)]">
              <span className="flex h-[1.3em] w-[1.3em] items-center justify-center rounded-full bg-accent-700 text-white">
                <Globe className="h-[0.8em] w-[0.8em]" strokeWidth={2.5} />
              </span>
              <span className="whitespace-nowrap text-[0.56em] font-semibold">reviyo.in/r/kaveri-cafe</span>
            </span>
          </div>
        </div>

        {/* Shutter */}
        <div className="flex flex-1 flex-col justify-center">
          <div className="flex justify-center gap-[1.2em]">
            <span className="text-[0.52em] font-medium">Video</span>
            <span className="text-[0.52em] font-semibold text-amber-300">Photo</span>
            <span className="text-[0.52em] font-medium">Portrait</span>
          </div>
          <div className="mt-[0.8em] flex items-center justify-between px-[1.5em]">
            <span className="h-[2em] w-[2em] rounded-[0.45em] border border-gray-600 bg-stone-500" />
            <span className="flex h-[3.3em] w-[3.3em] items-center justify-center rounded-full border-[0.22em] border-white">
              <span className="h-[2.55em] w-[2.55em] rounded-full bg-white" />
            </span>
            <span className="flex h-[2em] w-[2em] items-center justify-center rounded-full bg-gray-800">
              <SwitchCamera className="h-[1em] w-[1em]" />
            </span>
          </div>
        </div>
        <span className="mx-auto mb-[0.45em] h-[0.22em] w-[4.8em] flex-shrink-0 rounded-full bg-white" />
      </div>
    </div>
  );
}
