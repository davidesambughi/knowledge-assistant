# Architecture Reference

<!-- Sections split from architecture-context.md.
     These are stable reference sections — rarely needed during routine implementation.
     Inject this file only when the session involves infrastructure changes, deployment,
     queue logic, or scalability decisions. See context/context-injection-map.md. -->

---

## Background Tasks

**Current approach:** Inline async operations (no separate queue)

**What runs inline:**
- AI document review (groq API) — ~2-3 seconds
- Email sending (Resend) — ~500ms
- Stripe API calls — ~1-2 seconds

**Why no queue at current scale:**
- Expected volume: <50 orders/day at launch
- All operations complete in <5 seconds
- User expects immediate feedback (especially for document review)
- Adding a queue adds complexity without clear benefit at this scale

**When to add a queue:**
- Volume exceeds 200 orders/day
- Operations start timing out (>30 seconds)
- Need retry logic for failed operations

**Future queue options:**
- Vercel Cron Jobs (for scheduled tasks)
- Inngest (for complex workflows)
- Trigger.dev (for background jobs)

---

## Refactoring Safety

<!-- The goal isn't to get everything right upfront — it's to make change cheap.
     These patterns ensure that mistakes are fixable and the codebase stays clean as it grows.
     The AI must follow these patterns from the first line of code. -->

### Design Tokens
All colors, spacing, typography, and other design values are defined as CSS custom properties in `app/globals.css` using the two-layer token system:
1. **Primitive colors** — raw OKLCH values (e.g., `--color-blue-600`)
2. **Semantic tokens** — role-based tokens (e.g., `--brand-primary`)

Components reference semantic tokens only — never primitives, never raw hex, never raw Tailwind color classes.

**Why:** Changing a color means updating one semantic token mapping. No find-and-replace across 50 files.

**Example:**
```tsx
// ❌ BAD
<button className="bg-blue-600 text-white">Click me</button>

// ✅ GOOD
<button className="bg-[var(--brand-primary)] text-[var(--text-on-accent)]">
  Click me
</button>
```

### Component Discipline
- **`components/ui/`** — shadcn/ui foundation. Do not modify these files directly.
- **`components/[feature]/`** — app-level components. One component per concept.
- **Rule:** Never copy-paste UI markup. If the same element appears in 3+ places, extract a component.

**Why:** Changing a button style means updating one file. All instances update automatically.

### Type-Safe Data Layer
Every data boundary is typed:
- **Database queries** return typed objects (Drizzle types)
- **API routes** validate request bodies with Zod, response shapes defined as TypeScript interfaces
- **Form inputs** typed via react-hook-form + Zod resolver
- **Environment variables** validated at startup with Zod

**Why:** TypeScript and Zod catch breaking changes at compile time, not in production.

**Example:**
```typescript
// lib/validations/orders.ts
import { z } from 'zod'

export const createOrderSchema = z.object({
  tier: z.enum(['essential', 'standard', 'express']),
  email: z.string().email(),
  // ...
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>

// app/actions/orders.ts
'use server'

export async function createOrder(input: unknown) {
  // Validate at runtime
  const validated = createOrderSchema.parse(input)
  
  // TypeScript knows the shape now
  const order = await db.insert(orders).values(validated)
  return order
}
```

### Separation of Concerns (Route Groups)
Isolate areas of the application into separate route groups so that changing one area cannot break another:
- **`app/[locale]/(marketing)/`** — public pages (homepage, pricing, about)
- **`app/[locale]/(auth)/`** — authentication flows (signin, signup, reset-password)
- **`app/[locale]/(dashboard)/`** — authenticated customer pages
- **`app/[locale]/(admin)/`** — internal admin panel
- **`app/[locale]/(operator)/`** — operator submission tool

**Why:** Each area is independently changeable. A refactor in admin cannot break the customer dashboard.

**Route group benefits:**
- Shared layouts per area (different headers for marketing vs dashboard)
- Separate loading and error states
- Clear mental model of the app structure

### Internationalization (i18n)
All user-facing text is translated using next-intl:
- **Translation files:** `messages/[locale].json`
- **Usage:** `useTranslations()` hook in components
- **Type safety:** TypeScript infers available keys from `messages/en.json`

**Why:** Adding a new language means adding one JSON file. No code changes required.

**Example:**
```typescript
// In component
import { useTranslations } from 'next-intl'

export function PricingCard() {
  const t = useTranslations('pricing')
  
  return (
    <div>
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
    </div>
  )
}

// messages/en.json
{
  "pricing": {
    "title": "Choose your tier",
    "description": "Select the plan that fits your timeline"
  }
}
```

### Feature Flags
For large changes that need to ship incrementally, use a simple flag pattern:
```typescript
// lib/flags.ts — feature flags as env-driven booleans
export const flags = {
  newCheckoutFlow: process.env.NEXT_PUBLIC_FLAG_NEW_CHECKOUT === 'true',
  aiDocumentReview: process.env.NEXT_PUBLIC_FLAG_AI_REVIEW === 'true',
}
```

Use when a feature is partially built, being tested, or not ready for all users. Do not use for every feature — only when a flag is genuinely needed.

---

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Run database migrations
npm run db:migrate

# Start development server (Turbopack)
npm run dev
```

### Database Migrations
```bash
# Generate migration from schema changes
npm run db:generate

# Apply migrations
npm run db:migrate

# Open Drizzle Studio (database GUI)
npm run db:studio
```

### Type Generation
```bash
# Generate TypeScript types from database schema
npm run db:generate

# Generate Supabase types
npm run supabase:types
```

### Testing
```bash
# Run type checking
npm run type-check

# Run linting
npm run lint

