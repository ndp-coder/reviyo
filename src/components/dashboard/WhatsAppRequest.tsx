import { useEffect, useState } from 'react';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { Button, Card, Textarea } from '@/components/ui';
import { buttonClasses } from '@/components/ui/button-styles';
import { reviewUrlFor, WHATSAPP_SOURCE } from '@/lib/review-source';
import type { Business } from '@/lib/types';

const storageKey = (businessId: string) => `reviyo:whatsapp-message:${businessId}`;

// Neutral on purpose: it asks for honest feedback, not a 5-star review.
// Asking only happy customers, or asking for a particular rating, breaks
// Google's review policy and the Terms.
const defaultMessage = (businessName: string) =>
  `Hi! Thank you for visiting ${businessName}. If you have a minute, we'd really value your honest feedback about your visit:`;

/**
 * A ready-to-send WhatsApp message with the review page link. Opening
 * WhatsApp lets the owner pick the customer; nothing is sent automatically and
 * no phone numbers pass through Reviyo. The link carries ?src=whatsapp so
 * Analytics can show how many reviews these messages bring in.
 */
export function WhatsAppRequest({ business }: { business: Business }) {
  const link = reviewUrlFor(window.location.origin, business.slug, WHATSAPP_SOURCE);
  const [message, setMessage] = useState(() => {
    try {
      return localStorage.getItem(storageKey(business.id)) ?? defaultMessage(business.name);
    } catch {
      return defaultMessage(business.name);
    }
  });
  const [copied, setCopied] = useState(false);

  // The owner's wording is remembered in this browser, so it is ready next time.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey(business.id), message);
    } catch {
      // Storage can be unavailable (private mode); the message still works.
    }
  }, [business.id, message]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const fullText = `${message.trim()}\n${link}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`;

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-green-800" aria-hidden="true">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">Ask on WhatsApp</h2>
          <p className="mt-0.5 text-sm text-gray-600">
            Send your review link after a visit or an order. Most customers who aren&apos;t asked never leave a review.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Textarea
          label="Your message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={500}
          hint={
            <>
              Your review link is added at the end: <span className="break-all font-mono">{link}</span>
            </>
          }
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!message.trim() || undefined}
          onClick={(e) => {
            if (!message.trim()) e.preventDefault();
          }}
          className={`${buttonClasses()} ${!message.trim() ? 'pointer-events-none opacity-50' : ''}`}
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" /> Open WhatsApp
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        <Button
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(fullText).then(() => setCopied(true)).catch(() => undefined);
          }}
        >
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy message'}
        </Button>
        {message !== defaultMessage(business.name) && (
          <Button variant="ghost" onClick={() => setMessage(defaultMessage(business.name))}>
            Reset wording
          </Button>
        )}
      </div>
      <span className="sr-only" role="status" aria-live="polite">{copied ? 'Message copied' : ''}</span>

      <p className="mt-4 text-xs text-gray-600">
        Send it to every customer, not only the happy ones — choosing who to ask breaks Google&apos;s review rules.
        WhatsApp opens so you can pick the contact; nothing is sent automatically.
      </p>
    </Card>
  );
}
