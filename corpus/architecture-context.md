# Architecture Context

<!-- This file is the technical specification for how the system is built.
     It combines the tech spec, architecture diagram (described in prose), project tree, and system invariants.
     The AI must not violate the invariants defined here, even if a shortcut is technically possible. -->

---

## Stack

| Layer | Technology | Version | Role | Why This Choice |
| ----- | ---------- | ------- | ---- | --------------- |
| **Framework** | Next.js | 16.2.4 | Full-stack React framework with App Router | Server Components, Server Actions, built-in i18n support, Turbopack bundler |
| **Runtime** | React | 19.2.4 | UI library | Latest stable with Server Components support |
| **Language** | TypeScript | 5.x | Type safety across codebase | Compile-time error detection, better DX |
| **Bundler** | Turbopack | (built-in) | Development and production builds | Default in Next.js 16+, faster than Webpack |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS framework | Design token integration, rapid UI development |
| **UI Components** | shadcn/ui | n/a | Composable component library | Built on Radix UI, fully customizable, no runtime overhead |
| **Database** | Supabase PostgreSQL | supabase-js 2.105 | Relational data persistence | Managed Postgres, real-time subscriptions, row-level security |
| **ORM** | Drizzle ORM | 0.45 | Type-safe database access | Lightweight, SQL-like syntax, excellent TypeScript support |
| **Auth** | Supabase Auth | supabase-js 2.105 | User authentication and sessions | Email/password, OAuth providers, JWT-based sessions |
| **Storage** | Supabase Storage | supabase-js 2.105 | Document and file storage | S3-compatible, integrated with Supabase Auth for access control |
| **Payments** | Stripe | 22.1 | Payment processing and webhooks | Industry standard, supports EU and international cards, webhook reliability |
| **Email** | Resend | 6.12 | Transactional email delivery | React Email templates, excellent deliverability, simple API |
| **Validation** | Zod | 4.4 | Runtime schema validation | Type inference, composable schemas, form validation |
| **i18n** | next-intl | 4.11 | Internationalization | App Router support, type-safe translations, locale routing |
| **AI** | Groq (Llama 4 Scout) | groq-sdk 1.2 | Document review and validation | Fast inference via `groq-sdk`, PDF text extraction via `pdfjs-dist`, cost-effective |

---

## Project Tree

