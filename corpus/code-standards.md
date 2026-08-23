# Code Standards

<!-- Implementation rules for this project's stack.
     Pre-filled with the default stack conventions. Update per project as needed.
     The AI follows these rules — if something isn't here, it defaults to its own habits. -->

---

## General

- Keep modules small and single-purpose.
- Fix root causes — do not layer workarounds on top of broken behavior.
- Do not mix unrelated concerns in one component or route.
- Respect the system boundaries defined in `architecture-context.md`.
- Name files after the responsibility they contain, not the technology.

---

## TypeScript

- Strict mode is required throughout the project.
- Never use `any`. Use explicit interfaces or narrowly scoped generic types.
- Use `interface` for object contracts (props, API shapes, DB models).
- Use `type` for unions, intersections, and derived types.
- Validate all unknown external input (user input, API responses, env vars) with Zod at the boundary before trusting it inside the app.

---

## Next.js

- Default to React Server Components (RSC). Do not add `"use client"` unless the component specifically needs browser interactivity, React hooks, or real-time state.
- Keep route handlers focused on a single responsibility: validate → check auth → act → respond.
- Long-running work belongs in background tasks, not in request handlers.
- Do not fetch data inside client components when a server component can do it.
- Use `next/image` for all images. Use `next/font` for all fonts.
- **URL-based conditional logic** (e.g. "is this the homepage?") requires `'use client'` and `usePathname()`. There is no Server Component alternative in Next.js 16 — this is intentional by design, not a limitation.
- **`'use client'` boundary and render-props:** functions cannot be passed from a Server Component to a Client Component across the serialization boundary. If a client component needs a render-prop callback, its parent must also be `'use client'`. Design the client island to wrap the Server Component children, not the other way round.

### Server Actions — return shape

All Server Actions must return a structured result via `ActionResult<T>` from `lib/types.ts`. Never throw to the client:

```typescript
import type { ActionResult } from '@/lib/types'

export async function myAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  // validate → auth check → act
  return { success: true, data: { id: '...' } }
  // or
  return { success: false, error: 'errors.generic' }
}
```

The `error` field is always a translation key string, not a raw message.

### Caching invalidation

This project uses `revalidatePath()` for cache invalidation after mutations. Do **not** use `revalidateTag()` — the single-argument form `revalidateTag('tag')` is **broken in Next.js 16** (requires a second `{ expire: 0 }` argument). Stick to `revalidatePath`.

`use cache` (stable in Next.js 16) and `cacheComponents: true` are deliberately deferred — do not enable without a feature spec. See `context/references/nextjs-16-2.md`.

> **Keep these rules current.** Next.js ships frequently. Before implementing a pattern that feels like a workaround, check https://nextjs.org/docs for the latest App Router guidance. The project currently runs **Next.js 16.2** — verify any new pattern against that version specifically.

---

## Styling

- Use CSS custom property tokens defined in `globals.css` — never raw Tailwind color classes (`zinc-*`, `slate-*`) or hardcoded hex values.
- Reference tokens through their Tailwind utility names as defined in `ui-context.md`.
- Follow the border radius scale from `ui-context.md` exactly.
- Do not write custom CSS unless Tailwind utilities cannot achieve the result.
- Responsive design: mobile-first. Add breakpoint variants only where the layout actually changes.

---

## Validation (Zod)

- Define Zod schemas for all API request bodies, API responses consumed by the app, and form data before it reaches business logic.
- Co-locate schemas with the code that uses them (e.g. schema in the same file as the route handler or form).
- Infer TypeScript types from Zod schemas with `z.infer<typeof Schema>` — do not write duplicate type definitions.

---

## Forms

- Use `react-hook-form` with Zod resolver via `@hookform/resolvers/zod`.
- Use shadcn/ui `Form`, `FormField`, `FormItem`, `FormLabel`, `FormMessage` wrappers.
- Show field-level error messages inline. Show server-level errors as a toast or inline summary.

---

## Email (Resend)

- All email sending happens in server-side code only (Server Actions or API routes) — never in client components.
- Use React Email templates. Templates live in `lib/email/templates/`. Sending logic is in `lib/email/send.ts`.
- Always handle Resend API errors explicitly — do not let email failures crash the main request silently.

---

## API Routes

- Validate and parse request input before any logic runs.
- Enforce auth and ownership before any mutation.
- Return consistent response shapes: `{ data }` on success, `{ error: string }` on failure.
- Use appropriate HTTP status codes.
- Keep route handlers thin — push complexity into `lib/` or background tasks.

---

## Internationalisation (next-intl)

> Verified against **next-intl v4.12.0** (May 2026). If a major version has shipped since then, re-verify the patterns below at https://next-intl.dev/docs before implementing.

### Server-side redirect

Use `redirect` from `@/i18n/navigation` — never from `next/navigation`. Always use `return redirect(...)` so TypeScript narrows correctly after the guard:

```typescript
import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/routing'

// In pages/layouts with params:
const { locale } = await params
if (!user) return redirect({ href: '/signin', locale: locale as Locale })

// In layouts without params (e.g. admin/operator shells):
const locale = await getLocale() as Locale
if (!user) return redirect({ href: '/signin', locale })
```

`redirect` from `@/i18n/navigation` does not return `never` in TypeScript's control-flow analysis — the `return` is required to narrow types correctly after the call.

### Hook import source

Always import locale-aware hooks from `@/i18n/navigation`, **not** from `next/navigation`:

```ts
// ✅ correct — locale-aware
import { useRouter, usePathname, Link } from '@/i18n/navigation'

// ❌ wrong — locale-unaware; causes double-locale URLs and broken locale switching
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
```

**Key difference:** `usePathname()` from `@/i18n/navigation` returns the path **without** the locale prefix (`/pricing`, not `/en/pricing`). Use this when you need to compare or reuse the path for navigation.

### Locale switching

```ts
const router = useRouter()
const pathname = usePathname() // locale-stripped: '/', '/pricing', etc.

// Switch locale, stay on current path
router.replace(pathname, { locale: 'de' })
```

### Translations — Server vs Client

| Context | Hook | Import |
|---|---|---|
| Server Component | `getTranslations('namespace')` | `'next-intl/server'` |
| Client Component | `useTranslations('namespace')` | `'next-intl'` |

Prefer `getTranslations` in Server Components — messages never leave the server. Use `useTranslations` in Client Components only when the component must be client-side for other reasons (e.g. it already uses `useState`, `usePathname`, etc.). Translating a few short strings in a client component (like a navbar) is acceptable; translating large bodies of copy is not.

### Homepage detection

`usePathname()` from `@/i18n/navigation` strips the locale, so homepage detection is always:

```ts
const pathname = usePathname()
const isHome = pathname === '/' || pathname === ''
```

No `useLocale()` needed. No string length tricks. No regex.

---

## File Organization

```
lib/                    shared infrastructure: DB client, auth helpers, utilities
lib/types.ts            shared TypeScript types (ActionResult<T>, etc.)
lib/email/templates/    React Email templates
lib/email/send.ts       email dispatch (typed union — extend when adding templates)
components/ui/          shadcn/ui foundation — do not modify
components/             app-level components grouped by feature
app/actions/            Server Actions (all mutations — never in components or lib/)
app/api/                route handlers (thin — external webhooks and downloads only)
```