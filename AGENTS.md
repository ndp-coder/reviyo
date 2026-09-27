# Reviyo — notes for AI coding assistants

React 18 + Vite + TypeScript + Tailwind frontend, Supabase (Postgres, Edge
Functions) backend, Razorpay payments. Production Supabase project:
`yagchgwgbttxfihlyddm`.

## Conventions
- Import project modules with the `@/` alias (`@/components/Foo` = `src/components/Foo`), not deep relative paths.
- Icons come from `lucide-react`. Don't add UI kits, icon packs, or animation libraries.
- Build UI from the shared primitives in `src/components/ui` (`Button`, `Input`, `Select`, `Alert`, `Card`, `IconButton`, …). For links styled as buttons use `buttonClasses()` from `src/components/ui/button-styles.ts`.
- Plan prices shown in the UI come only from `src/config/plans.ts`. Legal and business details come from `src/config/legal.ts`.
- Sentence case for headings, labels, and buttons.

## Rules that must not be broken
- Never gate or filter who is asked for a Google review, never offer incentives, and never post on the customer's behalf. This is Google policy and in the Terms.
- Consent checkboxes start unticked (DPDPA).
- New database functions callable from the browser need explicit `REVOKE`/`GRANT`; server-only ones are revoked from `PUBLIC, anon, authenticated`.
- Never commit `.env.local` or other secrets.

## Checks
`npm run typecheck`, `npm run lint`, `npm test`. The "BEFORE LAUNCH" test fails
on purpose until the `TODO_` values in `src/config/legal.ts` are filled in, and
`npm run build` refuses to build until then.