```
nif3/
├── app/                          # Next.js 16 App Router
│   ├── [locale]/                 # Internationalized routes (en, fr, es, de)
│   │   ├── (marketing)/          # Public pages (no auth required)
│   │   │   ├── layout.tsx        # Marketing layout
│   │   │   ├── opengraph-image.tsx # Dynamic OG image for homepage
│   │   │   ├── page.tsx          # Homepage
│   │   │   ├── pricing/          # Tier selection
│   │   │   │   ├── page.tsx
│   │   │   │   └── opengraph-image.tsx # Dynamic OG image for pricing
│   │   │   ├── privacy/          # Privacy policy
│   │   │   └── terms/            # Terms of service
│   │   ├── (auth)/               # Authentication flows (customer)
│   │   │   ├── signin/           # Sign in
│   │   │   ├── signup/           # Account creation
│   │   │   ├── reset-password/   # Request password reset
│   │   │   └── new-password/     # Set new password (from email link)
│   │   ├── (dashboard)/          # Customer dashboard (auth required)
│   │   │   ├── layout.tsx        # Dashboard shell
│   │   │   ├── dashboard/        # Order status / document upload
│   │   │   ├── renewal/          # Fiscal rep renewal checkout
│   │   │   └── settings/         # Account settings
│   │   ├── admin/                # Admin area
│   │   │   ├── signin/           # Public admin sign-in (no role guard)
│   │   │   └── (panel)/          # Guarded admin panel (admin role required)
│   │   │       ├── layout.tsx    # Admin shell
│   │   │       ├── page.tsx      # Order list
│   │   │       └── orders/[id]/  # Order detail
│   │   ├── (operator)/           # Guarded operator area (operator role required)
│   │   │   └── operator/
│   │   │       ├── layout.tsx    # Operator shell
│   │   │       ├── page.tsx      # Submission queue
│   │   │       ├── submitted/    # Submitted orders archive
│   │   │       └── preferences/  # Notification settings
│   │   └── operator/             # Public operator routes
│   │       └── signin/           # Public operator sign-in (no role guard)
│   ├── auth/                     # Non-locale auth handlers
│   │   ├── callback/             # OAuth code exchange (Google OAuth)
│   │   └── confirm/              # Email confirmation (magic links)
│   ├── api/                      # API routes (external-facing only)
│   │   ├── webhooks/stripe/      # Stripe payment webhooks
│   │   ├── cron/renewals/        # Vercel Cron — renewal reminder emails
│   │   ├── cron/sla-breach/      # Vercel Cron — Express SLA breach admin alerts
│   │   └── operator/package/[orderId]/  # Operator document package download (ZIP)
│   ├── actions/                  # Server Actions (all mutations)
│   │   ├── auth.ts               # Auth actions (signin, signup, signout)
│   │   ├── orders.ts             # Order mutations + fiscal rep dismissal
│   │   ├── documents.ts          # Document upload and review
│   │   ├── admin.ts              # Admin actions (approve, override, deliver NIF)
│   │   ├── operator.ts           # Operator actions (submit, preferences)
│   │   ├── checkout.ts           # Checkout session creation (standard + renewal)
│   │   └── settings.ts           # Account settings (email, password, delete)
│   ├── globals.css               # Design tokens and base styles
│   ├── layout.tsx                # Root layout
│   ├── error.tsx                 # Global error boundary (English only)
│   ├── sitemap.ts                # Dynamic sitemap generation
│   ├── robots.ts                 # Search engine crawler rules
│   └── favicon.ico               # App icon
├── components/                   # React components
│   ├── ui/                       # shadcn/ui primitives (DO NOT MODIFY)
│   ├── auth/                     # Auth form components
│   ├── marketing/                # Marketing page components
│   ├── dashboard/                # Dashboard components
│   ├── admin/                    # Admin panel components
│   ├── operator/                 # Operator panel components
│   └── shared/                   # Shared components (header, footer, JSON-LD)
├── lib/                          # Shared infrastructure
│   ├── supabase/                 # Supabase clients
│   │   ├── client.ts             # Client-side Supabase client
│   │   ├── server.ts             # Server-side Supabase client
│   │   ├── admin.ts              # Admin Supabase client (service role)
│   │   ├── proxy.ts              # updateSession utility (called from proxy.ts)
│   │   └── documents.ts          # Signed URL utility for document access
│   ├── db/                       # Database layer
│   │   ├── schema.ts             # Drizzle schema definitions
│   │   ├── queries.ts            # Reusable queries
│   │   └── migrations/           # Database migrations
│   ├── stripe/                   # Stripe integration
│   │   ├── client.ts             # Stripe client
│   │   └── webhooks.ts           # Webhook handlers
│   ├── email/                    # Email templates and sending
│   │   ├── templates/            # React Email templates (11 templates)
│   │   └── send.ts               # Email dispatch (typed union, fire-and-forget)
│   ├── ai/                       # AI document review
│   │   └── document-review.ts    # Groq (Llama 4 Scout) — PDF analysis + flag reasons
│   ├── auth/                     # Auth utilities
│   │   ├── session.ts            # getCurrentUser, requireRole (React cache wrapped)
│   │   └── permissions.ts        # Role-based access control
│   ├── operator/                 # Operator tooling
│   │   ├── packageBuilder.ts     # ZIP package assembly (docs + cover sheet)
│   │   └── CoverSheet.tsx        # React-PDF cover sheet template
│   ├── pdf/                      # PDF generation
│   │   ├── generator.ts          # renderPdf utility
│   │   └── poa-template.tsx      # Power of Attorney React-PDF template
│   ├── validations/              # Zod schemas
│   │   ├── auth.ts               # Auth schemas
│   │   ├── orders.ts             # Order schemas
│   │   ├── documents.ts          # Document schemas
│   │   └── checkout.ts           # Checkout + renewal session schemas
│   ├── utils/                    # Utility functions
│   │   ├── countries.ts          # ISO country list + resolveCountry
│   │   └── dates.ts              # formatSubmissionDate
│   ├── types.ts                  # Shared TypeScript types (ActionResult<T>, etc.)
│   ├── utils.ts                  # Generic helper functions
│   ├── og.ts                     # Open Graph image design constants
│   ├── seo.ts                    # buildAlternates utility for hreflang
│   ├── jsonld.ts                 # JSON-LD schema builders (Organization, Product, FAQ)
│   ├── env.ts                    # Zod env validation — validated at startup
│   └── pricing.ts                # Hardcoded tier + renewal pricing config
├── messages/                     # i18n translation files
│   ├── en.json                   # English
│   ├── fr.json                   # French
│   ├── es.json                   # Spanish
│   └── de.json                   # German
├── public/                       # Static assets
│   ├── images/                   # Images
│   ├── fonts/                    # Inter-Bold.woff (Satori OG images)
│   └── llms.txt                  # LLM crawler context (llmstxt.org spec)
├── context/                      # Project documentation
│   ├── references/               # Tech reference docs (Next.js 16.2, next-intl v4, Supabase)
│   ├── feature-specs/            # Per-feature implementation specs
│   └── *.md                      # Context docs (architecture, tech-spec, ui-context, etc.)
├── i18n/                         # next-intl configuration
│   ├── routing.ts                # defineRouting (locales, defaultLocale, localePrefix)
│   ├── navigation.ts             # createNavigation exports (Link, redirect, useRouter, usePathname)
│   └── request.ts                # getRequestConfig (messages loader)
├── proxy.ts                      # Request proxy (replaces middleware.ts in Next.js 16)
├── next.config.ts                # Next.js configuration
├── tsconfig.json                 # TypeScript configuration
├── drizzle.config.ts             # Drizzle ORM configuration
└── package.json                  # Dependencies
```

