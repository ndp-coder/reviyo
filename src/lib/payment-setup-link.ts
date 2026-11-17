const PAYMENT_SETUP_PARAM = 'payment_setup';

export function readPaymentSetup(search: string): string | null {
  const id = new URLSearchParams(search).get(PAYMENT_SETUP_PARAM);
  return id && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

export function paymentSetupPath(path: '/onboarding' | '/login' | '/signup', id?: string | null): string {
  return id ? `${path}?${PAYMENT_SETUP_PARAM}=${encodeURIComponent(id)}` : path;
}
