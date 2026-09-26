import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
export const supabasePublicKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();

if (!supabaseUrl || !supabasePublicKey) {
  throw new Error(
    'Missing Supabase configuration. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local.'
  );
}

try {
  const parsedUrl = new URL(supabaseUrl);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error();
} catch {
  throw new Error('VITE_SUPABASE_URL must be a valid http(s) URL.');
}

export const supabase = createClient(supabaseUrl, supabasePublicKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