# Run build (catches build-time errors)
npm run build
```

---

## Deployment

### Environment Variables (Production)
All environment variables from `.env.local` must be set in production:
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Resend: `RESEND_API_KEY`
- Groq: `GROQ_API_KEY`
- App: `NEXT_PUBLIC_APP_URL`

### Build Configuration
- **Bundler:** Turbopack (default in Next.js 16)
- **Output:** Standalone (for Docker/self-hosting) or Vercel (automatic)
- **Image optimization:** Next.js built-in (no external service needed)

### Deployment Targets
- **Vercel** (recommended): Zero-config deployment, automatic previews, edge functions
- **Self-hosted:** Docker container with standalone output
- **Other platforms:** Any Node.js hosting (Railway, Render, Fly.io)

---

## Performance Considerations

### Next.js 16 Optimizations
- **Turbopack:** ~400% faster dev startup, ~50% faster rendering
- **Server Components:** Reduce client-side JavaScript by default
- **Streaming:** Progressive rendering with Suspense boundaries
- **Image optimization:** Automatic WebP/AVIF conversion, lazy loading

### Caching Strategy
- **Static pages:** Marketing pages (homepage, pricing, about) are statically generated
- **Dynamic pages:** Dashboard, admin, operator pages are server-rendered on demand
- **Revalidation:** Use `revalidatePath()` after mutations to update cached pages
- **No aggressive caching:** Next.js 16 defaults to no caching (opt-in model)

### Database Optimization
- **Indexes:** Add indexes on frequently queried columns (user_id, order_id, status)
- **Connection pooling:** Supabase handles this automatically
- **Query optimization:** Use Drizzle's query builder for efficient queries

### File Storage Optimization
- **CDN:** Supabase Storage uses CDN for fast global delivery
- **Image resizing:** Use Supabase Storage transformations for thumbnails
- **Lazy loading:** Use Next.js Image component for automatic lazy loading

---

## Security Considerations

### Authentication
- **JWT tokens:** Stored in HTTP-only cookies (managed by Supabase)
- **Session refresh:** Automatic via Supabase client
- **Password requirements:** Min 8 characters, enforced by Supabase Auth

### Authorization
- **Row-level security:** Enabled on all Supabase tables
- **Role checks:** Verified in Server Actions before mutations
- **Ownership checks:** Users can only access their own data (except admins)

### Input Validation
- **Zod schemas:** All external input validated with Zod
- **File uploads:** Type and size validation before storage
- **SQL injection:** Prevented by Drizzle ORM (parameterized queries)

### Secrets Management
- **Environment variables:** Never commit `.env.local` to git
- **API keys:** Stored in environment variables, never in code
- **Webhook secrets:** Verified on every webhook request

### CORS and CSP
- **CORS:** Configured in `next.config.ts` for API routes
- **CSP:** Content Security Policy headers in `proxy.ts`
- **HTTPS:** Required in production (enforced by Vercel/hosting platform)

---

## Monitoring and Debugging

### Next.js 16 Debugging Features
- **Server Function logging:** Dev terminal shows function name, arguments, execution time
- **Hydration diff indicator:** Clear server/client diff in error overlay
- **`--inspect` flag:** Attach Node.js debugger to dev or production server
- **Error causes:** Error overlay shows full error cause chain

### Production Monitoring
- **Vercel Analytics:** Automatic performance monitoring (if deployed to Vercel)
- **Error tracking:** Consider Sentry for production error tracking
- **Logging:** Use `console.log` in Server Actions (visible in server logs)

### Performance Monitoring
- **Web Vitals:** Automatic tracking with Next.js
- **Database queries:** Monitor slow queries in Supabase dashboard
- **API latency:** Monitor Stripe, Resend, Gemini API response times

---

## Known Limitations and Trade-offs

### Current Scale Assumptions
- **Order volume:** <50 orders/day at launch, <200 orders/day in first year
- **Concurrent users:** <100 simultaneous users
- **File storage:** <10GB in first year

### Technical Debt Accepted
- **No background queue:** Inline async operations acceptable at current scale
- **No caching layer:** Next.js built-in caching sufficient for now
- **No CDN for API:** Vercel Edge Network sufficient for now
- **No separate admin database:** Single PostgreSQL instance for all data

### When to Revisit
- **Add background queue** when order volume exceeds 200/day
- **Add caching layer** when database queries become slow (>500ms)
- **Add CDN for API** when international latency becomes an issue
- **Separate admin database** when admin queries impact customer performance

---

## Future Architecture Considerations

### Potential Additions (Sprint 2+)
- **Real-time updates:** Supabase Realtime for live order status updates
- **Background jobs:** Inngest or Trigger.dev for complex workflows
- **Analytics:** PostHog or Mixpanel for product analytics
- **Feature flags:** LaunchDarkly or Vercel Flags for gradual rollouts
- **A/B testing:** Vercel Edge Config for experimentation

### Scalability Path
1. **Phase 1 (Current):** Monolithic Next.js app, single database, inline operations
2. **Phase 2 (200+ orders/day):** Add background queue, separate admin/customer databases
3. **Phase 3 (1000+ orders/day):** Microservices for document processing, separate API layer
4. **Phase 4 (10k+ orders/day):** Multi-region deployment, read replicas, CDN for API

---

## References

- [Next.js 16.2 Documentation](https://nextjs.org/docs)
- [Next.js 16.2 Release Notes](https://nextjs.org/blog/next-16-2)
- [Proxy Migration Guide](https://nextjs.org/docs/messages/middleware-to-proxy)
- [Supabase Documentation](https://supabase.com/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [Stripe API Documentation](https://stripe.com/docs/api)
- [Resend Documentation](https://resend.com/docs)
- [Google Gemini API Documentation](https://ai.google.dev/docs)
