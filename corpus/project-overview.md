# Project Overview — RemoteNIF v2

## Overview

RemoteNIF v2 is a web application that allows non-residents to apply for a Portuguese Tax Identification Number (NIF) online. It features a deadline-aware checkout, AI-powered document pre-checks, and internal operator queues to manage the manual government submission process.

---

## Goals

- Let authenticated users apply for a Portuguese NIF based on their deadline requirements.
- Provide a single-step checkout that pairs tier selection directly with timeline needs.
- Use AI to pre-verify customer documents (Passport, Proof of Address, signed Power of Attorney) to reduce manual admin review cycles.
- Provide a structured priority queue and pre-packaged document bundles for internal operators submitting applications to ebalcão.
- Handle automated fiscal representation renewal flows for users who legally require it under current regulations.

---

## Core User Flow

1. User views pricing tiers and selects a package based on their deadline.
2. User creates an account via email and completes checkout via Stripe.
3. User downloads a pre-filled Power of Attorney (POA), signs it, and uploads it alongside their passport and proof of address.
4. AI pre-checks documents, returning a status of Clear, Flagged (with actionable reason), or Error.
5. Admin manually reviews and approves the document package (this triggers the 48-hour SLA for Express orders).
6. Internal operator receives an alert, downloads the prepared package, and manually submits it to the AT portal (ebalcão).
7. Operator marks the order as submitted; system auto-updates status and notifies the user.
8. Operator enters the delivered NIF number into the admin panel.
9. System permanently displays the NIF on the customer's dashboard and sends a post-NIF informational guide.

---

## Features

### Tiers & Checkout

- **Essential (€79):** NIF only, no fiscal rep. 5 business day delivery. For EU/EEA residents or non-EU with no active PT tax ties.
- **Standard (€129):** NIF + 12 months fiscal representation. 5 business day delivery.
- **Express (€179):** NIF + 12 months fiscal representation. Application submitted within 48h of document approval. The 48h clock starts from document approval, not from payment or upload — this must be stated explicitly at checkout.
- **Deadline-aware UI:** Users select a tier directly based on the prompt "When do you need your NIF?".

### Status Dashboard

- Visual timeline of the application status.
- Estimated delivery date (based on Finanças processing times, shown as an estimate not a guarantee).
- Persistent display of the NIF number upon completion.

### AI Document Pre-Check

- Groq API (Llama 4 Scout) evaluates uploaded documents.
- Returns specific, actionable text for flagged items (e.g., "Utility bill is older than 3 months").
- Auto-escalates to manual admin review after 2 failed upload attempts. Customer sees: "Our team will review your documents within 4 hours."
- If AI review exceeds 30 seconds, badge updates to "Still reviewing…". On full timeout, transitions to manual review state.
- **Accepted proof of address documents:** utility bill (electricity, water, gas — not phone/TV) less than 3 months old; bank statement less than 3 months old; rental/lease agreement; official government letter with address.

### Admin & Operator Tools

- Admin panel to view orders, override AI document decisions, manually update order status with a note to the customer, and trigger email resends.
- Operator workflow tool featuring a priority queue (Express orders shown first with a countdown against the 48h SLA).
- Auto-bundling of customer documents into a single download for the operator.
- When an Express order's documents pass AI and admin review, the operator receives an immediate push notification or SMS — no queue polling required.

### Fiscal Rep Renewal

- Three automated reminder emails before expiry: 30 days before (≈ 11 months), 15 days before (≈ 11.5 months), and on expiry day — each containing a direct Stripe Checkout link for the €89/year renewal.
- Dynamic copy reflecting Decree-Law 44/2022 to advise users if they still legally require a fiscal representative based on Portuguese tax obligations.
- Renewal is handled via a new Stripe Checkout session linked in the renewal email — no saved payment method required.

### Post-NIF Journey Guide

Single automated email sent after NIF delivery. Contains the NIF number prominently and a link to the customer's dashboard. No editorial guide content in the email — recommending specific banks or explaining NHR/IFICI in an email creates bias and regulatory risk. Post-NIF guidance lives on the website (see v2 ideas below).

---

## Regulatory Context

Decree-Law 44/2022 (Ofício Circulado N.º 90057, July 2022) governs fiscal representative requirements:

