import { supabase } from '@/lib/supabase';
import { normalizeIndianMobile } from '@/config/india';
import type { DeliveryAddress, QrPrintOrder } from '@/lib/types';

export interface PrintKitState {
  order: QrPrintOrder | null;
  address: DeliveryAddress | null;
}

/** The business's printed QR kit order (if it has earned one) and saved address. */
export async function loadPrintKit(businessId: string): Promise<PrintKitState | null> {
  const [orderRes, addressRes] = await Promise.all([
    supabase.from('qr_print_orders').select('*').eq('business_id', businessId).maybeSingle(),
    supabase.from('delivery_addresses').select('*').eq('business_id', businessId).maybeSingle(),
  ]);
  if (orderRes.error || addressRes.error) return null;
  return {
    order: (orderRes.data as QrPrintOrder | null) ?? null,
    address: (addressRes.data as DeliveryAddress | null) ?? null,
  };
}

export interface AddressInput {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
}

/**
 * Saves the delivery address (the database checks and tidies every field) and,
 * if a paid order was waiting for it, asks the server to send it to the printer
 * now rather than on the next scheduled run.
 */
export async function saveDeliveryAddress(
  businessId: string,
  input: AddressInput,
): Promise<{ order: QrPrintOrder | null } | { error: string }> {
  const { data, error } = await supabase.rpc('save_delivery_address', {
    p_business_id: businessId,
    p_recipient_name: input.recipientName,
    p_phone: normalizeIndianMobile(input.phone),
    p_address_line1: input.addressLine1,
    p_address_line2: input.addressLine2,
    p_city: input.city,
    p_state: input.state,
    p_pincode: input.pincode,
  });
  if (error) {
    // Messages raised by save_delivery_address are written for owners.
    return { error: error.code === 'P0001' ? error.message : 'We couldn’t save the address. Check it and try again.' };
  }

  let order = (data as QrPrintOrder | null) ?? null;
  if (order?.status === 'ready') {
    try {
      await supabase.functions.invoke('send-print-order', { body: { business_id: businessId } });
      const refreshed = await supabase.from('qr_print_orders').select('*').eq('business_id', businessId).maybeSingle();
      if (!refreshed.error && refreshed.data) order = refreshed.data as QrPrintOrder;
    } catch {
      // The scheduler sends it on its next run.
    }
  }
  return { order };
}
