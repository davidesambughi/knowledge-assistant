# Technical Specification

<!-- Permanent reference for the data layer and environment configuration.
     Data models and env vars only — everything else lives in feature specs and code.
     Add new fields here when a feature spec introduces them (before running the migration).
     Do not add Server Actions, API routes, or feature descriptions — those live in feature specs. -->

---

## Data Models

### User

```typescript
interface User {
  id: string                    // UUID, primary key (from Supabase Auth)
  email: string                 // unique, from Supabase Auth
  role: 'customer' | 'admin' | 'operator'  // default: 'customer'
  language: 'en' | 'fr' | 'es' | 'de'      // default: browser detection or 'en'
  createdAt: Date
  updatedAt: Date
}
```

**Relationships:**
- Has many `Order`
- Has many `Document` (through `Order`)

**Notes:**
- User identity is managed by Supabase Auth (email/password)
- This table extends Supabase Auth with app-specific fields (role, language)
- Email is stored in Supabase Auth, duplicated here for query convenience
- Role determines access level: customer < operator < admin

---

### Order

```typescript
interface Order {
  id: string                    // UUID, primary key
  userId: string                // foreign key → User.id
  tier: 'essential' | 'standard' | 'express'
  status: OrderStatus

  // Customer details (collected after payment, before document upload)
  fullName: string | null       // legal name from passport
  dateOfBirth: Date | null
  nationality: string | null    // ISO country code (e.g., 'US', 'FR')
  passportNumber: string | null
  passportExpiry: Date | null
  address: string | null

  // NIF delivery
  nifNumber: string | null      // 9-digit number issued by Finanças — immutable once set

  // Timestamps
  createdAt: Date               // set when order is created (after payment webhook)
  documentsSubmittedAt: Date | null  // set when all 3 documents are approved → triggers documents_under_review
  documentsApprovedAt: Date | null   // set when admin approves order → Express 48h SLA starts here
  submittedToFinancasAt: Date | null // set when operator marks as submitted
  deliveredAt: Date | null           // set when NIF is entered
  updatedAt: Date

  // Fiscal representation (Standard and Express only)
  fiscalRepExpiresAt: Date | null    // deliveredAt + 12 months
  fiscalRepDismissedAt: Date | null  // set when customer confirms "I no longer need fiscal rep" — suppresses all future renewal emails
  slaBreachAlertSentAt: Date | null  // set when the admin SLA breach alert has been sent — prevents duplicate alerts

  // POA generation
  poaGeneratedPath: string | null    // Supabase Storage path for the generated POA PDF

  // Stripe
  stripeCheckoutSessionId: string | null
  stripePaymentIntentId: string | null
}

enum OrderStatus {
  'documents_pending'       // Payment confirmed, waiting for document upload
  'documents_under_review'  // All docs uploaded and AI-approved, waiting for admin approval
  'documents_approved'      // Admin approved, operator notified, waiting for ebalcão submission
  'submitted'               // Submitted to Finanças, waiting for NIF to be issued
  'delivered'               // NIF received and entered — final state
}
```

**Relationships:**
- Belongs to `User`
- Has many `Document` (exactly 3: passport, proof_of_address, signed_poa)
- Has many `Payment`

**Business rules:**
- Status only moves forward (except manual admin override — requires a note)
- Express 48h SLA starts at `documentsApprovedAt`, not at payment or upload
- `fiscalRepExpiresAt` only applies to Standard and Express tiers
- `nifNumber` is immutable once set — admin override required to correct it
- `fiscalRepDismissedAt` suppresses renewal emails and hides the renewal banner permanently

---

### Document

```typescript
interface Document {
  id: string                    // UUID, primary key
  orderId: string               // foreign key → Order.id
  userId: string                // foreign key → User.id (for access control)
  type: 'passport' | 'proof_of_address' | 'signed_poa'

  // File storage
  filePath: string              // Supabase Storage path
  fileName: string              // original filename
  fileSize: number              // bytes
  mimeType: string              // e.g., 'application/pdf', 'image/jpeg'

  // AI review (passport and proof_of_address only — signed_poa is accepted immediately)
  aiReviewStatus: 'pending' | 'clear' | 'flagged' | 'error' | 'manual_review' | null
  aiReviewReason: string | null // specific plain-language reason when flagged
  aiReviewedAt: Date | null
  aiReviewAttempts: number      // default: 0 — after 2 failed attempts, escalates to manual_review

  // Admin override
  adminOverride: boolean        // default: false
  adminOverrideBy: string | null // User.id of admin
  adminOverrideReason: string | null
  adminOverrideAt: Date | null

  // Final status
  approved: boolean             // true when aiReviewStatus === 'clear' OR adminOverride === true
  approvedAt: Date | null

  // Soft-delete — set when user re-uploads this document type; old record kept for audit
  supersededAt: Date | null     // null = active record

  createdAt: Date
  updatedAt: Date
}
```

**Relationships:**
- Belongs to `Order`
- Belongs to `User`

**Business rules:**
- Each order has exactly 3 documents (one of each type)
- AI review only runs on passport and proof_of_address
- After 2 failed AI attempts on the same document, escalates to manual_review — no further uploads required
- When user re-uploads a document type, previous record gets `supersededAt` set — only the active record (supersededAt = null) is used
- When all 3 documents are approved: order transitions to `documents_under_review`, admin notified

---

### Payment