- **EU/EEA residents:** never required to appoint a fiscal representative.
- **Non-EU/EEA residents with Portuguese tax obligations** (property ownership, rental income, employment, business activity): still legally required to appoint a fiscal representative.
- **Non-EU/EEA residents with no Portuguese tax obligations:** not required, provided they activate electronic notifications (_notificações eletrónicas_) on Portal das Finanças.

Fiscal representation cannot be marketed as a universal requirement. Standard and Express recurring value must be framed as compliance confidence (staying correctly registered, avoiding fines) — not as holding a mandate.

---

## Copy & Messaging Constraints

- Do **not** market Essential as EU-only. Use: _"No fiscal representation — suitable if you have no active tax ties in Portugal."_
- Do **not** imply fiscal rep is a universal legal requirement — it is not.
- The Express 48h commitment must specify it starts from document approval, not payment. Exact expected copy: _"Your 48-hour window begins once your documents pass review."_
- The estimated delivery date on the dashboard must be clearly marked as an estimate outside the product's control once the application is submitted.
- The Post-NIF Journey Guide email is intentionally minimal: NIF number + dashboard link only. No bank recommendations, no tax regime guidance in email.

---

## Constraints & Resolved Decisions

### Launch Gates

- The Express tier must not launch until at least 10 test applications have completed the full 48h submission cycle successfully.
- The product requires a licensed Portuguese fiscal representative (advogado or solicitador) under contract before any orders can be processed. This is a legal requirement, not a technical one.

### Resolved Technical Decisions

- **Checkout UI (Q1):** Deadline selector and tier cards are on a single screen — no separate step. Cards gray out in real time based on the selected deadline.
- **AI document review (Q2):** Synchronous with progressive badge states (Uploading → Reviewing… → Approved ✓). 30-second timeout triggers graceful degradation. No email sent while the customer is still on screen.
- **Fiscal rep renewal payment (Q3):** New Stripe Checkout session per renewal — no stored payment method. Renewal email contains the direct link.

---

## Scope

### In Scope

- Next.js 16 App Router UI and Server Actions.
- Supabase Authentication and Database setup.
- Stripe Checkout and webhook integration.
- Groq API (Llama 4 Scout) integration for document review.
- Internal admin dashboard and operator queues.
- Resend transactional emails.
- Internationalization (i18n) for EN, FR, ES, and DE.

### Out of Scope

- Tax advice or tax return filing.
- Business NIFs (Pessoa Coletiva).
- Visa applications (D7, D8, Golden Visa).
- Portuguese bank account opening workflows.
- NISS (Social Security) registration.
- Automated API submissions to Finanças/ebalcão (must remain a manual human step).
- Multi-currency pricing (EUR only).
- Mobile-native applications.

---

## Success Criteria

| Metric                                                   | Target |
| -------------------------------------------------------- | ------ |
| Checkout completion rate (order created → payment)       | ≥ 60%  |
| Express orders submitted within 48h of document approval | ≥ 98%  |
| Support tickets per order                                | < 0.3  |
| Fiscal rep renewal rate at 12 months                     | ≥ 55%  |

### Failure Signals

- < 40% checkout completion → pricing or trust is broken.
- > 5% of Express orders miss the 48h SLA → pause the Express tier.
- Fiscal rep renewal rate < 30% after regulatory change → rebuild recurring model around tax compliance packages.

---

## v2 Ideas

Ideas deferred from v1 — not blocking launch, revisit after the product is live and generating real usage data.

### Post-NIF Content Hub

A dedicated area on the website (or inside the customer dashboard) with curated post-NIF guidance. Better format than an email for detailed, linkable content. Potential sections:

- **Opening a Portuguese bank account** — balanced overview of options (online banks, traditional banks), no single recommendation. Affiliate/referral links can be added here once partners are confirmed.
- **Buying property in Portugal** — what the NIF is needed for and when (promissory contract, deed signing).
- **NHR / IFICI tax regime** — what it is, who might qualify, clear recommendation to consult a licensed tax adviser. Neutral framing — not legal advice.
- Could be implemented as a blog, a static `/resources` section, or a "What's next?" tab inside the delivered-state dashboard view.
