# User Flows

<!-- Each flow covers: trigger (what starts it), steps, outcome, and edge cases.
     Write flows from the user's perspective — actions and outcomes, not implementation.
     Flows here feed directly into what the AI builds. If a flow is missing, the feature won't exist. -->

---

## Order Status Progression

<!-- This is the single source of truth for order statuses. Every flow must respect this sequence. -->

| Status | What It Means | Who Controls Transition | User-Facing Label |
|--------|---------------|------------------------|-------------------|
| `documents_pending` | Payment confirmed, waiting for user to upload documents | User completes upload | "Upload your documents" |
| `documents_under_review` | All documents uploaded, AI review complete, waiting for admin approval | Admin approves | "Under review" |
| `documents_approved` | Admin approved documents, operator notified, waiting for ebalcão submission | Operator submits | "Approved — preparing submission" |
| `submitted` | Application submitted to Finanças, waiting for NIF to be issued | Finanças issues NIF, operator enters it | "Submitted to Finanças" |
| `delivered` | NIF received and entered into system | Final state | "Delivered" |

**Key rules:**
- Statuses only move forward, never backward (except via manual admin override in error cases)
- Express 48h SLA starts when status transitions to `documents_approved` (admin approval timestamp)
- User sees simplified labels, not internal status names

---

## Screen Inventory

| Screen | Route | Purpose |
| ------ | ----- | ------- |
| Language Switcher | (header component) | Allows manual language selection, persists across sessions |
| Homepage | `/` | Builds trust, explains the service, drives CTA click |
| Pricing / Tier Selection | `/pricing` | Deadline question + three tier cards — starts the order |
| Sign Up | `/signup` | Email + password only — fast account creation before checkout |
| Checkout | Stripe-hosted | Payment for selected tier |
| Order Confirmed | `/dashboard` | Post-payment landing — confirms order and prompts document upload |
| Dashboard (documents pending) | `/dashboard` | Personal details form + three document upload slots |
| Dashboard (under review) | `/dashboard` | Shows review status per document slot |
| Dashboard (in progress) | `/dashboard` | Status timeline, estimated delivery, support link, trust content |
| Dashboard (delivered) | `/dashboard` | NIF number, order record, post-NIF journey guide |
| Account Settings | `/account` or `/settings` | Change email, password, language preference, delete account |
| Admin Sign In | `/admin/signin` | Admin authentication (separate from customer auth) |
| Admin — Order List | `/admin` | All orders with status, tier, Express SLA countdown |
| Admin — Order Detail | `/admin/orders/[id]` | Customer details, documents, AI results, action buttons |
| Operator Sign In | `/operator/signin` | Operator authentication (separate from customer and admin auth) |
| Operator — Queue | `/operator` | Express + Standard + Essential order queue with priority and SLA countdowns |
| Operator — Submitted Orders | `/operator/submitted` | Read-only archive of all submitted orders with timestamps |
| Operator — Preferences | `/operator/preferences` | Toggle email and SMS notification channels |
| Renewal Checkout | Stripe-hosted | €89 fiscal representation renewal payment |

---

## Primary Flows

### Flow 1 — Homepage → Tier Selection

**Trigger:** User arrives on the homepage (direct, organic search, or referral link)

**Steps:**
1. User reads the homepage — hero section, trust content, service explanation
2. User clicks the primary CTA ("Get my NIF" or equivalent)
3. User lands on the pricing screen — sees the deadline question and three tier cards simultaneously
4. User selects a tier
5. User is taken to account creation

**Outcome:** User has chosen a tier and is ready to create an account

**Edge cases:**
- User clicks CTA but already has an account → taken to sign in, then redirected to pricing with their tier selection preserved
- User lands directly on the pricing URL (bookmarked or linked) → skips homepage, lands on step 3
- User reads the homepage but does not click → no action (conversion problem, not a UX flow)
- User lands on homepage → language is auto-detected from browser settings (Accept-Language header); if detected language is supported (EN/FR/ES/DE), site loads in that language; otherwise defaults to English
- User manually changes language via header switcher → preference is stored in a cookie and persists across sessions; after signup, preference is saved to user account

---

### Flow 2 — Account Creation

**Trigger:** User has selected a tier on the pricing screen

**Steps:**
1. User lands on the signup screen — sees email and password fields only
2. User fills in email and password and submits
3. System creates the account and stores the selected tier against it
4. System sends a confirmation email with a verification link (blocking — user must confirm before proceeding)
5. User clicks the confirmation link in the email
6. User is redirected to Stripe checkout