---

## System Boundaries

<!-- Define what each part of the system is responsible for.
     These boundaries are enforced — mixing responsibilities across boundaries is an invariant violation. -->

| Boundary | Responsibility | What Lives Here | What Does NOT Live Here |
| -------- | -------------- | --------------- | ----------------------- |
| **`app/[locale]/(route-group)/`** | Route-specific UI and layouts | Page components, layouts, loading states, error boundaries. Pages (`page.tsx`) may read directly from `lib/db/queries` as Server Components — this is idiomatic Next.js App Router. | Business logic, validation, client-side data fetching |
| **`app/actions/`** | Server-side mutations | Form submissions, data updates, auth operations | Direct database access (use `lib/db`), UI components |
| **`app/api/`** | External-facing HTTP endpoints | Webhook handlers, third-party integrations | Internal mutations (use Server Actions instead) |
| **`components/`** | UI composition only | React components, client-side interactivity | Business logic, database queries, auth checks |
| **`lib/`** | Shared infrastructure | Database clients, API clients, utilities, validation schemas | UI components, route-specific logic |
| **`lib/db/`** | Database access layer | Drizzle queries, schema definitions, migrations | Business logic (belongs in `actions/`), UI |
| **`lib/validations/`** | Input validation | Zod schemas for forms, API inputs, env vars | Database queries, UI components |
| **`lib/types.ts`** | Shared type definitions | TypeScript interfaces, types, enums (e.g. `ActionResult<T>`) | Runtime logic, functions, components |
| **`messages/`** | Translations only | JSON translation files for i18n | Code, logic, components |

