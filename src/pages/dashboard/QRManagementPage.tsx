import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Download, Copy, ExternalLink, Check, Printer } from 'lucide-react';
import QRCode from 'qrcode';
import { Alert, Card, Button, PageHeader } from '@/components/ui';
import { buttonClasses } from '@/components/ui/button-styles';
import { WhatsAppRequest } from '@/components/dashboard/WhatsAppRequest';
import { ExtraQrCodes } from '@/components/dashboard/ExtraQrCodes';
import type { Business } from '@/lib/types';

export function QRManagementPage() {
  const { business } = useOutletContext<{ business: Business | null }>();
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrSvg, setQrSvg] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);

  const reviewUrl = business ? `${window.location.origin}/r/${business.slug}` : '';

  useEffect(() => {
    if (!reviewUrl) return;
    QRCode.toDataURL(reviewUrl, { width: 600, margin: 2, color: { dark: '#1e293b', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch((error) => {
        console.error(error);
        setQrFailed(true);
      });
    QRCode.toString(reviewUrl, { type: 'svg', margin: 2, color: { dark: '#1e293b', light: '#ffffff' } })
      .then(setQrSvg)
      .catch(console.error);
  }, [reviewUrl]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  function copyUrl() {
    navigator.clipboard
      .writeText(reviewUrl)
      .then(() => {
        setCopyFailed(false);
        setCopied(true);
      })
      .catch(() => setCopyFailed(true));
  }

  function downloadSvg() {
    const blob = new Blob([qrSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${business?.slug ?? 'reviyo'}-qr.svg`;
    a.click();
    // Revoking immediately cancels the download in some browsers.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (!business) return null;

  return (
    <div>
      <PageHeader title="QR code" description="Put it where customers pay or wait. Scanning it opens your review page." />

      {qrFailed && (
        <Alert variant="error" className="mt-6">
          Your QR code couldn’t be drawn in this browser. Reload the page, or try another browser.
        </Alert>
      )}

      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        {/* QR preview */}
        <Card className="flex flex-col items-center p-5 sm:p-8">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR code linking to the review page for ${business.name} at ${reviewUrl}`}
              width={256}
              height={256}
              className="h-56 w-56 sm:h-64 sm:w-64"
            />
          ) : (
            <div className="h-56 w-56 animate-pulse rounded-lg bg-gray-100 sm:h-64 sm:w-64" aria-hidden="true" />
          )}
          <div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-2">
            {qrDataUrl ? (
              <a href={qrDataUrl} download={`${business.slug}-qr.png`} className={buttonClasses()}>
                <Download className="h-4 w-4" aria-hidden="true" /> Download PNG
              </a>
            ) : (
              <Button disabled>
                <Download className="h-4 w-4" aria-hidden="true" /> Download PNG
              </Button>
            )}
            <Button variant="outline" onClick={downloadSvg} disabled={!qrSvg}>
              <Download className="h-4 w-4" aria-hidden="true" /> Download SVG
            </Button>
            <Button variant="outline" onClick={copyUrl}>
              {copied ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              {copied ? 'Link copied' : 'Copy link'}
            </Button>
            <a href={reviewUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: 'outline' })}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> Preview
              <span className="sr-only">your review page (opens in a new tab)</span>
            </a>
          </div>
          <span className="sr-only" role="status" aria-live="polite">
            {copied ? 'Review page link copied' : ''}
          </span>
          {copyFailed && (
            <p role="alert" className="mt-3 text-center text-sm text-red-700">
              Couldn’t copy automatically. Select the link below and copy it.
            </p>
          )}
          <div className="mt-4 text-xs text-gray-600 break-all text-center max-w-xs select-all">{reviewUrl}</div>
        </Card>

        {/* Printable counter card. Printing shows only this card (see the
            print rules in index.css), sized for an A5/A4 sheet. */}
        <Card className="p-5 sm:p-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-900">Printable counter card</h2>
            <Button size="sm" variant="outline" onClick={() => window.print()} disabled={!qrDataUrl}>
              <Printer className="h-4 w-4" aria-hidden="true" /> Print card
            </Button>
          </div>
          <div className="print-area rounded-xl border-2 border-gray-200 bg-white p-6 text-center sm:p-8 print:mx-auto print:max-w-md print:border-gray-400 print:p-10">
            {business.logo_url && (
              <img src={business.logo_url} alt="" className="mx-auto mb-3 h-16 w-16 rounded-lg object-cover print:h-20 print:w-20" />
            )}
            <h3 className="text-lg font-bold text-gray-900 print:text-2xl">{business.name}</h3>
            <p className="mt-1 text-sm text-gray-600 print:text-base">Enjoyed your visit? Tell us about it.</p>
            {qrDataUrl && <img src={qrDataUrl} alt="" className="mx-auto mt-4 h-40 w-40 rounded-lg print:h-64 print:w-64" />}
            <p className="mt-3 text-xs text-gray-700 print:text-sm">Scan with your phone camera to write a review</p>
          </div>
          <p className="mt-4 text-xs text-gray-600">
            Print it and place it at your cash counter, reception desk, or billing area — anywhere customers wait a
            moment.
          </p>
        </Card>
      </div>

      {/* More ways to reach customers: a WhatsApp message after the visit, and
          separate codes per spot so Analytics can compare them. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <WhatsAppRequest business={business} />
        <ExtraQrCodes business={business} />
      </div>
    </div>
  );
}