**Outcome:** Account exists and email is verified, tier is saved, user proceeds to payment

**Edge cases:**
- Email already registered → show inline error "An account with this email already exists. Sign in instead?" with a link
- User submits weak or invalid password → inline validation error, stay on screen
- User navigates back to pricing after signup → tier selection is preserved, they are not asked to sign up again
- User never confirms their email → cannot proceed to checkout; confirmation email can be resent

**Note:** Email verification is required before checkout. This ensures every order has a verified contact address for all downstream communications (status updates, document review results, NIF delivery). Previous decision (non-blocking confirmation) was reversed during implementation.

---

### Flow 3 — Stripe Checkout

**Trigger:** User has created an account and is redirected to Stripe

**Steps:**
1. User lands on Stripe-hosted checkout — sees order summary (tier name, price, what's included)
2. User enters card details and clicks pay
3. Stripe processes the payment
4. On success: user is redirected to a confirmation page ("Your order is confirmed — next step: upload your documents")
5. In parallel: Stripe sends a webhook to the server — order is officially created in the database with status `documents_pending`
6. System sends order confirmation email with a link to the dashboard

**Outcome:** Payment confirmed, order exists in the system, user is ready to upload documents

**Edge cases:**
- Payment fails (declined card) → Stripe shows inline error on checkout, user can retry with a different card, no order is created
- User closes the browser mid-checkout → no order is created until webhook fires; if user returns via dashboard link they see no active order and are prompted to restart checkout
- User hits back after redirect to success page → they see the confirmation page again, no duplicate charge (Stripe idempotency handles this)
- Webhook arrives before redirect → no issue, order is created server-side, success page reads the existing order
- Webhook is delayed → success page polls for order creation for up to 30 seconds. If order still doesn't exist after 30 seconds, show error message: "Your payment was successful, but we're still processing your order. Check your email for confirmation, or contact support if you don't receive it within 10 minutes." Include support email link.

---

### Flow 4 — Personal Details + Document Upload

**Trigger:** User lands on the dashboard after checkout, order status is `documents_pending`

#### State 1: `documents_pending` — collect details and documents

**Steps:**
1. Dashboard shows three upload slots (passport, proof of address, signed POA) and a personal details form above them
2. User fills in the personal details form: full legal name, date of birth, nationality, passport number, passport expiry date, current address
3. User clicks "Save and generate my POA" — system validates the form and generates the POA PDF instantly (no page reload)
4. Download link appears inline immediately: "Your POA is ready. Download it here."
5. User downloads the POA, signs it physically (handwritten signature required), scans or photographs it
6. User uploads passport → AI review runs (see AI review states below)
7. User uploads proof of address → AI review runs
8. User uploads signed POA → AI review runs (same flow as passport and proof of address — all document types go through AI review, none are auto-approved on upload)
9. All three slots show a clear/accepted state → order status transitions to `documents_under_review`, admin is notified

**Outcome:** All documents uploaded and accepted, order moves to admin review

**Edge cases:**
- User closes browser after generating POA but before uploading → on return, personal details and generated POA are preserved; dashboard resumes at the upload step with download link still visible
- User uploads documents in a different order (passport before proof of address, etc.) → allowed; each slot is independent once personal details are saved
- User re-opens dashboard mid-upload → sees exactly which slots are complete and which are pending
- User tries to upload documents before filling personal details → upload slots are disabled (grayed out) with tooltip: "Complete your personal details first to unlock document upload"
- User tries to upload signed POA before generating it → POA upload slot is disabled until user clicks "Save and generate my POA"

---

#### AI Review States (all document types: passport, proof of address, and signed POA)

**Clear:**
- Document slot updates to approved state
- User proceeds to upload the next document

**Flagged:**
- Document slot switches to flagged state showing the specific reason in plain language
- Re-upload button appears in place of the original upload button
- All other document slots that passed are locked — user only touches the flagged one
- After re-upload, AI review runs again
- If flagged a second time → slot escalates to manual review (see below)

**Manual Review (Error or escalation after 2 failures):**
- Document slot switches to manual review state
- User sees: "Our team will review your documents within 4 hours"
- No re-upload required, no further action from the user
- Admin receives an automatic notification

---

### Flow 5 — Order Status Dashboard (waiting states)

**Trigger:** All documents uploaded and accepted, order status is `documents_under_review` or beyond

---

#### State 2: `documents_under_review` — admin reviewing

**What the user sees:**
- Status timeline showing "Under review" as current step
- Message: "Our team is reviewing your documents. We'll notify you within 4 hours."
- No actions required

---

#### State 3: `documents_approved` — preparing for submission

**What the user sees:**
- Status timeline showing "Approved" as current step
- Message: "Your documents have been approved. Your application is being prepared for submission to Finanças."
- For Express orders: "Your application will be submitted within 48 hours of approval."
- No actions required

**Note:** This state covers the time between admin approval and operator submission. For most orders this is brief (minutes to hours), but for Express orders the 48h SLA is explicitly communicated.

---

#### State 4: `submitted` — waiting for Finanças

**What the user sees:**
- Status card showing application submitted with description: "Your application has been submitted to Finanças. We are waiting for them to issue your NIF number. This usually takes 5-10 business days."
- Persistent support footer always visible below all state cards: "Need help with your application? support@remotenif.com"
- *(Post-launch)* Content section with useful reading while they wait: what to do after receiving NIF, how to open a Portuguese bank account, what NHR/IFICI is.

**No actions required from the user.**

---

#### State 5: `delivered` — NIF received

**What the user sees:**
- NIF number displayed prominently — large, clear, copyable with one click
- Permanent record of their order details below
- *(Post-launch)* "What comes next?" section — condensed post-NIF guide (bank account, NHR/IFICI, property steps). Content not yet written; removed from delivery email during Feature 16 for regulatory/bias reasons.

**Triggered automatically:**
- System sends NIF delivery email (intentionally minimal — NIF number + dashboard CTA only)
- Order is permanently marked as complete

**Edge cases:**
- User returns to dashboard weeks later → NIF number and order details are always visible, never archived
- User loses the delivery email → dashboard is the permanent record, always accessible after sign in

---

## Authentication Flows

### Flow 6a — Sign In

**Trigger:** User clicks "Sign in" or hits a protected route with an expired or missing session

**Steps:**
1. User lands on the sign in screen — sees email and password fields
2. User fills in credentials and submits
3. System validates credentials
4. On success: user is redirected to their original destination (redirect after auth) or to `/dashboard` if no destination was stored

**Outcome:** User is authenticated and lands in the right place

**Edge cases:**
- Wrong password → inline error "Incorrect email or password", stay on screen, no account enumeration (do not confirm whether the email exists)
- Session expired on a protected route → redirected to sign in with the original URL preserved, lands back there after signing in
- User is already signed in and visits `/signin` → redirected to `/dashboard`

---

### Flow 6b — Sign Out

**Trigger:** User clicks "Sign out" from the dashboard or account menu

**Steps:**
1. System clears the session
2. User is redirected to the homepage

**Outcome:** User is signed out and on the homepage

**Edge cases:**
- User hits back after signing out → protected routes redirect to sign in, no stale session data shown

---

### Flow 6c — Password Reset

**Trigger:** User clicks "Forgot your password?" on the sign in screen

**Steps:**
1. User lands on the password reset request screen — sees email field only
2. User enters their email and submits
3. System always shows: "If an account exists for this email, you'll receive a reset link shortly" — regardless of whether the email is registered (prevents account enumeration)
4. If the email is registered: system sends a password reset email with a time-limited link in the user's selected language (from their account language preference, or browser detection if not signed in)
5. User clicks the link in the email → lands on the new password screen
6. User enters and confirms a new password and submits
7. System updates the password and signs the user in
8. User is redirected to `/dashboard`

**Outcome:** Password updated, user is signed in

**Edge cases:**
- Reset link is expired → user sees "This link has expired. Request a new one." with a link back to the reset request screen
- User requests reset multiple times → each new request invalidates the previous link
- User is already signed in and wants to change password → handled via account settings instead

---

### Flow 6d — Admin Sign In

**Trigger:** Admin visits `/admin` or any admin route without a valid admin session

**Steps:**
1. System redirects to `/admin/signin`
2. Admin enters email and password (admin credentials, separate from customer accounts)
3. System validates credentials against admin user table
4. On success: admin is redirected to `/admin` (order list)
5. Admin session is created with admin role flag

**Outcome:** Admin is authenticated and can access admin panel

**Edge cases:**
- Wrong credentials → inline error "Invalid admin credentials", stay on screen
- Admin tries to access customer routes → allowed (admins can view the customer experience)
- Customer tries to access `/admin` → redirected to admin sign-in, but their customer credentials will not work (different user tables or role check fails)
- Admin session expires → redirected to `/admin/signin` with original URL preserved

**Note:** Admin accounts are created manually (not via self-service signup). This is an internal tool.

---

### Flow 6e — Operator Sign In

**Trigger:** Operator visits `/operator` or any operator route without a valid operator session

**Steps:**
1. System redirects to `/operator/signin`
2. Operator enters email and password (operator credentials, separate from customer and admin accounts)
3. System validates credentials against operator user table
4. On success: operator is redirected to `/operator` (submission queue)
5. Operator session is created with operator role flag

**Outcome:** Operator is authenticated and can access operator panel

**Edge cases:**
- Wrong credentials → inline error "Invalid operator credentials", stay on screen
- Operator tries to access admin routes → blocked, "Access denied" message (operators cannot access admin panel)
- Operator tries to access customer routes → allowed (operators can view the customer experience for context)
- Customer or admin tries to access `/operator` → redirected to operator sign-in, but their credentials will not work (different user tables or role check fails)
- Operator session expires → redirected to `/operator/signin` with original URL preserved

**Note:** Operator accounts are created manually by admin. Typically 1-3 operator accounts exist (the contracted fiscal representatives).

---

## Admin Flows

### Flow 7 — Admin Order Management

**Trigger:** Admin signs in to the admin panel

**Note:** The admin role is separate from the operator (fiscal rep) role. The admin manages orders and documents. The operator handles ebalcão submission. These are two distinct people with different access levels.

---

#### 7a — Order List

**What the admin sees:**
- Table of all orders with: customer name, tier, current status, date ordered
- Express orders show a live countdown against the 48h SLA — visually distinct from other rows
- Filterable by status and tier

---

#### 7b — Order Detail

**Trigger:** Admin clicks an order from the list

**What the admin sees:**
- Customer details: name, nationality, passport number, address
- Tier and payment confirmation
- All three uploaded documents — viewable inline or downloadable
- AI review result per document — with specific reason if flagged
- Action buttons: override AI result, update order status, trigger email resend

---

#### 7c — Document Review and Override

**Steps:**
1. Admin views a document and its AI review result
2. Admin can override individual document results:
   - Click "Approve" to override a flagged document
   - Click "Flag" to override an AI-approved document
3. If flagging: admin must enter a specific reason (required — shown to the customer)
4. System updates that document's status immediately

**Note:** Approving individual documents does NOT approve the order. The admin must explicitly approve the full order (see 7d below).

---

#### 7d — Order Approval (Explicit Action)

**Trigger:** All three documents have passed review (either by AI or admin override)

**Steps:**
1. Admin sees "Approve Order" button become active on the order detail screen (only appears when all 3 documents are approved)
2. Admin reviews all three documents one final time
3. Admin clicks "Approve Order"
4. System transitions order status to `documents_approved`
5. Operator queue is notified immediately
6. For Express orders: 48h SLA countdown starts from this timestamp
7. Customer receives "Documents approved" email

**Outcome:** Order moves to operator queue, Express SLA clock starts

**Edge cases:**
- Admin approves order but then notices an error → admin can manually change status back to `documents_under_review` and add a note to customer explaining why
- All documents approved but admin hasn't clicked "Approve Order" yet → order stays in `documents_under_review`, operator is NOT notified, customer sees "Under review" status

---

#### 7e — Manual Status Update

**Steps:**
1. Admin selects a new status from the order detail screen
2. If the status moves backward or stalls (e.g. flagging a document, putting order on hold) → note to customer is required
3. If the status moves forward (e.g. manually marking as submitted) → note is optional
4. Admin confirms — system updates status and sends customer email with the note if provided

---

#### 7f — Email Resend

**Steps:**
1. Admin clicks "Resend email" on the order detail screen
2. Selects which status email to resend
3. System resends the email to the customer in their original language preference

**Edge cases:**
- Admin tries to approve a document with no file uploaded → not possible, approve button only appears when a file exists
- Admin clicks "Approve Order" but operator queue notification fails → system retries notification automatically every 5 minutes until successful, admin sees warning banner on order detail

---

## Operator Flows

### Flow 8 — Operator Submission Workflow

**Trigger:** Operator receives an email and/or SMS notification that an order is ready to submit

**Note:** The operator is a licensed Portuguese fiscal representative (advogado or solicitador) contracted to submit NIF applications to ebalcão. They are not the admin. They do not manage orders or review documents — their only job is to submit the prepared package to Finanças and mark the order as submitted.

---

#### 8a — Notification

- Express order approved → operator receives email + SMS immediately (both channels enabled by default; operator can disable either in preferences)
- Standard order approved → operator receives email only
- Notification includes: customer name, tier, SLA countdown for Express orders, direct link to the operator queue

---

#### 8b — Operator Queue

**What the operator sees:**

**Express orders (top section):**
- Sorted by SLA countdown — least time remaining at the top
- Each row shows: customer name, time remaining against 48h SLA (large, color-coded — green → amber → red as deadline approaches), "Download package" button
- Priority is unmistakable at a glance — no thinking required about what to work on next

**Standard orders (middle section):**
- Sorted by date ordered, oldest first
- Each row shows: customer name, date ordered, "Download package" button
- No countdown — no SLA pressure

**Essential orders (bottom section):**
- Sorted by date ordered, oldest first
- Each row shows: customer name, date ordered, "Download package" button
- No SLA, no fiscal representation — operator submits the NIF application only

---

#### 8c — Submission Steps

1. Operator clicks "Download package" for the next order
2. System generates and downloads a zip file containing:
   - Cover sheet (PDF): full name, date of birth, nationality, passport number, expiry date, address, tier, order ID — formatted for easy ebalcão entry
   - Passport scan
   - Proof of address
   - Signed POA
3. Operator logs into ebalcão with their own credentials
4. Operator submits the NIF application using the cover sheet as reference
5. Operator returns to the queue and clicks "Mark as submitted" on the order
6. System automatically transitions order status to `submitted`, triggers customer status email
7. Order disappears from the operator queue

**Outcome:** Application submitted to Finanças, customer notified, order removed from active queue

**Edge cases:**
- Operator marks wrong order as submitted → admin can manually correct the status from the admin panel; order reappears in operator queue if status is changed back to `documents_approved`
- Operator downloads package but ebalcão is unavailable → order stays in queue, operator retries when portal is back; for Express orders the SLA countdown continues — admin is responsible for communicating delays to the customer if SLA is at risk
- Express SLA countdown reaches zero before submission → order row turns red, admin receives an automatic alert email
- Operator needs to view a submitted order → click "Submitted Orders" tab in operator panel to see read-only archive of all submitted orders with submission timestamps

---

## Account Management Flows

### Flow 9 — Account Settings

**Trigger:** User clicks "Account" or "Settings" from dashboard header or menu

**Steps:**
1. User lands on account settings page
2. User sees sections for: Change Email, Change Password, Language Preference, Delete Account

---

#### 9a — Change Email

**Steps:**
1. User enters new email address
2. User enters current password for verification
3. User submits
4. System sends verification email to new address with confirmation link
5. User clicks link in email → email is updated, user receives confirmation
6. User is redirected to dashboard

**Edge cases:**
- New email already in use → inline error "This email is already registered to another account"
- User never clicks verification link → email change is not applied, old email remains active
- User enters wrong password → inline error "Incorrect password"

---

#### 9b — Change Password

**Steps:**
1. User enters current password
2. User enters new password and confirms it
3. User submits
4. System updates password
5. User sees success message: "Password updated successfully"

**Edge cases:**
- Current password is wrong → inline error "Incorrect current password"
- New password is too weak → inline validation error with requirements (min 8 chars, etc.)
- New password doesn't match confirmation → inline error "Passwords don't match"

---

#### 9c — Change Language Preference

**Steps:**
1. User selects preferred language from dropdown (EN/FR/ES/DE)
2. System updates preference immediately (no submit button needed)
3. Page reloads in selected language
4. All future emails will be sent in this language

---

#### 9d — Delete Account

**Steps:**
1. User clicks "Delete my account"
2. System shows confirmation dialog: "Are you sure? This will permanently delete your account and all order history. Your NIF number will remain valid with Finanças, but you will lose access to this dashboard."
3. User must type "DELETE" to confirm (prevents accidental deletion)
4. User confirms
5. System deletes account and all associated data
6. User is signed out and redirected to homepage

**Edge cases:**
- User has an active order (not yet delivered) → system shows warning: "You have an active order. Are you sure you want to delete your account? You will lose access to order status updates." — still allows deletion if user confirms
- User has active fiscal representation → system shows warning: "Your fiscal representation is active until [date]. Deleting your account will not cancel it. Contact support if you need to cancel." — still allows deletion if user confirms

---

## Support Flows

### Flow 10 — Contact Support

**Trigger:** User clicks "Contact Support" or "Help" link from dashboard, status page, or any error state

**Steps:**
1. User clicks support link
2. System opens user's default email client with pre-filled email:
   - To: support@[domain]
   - Subject: "Support Request — Order #[order_id]" (if user has an active order)
   - Body: Pre-filled with user's name, email, order ID, current order status (if applicable)
3. User writes their message and sends

**Alternative (if in-app contact form is built in Sprint 2+):**
1. User clicks support link
2. Modal or page opens with contact form
3. User fills in: subject, message (name and email pre-filled from account)
4. User submits
5. System sends email to support team and confirmation email to user
6. User sees success message: "We've received your message and will respond within 24 hours"

**Outcome:** Support request sent, user has confirmation

**Edge cases:**
- User is not signed in → email client opens with no pre-filled order info, just support email address
- User's email client is not configured → show fallback: "Email us at support@[domain]" with copy button

---

## Renewal Flows

### Flow 11 — Fiscal Representation Renewal

**Trigger:** Time-based — 11 months after NIF delivery date (Standard and Express customers only)

**Note:** The renewal clock starts from NIF delivery date, not order creation date. This ensures customers receive a full year of fiscal representation before renewal is requested.

---

#### 11a — Renewal Email Sequence

Three emails sent automatically:

1. **At 11 months** — "Your fiscal representation expires in 30 days. Renew for €89/year to stay covered."
2. **At 11.5 months** — "Your fiscal representation expires in 15 days."
3. **At 12 months** — "Your fiscal representation has expired today."

After the third email, no further renewal emails are sent.

Each email contains:
- Clear explanation of what fiscal representation covers and what happens if they don't renew (they become unregistered with no representative — fines possible if they have PT tax obligations)
- Direct link to a new Stripe Checkout session for €89 renewal
- After July 1 2026: honest note on whether the customer likely still needs a fiscal rep based on whether they have declared Portuguese income — customers who probably don't need it are told so clearly

---

#### 11b — Renewal Checkout

**Steps:**
1. Customer clicks the renewal link in the email
2. If customer is not signed in → system redirects to `/signin` with the renewal checkout URL preserved as redirect destination
3. Customer signs in (or clicks "Forgot password" if needed)
4. After successful sign-in, customer is redirected to the renewal checkout URL
5. Customer lands on a new Stripe Checkout session — €89, fiscal representation renewal (order details pre-filled from their account)
6. Customer completes payment
7. Stripe webhook fires → system extends fiscal representation by 12 months from the current expiry date
8. Customer receives renewal confirmation email
9. Dashboard expiry banner is removed

**Outcome:** Fiscal representation extended by 12 months, customer notified

**Edge cases:**
- Customer is already signed in when clicking renewal link → skips steps 2-4, goes directly to Stripe checkout
- Customer clicks renewal link but their account has been deleted → redirect to sign-in fails, show error: "Account not found. Contact support if you need help."
- Customer completes payment but webhook fails → system retries webhook processing; if still failing after 5 minutes, admin receives alert to manually extend the renewal
- Customer clicks renewal link multiple times → each click generates a new Stripe Checkout session, but only one successful payment extends the renewal (duplicate payments are refunded automatically)

---

#### 11c — Expired State (customer did not renew)

**What the customer sees on the dashboard:**
- Dismissible banner: "Your fiscal representation expired on [date]. Renew to stay covered." — links to renewal checkout
- NIF number and order history remain fully accessible — expiry is not blocking
- Banner can be dismissed by clicking "I no longer need fiscal representation" — customer sees confirmation dialog: "Are you sure? You may face fines if you have Portuguese tax obligations." → if confirmed, banner is hidden permanently and no further renewal emails are sent
- If banner is dismissed, a small text link remains in account settings: "Renew fiscal representation" for customers who change their mind later

**Edge cases:**
- Customer renews after expiry (e.g. 2 months late) → system extends 12 months from the date of renewal payment, not from the original expiry date
- Customer dismisses banner but later wants to renew → clicks "Renew fiscal representation" link in account settings, goes through normal renewal checkout
- Customer is on Essential tier → no renewal flow, Essential does not include fiscal representation, no banner ever appears