**Key principles:**
- **Server Actions** (`app/actions/`) handle all mutations — no direct database access from `components/`
- **Pages** (`app/**/page.tsx`) may read from `lib/db/queries` directly as Server Components — this is idiomatic Next.js App Router, not a violation
- **API routes** (`app/api/`) are for external webhooks only — internal mutations use Server Actions
- **Components** (`components/`) are pure UI — they receive data as props and call Server Actions for mutations; they must not call `lib/db/queries` at runtime
- **lib/** is infrastructure — reusable across the entire app, no route-specific logic

---

## Storage Model

<!-- Define what data lives where. One source of truth per data type. -->

| Data Type | Storage Layer | Access Pattern | Notes |
| --------- | ------------- | -------------- | ----- |
| **User identity** | Supabase Auth | `lib/supabase/server.ts` → `auth.getUser()` | Email/password, OAuth, JWT sessions |
| **User profile** | PostgreSQL `users` table | Drizzle ORM via `lib/db/` | Extended user data (language preference, role) |
| **Orders** | PostgreSQL `orders` table | Drizzle ORM via `lib/db/` | Order status, tier, timestamps, customer details |
| **Documents** | Supabase Storage | `lib/supabase/server.ts` → `storage` API | Passport, proof of address, signed POA |
| **Document metadata** | PostgreSQL `documents` table | Drizzle ORM via `lib/db/` | File paths, AI review results, upload timestamps |
| **Payments** | Stripe | Stripe API via `lib/stripe/` | Payment intents, customer IDs, subscription status |
| **Payment records** | PostgreSQL `payments` table | Drizzle ORM via `lib/db/` | Local copy of Stripe payment data for queries |
| **Translations** | JSON files in `messages/` | next-intl via `useTranslations()` | Static translations, no database |
| **Session state** | Supabase Auth cookies | Automatic via Supabase client | JWT tokens, refresh tokens |
| **Temporary uploads** | Supabase Storage temp bucket | Deleted after 24h if not confirmed | Pre-upload validation |

**Storage rules:**
- **Never store sensitive data in localStorage or cookies** — use Supabase Auth sessions
- **Never store large files in PostgreSQL** — use Supabase Storage, store URL reference in DB
- **Never duplicate Stripe data** — store only what's needed for queries (payment ID, amount, status)
- **Document files are immutable** — once uploaded and approved, never modified (only replaced with new upload)

---

## Auth and Access Model

**Auth provider:** Supabase Auth (email/password, JWT sessions)

**User roles:**
| Role | Database Column | Access Level |
| ---- | --------------- | ------------ |
| `customer` | `users.role = 'customer'` | Own orders, own documents, own account settings |
| `admin` | `users.role = 'admin'` | All orders, all documents, can override AI reviews, can update order status |
| `operator` | `users.role = 'operator'` | Orders in `documents_approved` status, can mark as submitted, cannot access admin panel |

**Access rules:**
1. **Authentication required for:**
   - All routes under `(dashboard)`, `(admin)`, `(operator)`
   - All Server Actions except auth actions (signin, signup, reset-password)
   - All document uploads and downloads

2. **Authorization checks:**
   - **Customers** can only access their own orders and documents
   - **Admins** can access all orders and documents
   - **Operators** can only access orders in `documents_approved` status
   - Role checks happen in Server Actions before any mutation

3. **Session management:**
   - Sessions are JWT tokens stored in HTTP-only cookies (managed by Supabase)
   - Session refresh happens automatically via Supabase client
   - Session expiry: 7 days (configurable in Supabase dashboard)

4. **Route protection:**
   - Implemented in `proxy.ts` (Next.js 16 replaces `middleware.ts`)
   - Redirects unauthenticated users to `/[locale]/signin`
   - Redirects unauthorized users to 403 page

**Implementation pattern:**
```typescript
// In Server Actions
export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) throw new Error('Unauthorized')
  
  // Check role
  const userRole = await getUserRole(user.id)
  if (userRole !== 'admin') throw new Error('Forbidden')
  
  // Proceed with mutation
  // ...
}
```

---

## API Design

**Next.js 16 mutation patterns:**

### Server Actions (Preferred for Mutations)
- **Location:** `app/actions/*.ts`
- **Use for:** Form submissions, data mutations, auth operations
- **Pattern:**
  ```typescript
  'use server'
  
  export async function createOrder(formData: FormData) {
    // 1. Validate input with Zod
    const validated = orderSchema.parse(Object.fromEntries(formData))
    
    // 2. Auth check
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')
    
    // 3. Business logic (thin — complex logic in lib/)
    const order = await db.insert(orders).values({...})
    
    // 4. Return result
    return { success: true, data: order }
  }
  ```

### API Routes (Only for External Webhooks)
- **Location:** `app/api/*/route.ts`
- **Use for:** Stripe webhooks, third-party callbacks
- **Pattern:**
  ```typescript
  export async function POST(request: Request) {
    // 1. Verify webhook signature
    const signature = request.headers.get('stripe-signature')
    const event = stripe.webhooks.constructEvent(body, signature, secret)
    
    // 2. Handle event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object)
        break
    }
    
    // 3. Return 200 (webhooks expect quick response)
    return Response.json({ received: true })
  }
  ```

**Key conventions:**
- All Server Actions validate input with Zod before any logic runs
- Auth and ownership checks run before any mutation
- Server Actions are thin — complex logic belongs in `lib/`
- API routes are for external webhooks only — internal mutations use Server Actions
- Long-running work (AI review, email sending) is handled asynchronously but within the same request (no separate queue needed at current scale)

---

## Next.js 16 Specific Patterns

### Proxy (Replaces Middleware)
- **File:** `proxy.ts` in project root
- **Purpose:** Request interception for auth checks, redirects, header manipulation
- **Key changes from middleware:**
  - Renamed from `middleware.ts` to `proxy.ts`
  - Function renamed from `middleware()` to `proxy()`
  - Same functionality, clearer naming

**Example (reflects actual implementation):**
```typescript
// proxy.ts
import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'
import { updateSession } from './lib/supabase/proxy'

