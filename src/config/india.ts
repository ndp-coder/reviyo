/**
 * India's 28 states and 8 union territories, for delivery addresses. The
 * database accepts exactly these names (delivery_addresses.state); a test
 * keeps the two lists identical.
 */
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

/** A 10-digit Indian mobile number from what people type: "+91 98765 43210", "098765 43210". */
export function normalizeIndianMobile(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 14 && digits.startsWith('0091')) digits = digits.slice(4);
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

export const isIndianMobile = (digits: string) => /^[6-9]\d{9}$/.test(digits);
export const isIndianPincode = (value: string) => /^[1-9]\d{5}$/.test(value.trim());
