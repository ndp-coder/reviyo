import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Alert } from '@/components/ui';

/** Reminds a paying owner to add the address for their free printed QR kit. */
export function PrintKitNudge({ businessId }: { businessId: string }) {
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('qr_print_orders')
      .select('status')
      .eq('business_id', businessId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setWaiting(data?.status === 'awaiting_address');
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  if (!waiting) return null;
  return (
    <Alert
      variant="warning"
      className="mt-6"
      action={
        <Link to="/dashboard/qr" className="whitespace-nowrap text-sm font-semibold underline underline-offset-2">
          Add address
        </Link>
      }
    >
      Your free printed QR stand and table card are ready to print. Add your delivery address so we can send them.
    </Alert>
  );
}
