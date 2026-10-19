/** The printable card used in the owner dashboard and the public preview. */
export function ReviewCounterCard({
  businessName,
  logoUrl,
  qrImage,
  qrAlt = `QR code for ${businessName}'s review page`,
  printable = true,
}: {
  businessName: string;
  logoUrl?: string | null;
  qrImage?: string;
  qrAlt?: string;
  printable?: boolean;
}) {
  return <div className={`${printable ? 'print-area ' : ''}counter-card rounded-xl border-2 border-gray-200 bg-white p-6 text-center sm:p-8 print:mx-auto print:max-w-md print:border-gray-400 print:p-10`}>
    {logoUrl && <img src={logoUrl} alt="" className="mx-auto mb-3 h-16 w-16 rounded-lg object-cover print:h-20 print:w-20" />}
    <h3 className="text-lg font-bold text-gray-900 print:text-2xl">{businessName}</h3>
    <p className="mt-1 text-sm text-gray-600 print:text-base">How was your visit? Tell us about it.</p>
    {qrImage && <img src={qrImage} alt={qrAlt} className="mx-auto mt-4 h-40 w-40 rounded-lg print:h-64 print:w-64" />}
    <p className="mt-3 text-xs text-gray-700 print:text-sm">Scan with your phone camera to write a review</p>
  </div>;
}
