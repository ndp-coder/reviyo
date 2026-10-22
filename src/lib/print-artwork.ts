/**
 * Browser side of the printed QR artwork: the same template the server emails
 * to the printer (supabase/functions/_shared/print-artwork.ts, imported here so
 * the preview can never drift from what gets printed), fed with the same QR
 * code and link.
 */
import QRCode from 'qrcode';
import { reviewUrlFor } from '@/lib/review-source';
import {
  STAND_SOURCE,
  TENT_CARD_SOURCE,
  standSvg,
  tentCardSvg,
  type QrMatrix,
} from '../../supabase/functions/_shared/print-artwork';

export { STAND_SOURCE, TENT_CARD_SOURCE };

function qrMatrix(text: string): QrMatrix {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  return { size: modules.size, isDark: (row, col) => Boolean(modules.get(row, col)) };
}

/** The stand insert and the tent card for a business, as SVG text. */
export function printArtwork(businessName: string, slug: string): { stand: string; tentCard: string } {
  return {
    stand: standSvg(businessName, qrMatrix(reviewUrlFor(slug, STAND_SOURCE))),
    tentCard: tentCardSvg(businessName, qrMatrix(reviewUrlFor(slug, TENT_CARD_SOURCE))),
  };
}
