import { useEffect, useRef, useState } from 'react';
import { Copy, Download } from 'lucide-react';
import QRCode from 'qrcode';
import { Alert, Button, Card, Skeleton } from '@/components/ui';
import { buttonClasses } from '@/components/ui/button-styles';
import { copyText } from '@/lib/clipboard';
import { paymentSetupPath } from '@/lib/payment-setup-link';
import { PUBLIC_SITE_ORIGIN } from '@/lib/review-source';

export function PaymentSetupQr({ id, name, email }: { id: string; name: string; email: string }) {
  const url = `${PUBLIC_SITE_ORIGIN}${paymentSetupPath('/onboarding', id)}`;
  const [qr, setQr] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let cancelled = false;
    heading.current?.focus();
    void QRCode.toDataURL(url, { width: 640, margin: 4, errorCorrectionLevel: 'M' }).then((image) => {
      if (!cancelled) setQr(image);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [url]);

  return (
    <Card className="mt-6 grid gap-5 border-brand-200 bg-brand-50 p-5 sm:grid-cols-[10rem_1fr] sm:items-center">
      {qr ? <img src={qr} width={160} height={160} alt={`Payment QR code for ${name}`} className="rounded-md border border-gray-200 bg-white" />
        : failed ? <Alert variant="error">Could not generate the QR image. You can still share the payment link.</Alert>
        : <Skeleton className="h-40 w-40" />}
      <div className="min-w-0 space-y-3">
        <h3 ref={heading} tabIndex={-1} className="break-words text-base font-semibold">Payment QR code for {name}</h3>
        <p className="break-words text-sm text-gray-700">Share this with the owner. They sign in as <strong>{email}</strong>, review their setup and pay for a plan through Razorpay.</p>
        <a href={url} target="_blank" rel="noreferrer" className="block break-all text-sm font-medium text-brand-800 underline">{url}</a>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={async () => setCopyMessage(await copyText(url) ? 'Payment link copied.' : 'Select the link above to copy it.')}>
            <Copy className="h-4 w-4" aria-hidden="true" />Copy payment link
          </Button>
          {qr && <a href={qr} download={`reviyo-payment-${id}.png`} className={buttonClasses({ variant: 'outline', size: 'sm' })}>
            <Download className="h-4 w-4" aria-hidden="true" />Download PNG
          </a>}
        </div>
        <p role="status" className="text-sm text-gray-700">{copyMessage}</p>
      </div>
    </Card>
  );
}