const handleI18n = createMiddleware(routing)
const PROTECTED = /\/(dashboard|admin|operator)(\/|$)/

export default async function proxy(request: NextRequest) {
  // updateSession calls getClaims() — returns { claims, header, signature }, not { user }
  // hasValidSession is derived from claims.sub, not a cookie regex
  const { response: supabaseResponse, hasValidSession } = await updateSession(request)

  if (PROTECTED.test(request.nextUrl.pathname) && !hasValidSession) {
    // redirect to /signin (locale-aware) — see actual proxy.ts for full redirect logic
    return NextResponse.redirect(new URL('/signin', request.url))
  }

  // Run next-intl locale routing and copy Supabase cookies onto the response
  const i18nResponse = handleI18n(request)
  supabaseResponse.cookies.getAll().forEach((c) => i18nResponse.cookies.set(c.name, c.value, c))
  return i18nResponse
}

export const config = {
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
}
```

### Server Components (Default)
- All components in `app/` are Server Components by default
- Use `'use client'` directive only when needed:
  - Browser APIs (localStorage, window, etc.)
  - Event handlers (onClick, onChange, etc.)
  - React hooks (useState, useEffect, etc.)
  - Third-party libraries that require client-side rendering

### Server Actions
- Defined with `'use server'` directive
- Can be called from both Server and Client Components
- Automatically handle serialization and network transport
- Replace traditional API routes for mutations

### Caching Strategy (Next.js 16 Changes)
- **Default:** No caching (opt-in model in Next.js 16+)
- **Static pages:** Use `export const dynamic = 'force-static'`
- **Revalidation:** Use `revalidatePath()` or `revalidateTag()` after mutations
- **Data fetching:** Use `cache()` from React for request-level memoization

---

## Invariants

<!-- Rules the AI must never violate. These are not guidelines — they are hard constraints.
     If a proposed implementation violates an invariant, stop and find a different approach. -->

1. **Server Actions handle all mutations** — no direct database access from components, no API routes for internal mutations.

2. **Metadata and files are stored in separate layers** — never put large blobs in PostgreSQL, always use Supabase Storage with URL reference in DB.

3. **Auth and ownership are verified at every mutation boundary** — never trust client-supplied IDs without checking, always verify user has permission.

4. **Server Components are the default** — every component starts as a Server Component. Add `"use client"` only when the component specifically needs browser APIs, event handlers, or React hooks. If in doubt, keep it server-side.

5. **Business logic belongs in `lib/`** — Server Actions and API routes are thin, complex logic is extracted to reusable functions in `lib/`.

6. **Zod schemas validate all external input** — user input, API responses, environment variables, webhook payloads must have explicit Zod schemas.

7. **Never copy-paste UI** — extract a component if the same pattern appears in 3+ places.

8. **Never reference raw colors in components** — use design token CSS variables only (semantic tokens, not primitives).

9. **Every data boundary is typed** — API responses, form inputs, DB queries, and env variables must have explicit TypeScript types or Zod schemas. (Intentional exception: `any` is permitted in `lib/db/queries.ts` for Drizzle transaction support to avoid complex generic overhead).

10. **Translations are never hardcoded** — all user-facing text must use next-intl translation keys.

11. **File uploads go to Supabase Storage** — never store files in PostgreSQL, never store files on the filesystem.

12. **Proxy (`proxy.ts`) is for routing only** — no business logic, no database queries, no complex operations. Keep it fast and simple.

13. **Server Actions return structured results** — always return `{ success: true, data }` or `{ success: false, error }`, never throw errors to the client.

14. **Email templates are React components** — use React Email for all transactional emails, never string concatenation.

15. **Environment variables are validated at startup** — use Zod to validate all env vars in a single place, fail fast if misconfigured.

16. **shadcn/ui components are the default** — always reach for a shadcn component before writing a custom one. Build custom components only when no shadcn primitive fits; custom components must still use design tokens (no raw colors, no hardcoded spacing).

17. **Mobile-first layout** — all layouts are built for mobile first. Add `md:` / `lg:` breakpoint variants only where the layout actually changes. Never design desktop-first and patch mobile afterward.

---
tructured results** — always return `{ success: true, data }` or `{ success: false, error }`, never throw errors to the client.