```typescript
interface Payment {
  id: string                    // UUID, primary key
  orderId: string               // foreign key → Order.id
  userId: string                // foreign key → User.id

  // Stripe data
  stripePaymentIntentId: string // unique
  stripeCheckoutSessionId: string | null

  // Payment details
  amount: number                // cents (e.g., 12900 for €129)
  currency: string              // 'eur'
  status: 'pending' | 'succeeded' | 'failed' | 'refunded'

  // Metadata
  tier: 'essential' | 'standard' | 'express'
  isRenewal: boolean            // default: false — true for fiscal rep renewal payments

  createdAt: Date
  updatedAt: Date
}
```

**Relationships:**
- Belongs to `Order`
- Belongs to `User`

**Notes:**
- Local copy of Stripe data for queries — Stripe is the source of truth
- Updated via webhook, not directly
- Renewal payments create a new Payment record (isRenewal: true) and extend the existing Order's fiscalRepExpiresAt

---

### OperatorNotification

```typescript
interface OperatorNotification {
  id: string                    // UUID, primary key
  orderId: string               // foreign key → Order.id
  operatorId: string            // foreign key → User.id (role: operator)

  type: 'email' | 'sms'
  status: 'pending' | 'sent' | 'failed'

  attempts: number              // default: 0
  lastAttemptAt: Date | null

  createdAt: Date
  sentAt: Date | null
}
```

**Relationships:**
- Belongs to `Order`
- Belongs to `User` (operator)

**Notes:**
- Created when order transitions to `documents_approved`
- Express orders: one email + one SMS record per operator (both channels, if SMS enabled in preferences)
- Standard orders: one email record per operator only
- Multiple records created if multiple operator users exist (one per operator per channel)

---

### OperatorPreferences

```typescript
interface OperatorPreferences {
  id: string                    // UUID, primary key
  userId: string                // foreign key → User.id (role: operator) — unique (one record per operator)

  emailNotifications: boolean   // default: true
  smsNotifications: boolean     // default: true
  phoneNumber: string | null    // required when smsNotifications is true

  createdAt: Date
  updatedAt: Date
}
```

**Relationships:**
- Belongs to `User` (operator)

---

### AuditLog

```typescript
interface AuditLog {
  id: string                    // UUID, primary key
  userId: string | null         // foreign key → User.id (who performed the action)
  orderId: string | null        // foreign key → Order.id (if action relates to an order)

  action: string                // e.g., 'order.status.updated', 'document.approved'
  details: Record<string, unknown>  // action-specific data

  ipAddress: string | null
  userAgent: string | null

  createdAt: Date               // immutable — audit logs are never updated or deleted
}
```

**Relationships:**
- Belongs to `User` (optional)
- Belongs to `Order` (optional)

**Notes:**
- Append-only — records are never modified after creation
- All admin and operator actions must write a record here
- Actions to log: order status changes, document approvals/rejections, admin overrides, operator submissions, NIF delivery, payment events

---

## Database Indexes

```sql
-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Orders
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_tier ON orders(tier);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_documents_approved_at ON orders(documents_approved_at)
  WHERE status = 'documents_approved'; -- Express SLA queries

-- Documents
CREATE INDEX idx_documents_order_id ON documents(order_id);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_ai_review_status ON documents(ai_review_status);

-- Payments
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE UNIQUE INDEX idx_payments_stripe_checkout_session_id ON payments(stripe_checkout_session_id);

-- Operator Notifications
CREATE INDEX idx_operator_notifications_order_id ON operator_notifications(order_id);
CREATE INDEX idx_operator_notifications_status ON operator_notifications(status);

-- Audit Log
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_order_id ON audit_log(order_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
```

---

## Environment Variables

### Required

| Variable | Purpose | Where to get it |
| -------- | ------- | --------------- |
| `NEXT_PUBLIC_APP_URL` | Public base URL | Set manually (`http://localhost:3000` dev, `https://remotenif.com` prod) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key | Supabase dashboard → Settings → API |
| `SUPABASE_SERVICE_SECRET_KEY` | Supabase service role key (private) | Supabase dashboard → Settings → API |
| `DATABASE_URL` | PostgreSQL connection string | Supabase dashboard → Settings → Database |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (public) | Stripe dashboard → Developers → API keys |
| `STRIPE_SECRET_KEY` | Stripe secret key (private) | Stripe dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Stripe dashboard → Developers → Webhooks |
| `RESEND_API_KEY` | Resend API key | resend.com → API Keys |
| `RESEND_FROM_EMAIL` | From address for all emails | Verified domain in Resend |
| `ADMIN_EMAIL` | Internal email for admin notifications (manual review alerts, escalations) | Set manually (team inbox or individual) |
| `GROQ_API_KEY` | Groq API key | console.groq.com |
| `CRON_SECRET` | Auth token for Vercel Cron → `/api/cron/*` | Generate any long random string |

### Zod Schema (`lib/env.ts`)

```typescript
import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SERVICE_SECRET_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),

  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),

  RESEND_API_KEY: z.string().startsWith('re_'),
  RESEND_FROM_EMAIL: z.string().email(),
  ADMIN_EMAIL: z.string().email(),

  GROQ_API_KEY: z.string().min(1),

  CRON_SECRET: z.string().min(1),
})

export const env = envSchema.parse(process.env)
export type Env = z.infer<typeof envSchema>
```

### `.env.local` Template

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_SECRET_KEY=sb_secret_...
DATABASE_URL=postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@remotenif.com
ADMIN_EMAIL=admin@remotenif.com

# AI
GROQ_API_KEY=gsk_...

# Cron
CRON_SECRET=your-long-random-secret
```
