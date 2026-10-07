import { useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Alert, Button, Card, Input, PageHeader } from '@/components/ui';
import { BrandLogo } from '@/components/BrandLogo';

export function PartnerPasswordSetup({ email, onComplete }: { email: string; onComplete: () => Promise<void> }) {
  const { updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    if (password !== confirmation) { setError('The passwords do not match.'); return; }
    saving.current = true; setBusy(true); setError(null);
    try {
      const result = await updatePassword(password);
      if (result.error) throw new Error(result.error);
      await onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your password. Please try again.');
    } finally { saving.current = false; setBusy(false); }
  }

  return <main id="main-content" className="mx-auto max-w-md px-4 py-12">
    <BrandLogo className="h-10 w-auto" />
    <PageHeader title="Create your partner password" description="Your invitation verified your email. Set a password to finish joining the private partner dashboard." />
    <Card className="mt-6 p-6">
      <p className="break-all text-sm text-gray-600">Invited email: <strong>{email}</strong></p>
      {error && <Alert variant="error" className="mt-4">{error}</Alert>}
      <form onSubmit={submit} className="mt-5 space-y-4">
        <Input label="New password" type="password" autoComplete="new-password" required minLength={8} revealable hint="At least 8 characters. Use a password you don’t use elsewhere." value={password} onChange={e => setPassword(e.target.value)} disabled={busy} />
        <Input label="Confirm password" type="password" autoComplete="new-password" required minLength={8} revealable value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} />
        <Button type="submit" loading={busy} className="w-full">Create password and continue</Button>
      </form>
    </Card>
    <Button variant="ghost" className="mt-4" disabled={busy} onClick={() => void signOut()}>Sign out</Button>
  </main>;
}
