# UI Context

<!-- This file defines the visual language, design tokens, component patterns, and interaction states for the entire application. All UI implementation must reference these tokens — no hardcoded values. -->

---

## Design System Architecture

**Two-layer token structure:**

1. **Primitive colors** — raw OKLCH values named after the color itself (e.g., `--color-blue-600`)
2. **Semantic tokens** — role-based tokens that reference primitives (e.g., `--brand-primary`)

**Rules:**
- Components use semantic tokens only — never primitives directly
- To retheme: reassign semantic tokens to different primitives
- To adjust a color: update the primitive — all semantic usages follow automatically
- All colors use OKLCH format for perceptual uniformity

**Color format — OKLCH:**
```
oklch(L% C H)
L = lightness  0–100%   (perceptually uniform)
C = chroma     0–0.37   (saturation)
H = hue angle  0–360    (0=red, 120=green, 240=blue)
```

---

## Color Tokens

### Backgrounds — Surface Elevation Model

Surfaces stack from outermost to innermost. Each layer is visually distinct.

| Token | Role | Primitive | Value |
|-------|------|-----------|-------|
| `--bg-base` | Page canvas, outermost layer | `--color-slate-50` | `oklch(98% 0.006 264)` |
| `--bg-surface` | Cards, panels — one level above base | `--color-white` | `oklch(100% 0 0)` |
| `--bg-elevated` | Modals, dropdowns, popovers | `--color-white` | `oklch(100% 0 0)` |
| `--bg-subtle` | Muted sections, tags, code blocks | `--color-blue-100` | `oklch(93% 0.04 250)` |

**Usage in Tailwind:**
- `bg-[var(--bg-base)]` or configure as custom Tailwind color: `bg-base`
- `bg-[var(--bg-surface)]` → `bg-surface`
- `bg-[var(--bg-elevated)]` → `bg-elevated`
- `bg-[var(--bg-subtle)]` → `bg-subtle`

---

### Text — Hierarchy and Emphasis

| Token | Role | Primitive | Value |
|-------|------|-----------|-------|
| `--text-primary` | Headings, main body copy | `--color-slate-950` | `oklch(22% 0.04 264)` |
| `--text-secondary` | Supporting text, labels | `--color-slate-700` | `oklch(45% 0.03 264)` |
| `--text-muted` | Placeholders, captions, disabled | `--color-slate-500` | `oklch(62% 0.02 264)` |
| `--text-on-accent` | Text/icons on colored backgrounds | `--color-white` | `oklch(100% 0 0)` |

**Usage:**
- `text-[var(--text-primary)]` → `text-text-primary`
- `text-[var(--text-secondary)]` → `text-text-secondary`
- `text-[var(--text-muted)]` → `text-text-muted`
- `text-[var(--text-on-accent)]` → `text-on-accent`

> ⚠️ **Do NOT use `text-primary` or `text-secondary`** — these are shadcn shorthands that
> resolve to brand orange and bg-subtle respectively, not text colours. Always use the
> prefixed form: `text-text-primary`, `text-text-secondary`, `text-text-muted`.

---

### Borders — Emphasis Scale

| Token | Role | Primitive | Value |
|-------|------|-----------|-------|
| `--border-subtle` | Light dividers, section separators | `--color-slate-200` | `oklch(92% 0.01 264)` |
| `--border-default` | Standard card and input borders | `--color-slate-300` | `oklch(88% 0.011 264)` |
| `--border-strong` | Emphasis borders, focused elements | `--color-slate-950` | `oklch(22% 0.04 264)` |

**Usage:**
- `border-[var(--border-subtle)]` → `border-border-subtle`
- `border-[var(--border-default)]` → `border-border-default`
- `border-[var(--border-strong)]` → `border-border-strong`

> ⚠️ **Do NOT use bare `border-default` or `border-subtle`** — shadcn's `--color-border`
> maps to `border-border` already. Always use the prefixed form to avoid ambiguity.

---

### Brand — Primary and Secondary Hierarchy

| Token | Role | Primitive | Value |
|-------|------|-----------|-------|
| `--brand-primary` | Main CTAs, key highlights | `--color-orange-500` | `oklch(62% 0.18 42)` |
| `--brand-primary-dim` | Hover states, subtle backgrounds | `--color-orange-100` | `oklch(95% 0.05 42)` |
| `--brand-secondary` | Supporting accents, secondary hierarchy | `--color-indigo-600` | `oklch(55% 0.18 275)` |

**Usage:**
- Primary button: `bg-[var(--brand-primary)] text-[var(--text-on-accent)]`
- Hover state: `hover:bg-[var(--brand-primary-dim)]`
- Secondary accent: `text-[var(--brand-secondary)]`

---

### Glass — Photo-Canvas Surfaces

> ⚠️ **Photo-canvas only.** These tokens exist for pages where UI sits on top of a full-bleed photograph (marketing hero, navbar overlay). Never use them on app-canvas pages (dashboard, auth, operator, admin).

| Token | Value | Usage |
|-------|-------|-------|
| `--glass-navbar-bg` | `oklch(100% 0 0 / 0.10)` | Navbar background on photo pages |
| `--glass-navbar-border` | `oklch(100% 0 0 / 0.20)` | Navbar bottom border on photo pages |
| `--glass-badge-bg` | `oklch(100% 0 0 / 0.15)` | Badge/pill background on photo pages |
| `--glass-badge-border` | `oklch(100% 0 0 / 0.40)` | Badge/pill border on photo pages |
| `--glass-separator` | `oklch(100% 0 0 / 0.30)` | Stats row dividers on photo pages |
| `--glass-border-dark` | `oklch(0% 0 0 / 0.18)` | Thin dark edge on glass surfaces |
| `--glass-overlay` | `oklch(0% 0 0 / 0.35)` | Photo darkening gradient start value |
| `--glass-text` | `oklch(100% 0 0)` | All text rendered on photo backgrounds |
| `--glass-text-dim` | `oklch(100% 0 0 / 0.80)` | De-emphasised text on photo backgrounds |

---

### Status — Feedback States

| Token | Role | Primitive | Value |
|-------|------|-----------|-------|
| `--status-success` | Success messages, confirmations | `--color-emerald-500` | `oklch(70% 0.14 165)` |
| `--status-warning` | Warnings, cautions | `--color-amber-500` | `oklch(78% 0.13 75)` |
| `--status-error` | Errors, destructive actions | `--color-rose-600` | `oklch(62% 0.18 25)` |
| `--status-info` | Informational messages | `--color-sky-500` | `oklch(72% 0.11 230)` |

**Subtle variants — tinted backgrounds for state-bearing surfaces (8% opacity):**

| Token | Value | Usage |
|-------|-------|-------|
| `--status-success-subtle` | `oklch(70% 0.14 165 / 0.08)` | Tinted green background for success banners/states |
| `--status-warning-subtle` | `oklch(78% 0.13 75 / 0.08)` | Tinted amber background for warning banners/states |
| `--status-error-subtle` | `oklch(62% 0.18 25 / 0.08)` | Tinted rose background for error banners/states |
| `--status-info-subtle` | `oklch(72% 0.11 230 / 0.08)` | Tinted sky background for info banners/states |

**Usage:**
- Error text: `text-[var(--status-error)]`
- Success badge: `bg-[var(--status-success)] text-[var(--text-on-accent)]`
- Tinted banner: `bg-[var(--status-error-subtle)] text-[var(--status-error)]`

---

### Pricing Page — Glassmorphism Tokens (scoped — do not use elsewhere)

> ⚠️ **Pricing page only.** These tokens exist for the `/pricing` card treatment. Do not use on dashboard, auth, operator, or admin pages.

| Token | Value | Usage |
|-------|-------|-------|
| `--pricing-card-bg` | `oklch(100% 0 0 / 0.72)` | Semi-transparent white card face — background shows through |
| `--pricing-card-border` | `oklch(62% 0.18 42 / 0.30)` | Soft orange-tinted card border |
| `--pricing-glow` | `0 4px 6px -1px oklch(0% 0 0 / 0.07), 0 2px 4px -2px oklch(0% 0 0 / 0.05), 0 0 30px 8px oklch(62% 0.18 42 / 0.20)` | Featured card glow — shadow-md depth + ambient orange halo |

---

## Typography

### Font Families

| Token | Font | Usage |
|-------|------|-------|
| `--font-sans` | Inter | UI text, body copy, headings |
| `--font-mono` | JetBrains Mono | Code blocks, technical data, monospace UI |

**Implementation:**
- Load fonts via `next/font/google` or `@fontsource`
- Apply as CSS variables on `<html>` element
- Base `body` uses `font-[var(--font-sans)] antialiased`

---

### Type Scale

| Token | Size | Usage |
|-------|------|-------|
| `--text-2xs` | 0.625rem (10px) | Admin badge labels, micro-captions — below the standard floor |
| `--text-xs` | 0.75rem (12px) | Captions, badges, metadata |
| `--text-sm` | 0.875rem (14px) | Small body text, labels |
| `--text-base` | 1rem (16px) | Default body text |
| `--text-lg` | 1.125rem (18px) | Emphasized body text |
| `--text-xl` | 1.25rem (20px) | Small headings |
| `--text-2xl` | 1.5rem (24px) | Section headings |
| `--text-3xl` | 2rem (32px) | Page headings |
| `--text-4xl` | 2.5rem (40px) | Hero headings |

**Usage:**
- `text-[length:var(--text-base)]` or configure Tailwind: `text-base`
- `text-[length:var(--text-2xl)]` → `text-2xl`

---

### Font Weights

| Token | Weight | Usage |
|-------|--------|-------|
| `--font-normal` | 400 | Body text |
| `--font-medium` | 500 | Emphasized text, labels |
| `--font-semibold` | 600 | Subheadings, buttons |
| `--font-bold` | 700 | Headings, strong emphasis |

---

### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `--leading-tight` | 1.2 | Headings, compact UI |
| `--leading-normal` | 1.5 | Body text |
| `--leading-relaxed` | 1.6 | Long-form content |

---

## Spacing — 8px Grid

All spacing follows an 8px base grid for vertical rhythm and horizontal consistency.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 0.25rem (4px) | Tight inline spacing |
| `--space-2` | 0.5rem (8px) | Base unit |
| `--space-3` | 0.75rem (12px) | Small gaps |
| `--space-4` | 1rem (16px) | Default spacing |
| `--space-5` | 1.25rem (20px) | Medium gaps |
| `--space-6` | 1.5rem (24px) | Section spacing |
| `--space-8` | 2rem (32px) | Large gaps |
| `--space-10` | 2.5rem (40px) | Extra large gaps |
| `--space-12` | 3rem (48px) | Section breaks |
| `--space-16` | 4rem (64px) | Major layout spacing |

**Usage:**
- `p-[length:var(--space-4)]` or configure Tailwind: `p-4`
- `gap-[length:var(--space-6)]` → `gap-6`

---

## Border Radius — Surface Depth

Radius increases with surface depth — smaller for inner elements, larger for outer containers.

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 0.375rem (6px) | Inline elements, badges |
| `--radius-md` | 0.5rem (8px) | Inputs, small components |
| `--radius-lg` | 0.75rem (12px) | Cards, panels |
| `--radius-xl` | 1rem (16px) | Large cards |
| `--radius-2xl` | 1.5rem (24px) | Modals, sheets |
| `--radius-full` | 9999px | Pills, avatars |

**Usage:**
- `rounded-[length:var(--radius-lg)]` or configure Tailwind: `rounded-lg`
- `rounded-[length:var(--radius-2xl)]` → `rounded-2xl`

---

## Shadows — Elevation Hierarchy

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px 0 oklch(0% 0 0 / 0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px -1px oklch(0% 0 0 / 0.07), 0 2px 4px -2px oklch(0% 0 0 / 0.05)` | Cards |
| `--shadow-lg` | `0 10px 15px -3px oklch(0% 0 0 / 0.08), 0 4px 6px -4px oklch(0% 0 0 / 0.05)` | Dropdowns |
| `--shadow-xl` | `0 20px 25px -5px oklch(0% 0 0 / 0.10), 0 8px 10px -6px oklch(0% 0 0 / 0.05)` | Modals |

**Usage:**
- `shadow-[var(--shadow-md)]` or configure Tailwind: `shadow-md`

---

## Transitions

| Token | Value | Usage |
|-------|-------|-------|
| `--transition-fast` | 150ms ease | Micro-interactions |
| `--transition-base` | 200ms ease | Default transitions |
| `--transition-slow` | 300ms ease | Complex animations |
| `--transition-smooth` | 300ms cubic-bezier(0.4, 0, 0.2, 1) | Smooth easing |

**Usage:**
- `transition-[var(--transition-base)]` or configure Tailwind: `transition-base`

---

## Component Patterns

### Buttons

**Primary button:**
```tsx
<button className="bg-[var(--brand-primary)] text-[var(--text-on-accent)] 
  px-[length:var(--space-6)] py-[length:var(--space-3)] 
  rounded-[length:var(--radius-md)] font-[number:var(--font-semibold)]
  hover:opacity-90 transition-[var(--transition-base)]">
  Get Started
</button>
```

**Secondary button:**
```tsx
<button className="bg-[var(--bg-surface)] text-[var(--text-primary)] 
  border border-[var(--border-default)]
  px-[length:var(--space-6)] py-[length:var(--space-3)] 
  rounded-[length:var(--radius-md)] font-[number:var(--font-semibold)]
  hover:bg-[var(--bg-subtle)] transition-[var(--transition-base)]">
  Learn More
</button>
```

**Ghost button:**
```tsx
<button className="text-[var(--text-secondary)] 
  px-[length:var(--space-4)] py-[length:var(--space-2)]
  hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]
  rounded-[length:var(--radius-md)] transition-[var(--transition-base)]">
  Cancel
</button>
```

---

### Cards

**Standard card:**
```tsx
<div className="bg-[var(--bg-surface)] border border-[var(--border-default)]
  rounded-[length:var(--radius-lg)] p-[length:var(--space-6)]
  shadow-[var(--shadow-md)]">
  {/* Card content */}
</div>
```

**Elevated card (modal, dropdown):**
```tsx
<div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)]
  rounded-[length:var(--radius-2xl)] p-[length:var(--space-8)]
  shadow-[var(--shadow-xl)]">
  {/* Modal content */}
</div>
```

---

### Form Inputs

**Text input:**
```tsx
<input 
  type="text"
  className="bg-[var(--bg-surface)] text-[var(--text-primary)]
    border border-[var(--border-default)]
    rounded-[length:var(--radius-md)] 
    px-[length:var(--space-4)] py-[length:var(--space-3)]
    focus:border-[var(--brand-primary)] focus:outline-none
    placeholder:text-[var(--text-muted)]
    transition-[var(--transition-fast)]"
  placeholder="Enter your email"
/>
```

**Input with error:**
```tsx
<input 
  className="border-[var(--status-error)] focus:border-[var(--status-error)]"
/>
<p className="text-[var(--status-error)] text-[length:var(--text-sm)] mt-[length:var(--space-2)]">
  This field is required
</p>
```

---

### Badges

**Status badge:**
```tsx
<span className="inline-flex items-center gap-[length:var(--space-2)]
  bg-[var(--status-success)] text-[var(--text-on-accent)]
  px-[length:var(--space-3)] py-[length:var(--space-1)]
  rounded-[length:var(--radius-full)] text-[length:var(--text-xs)]
  font-[number:var(--font-medium)]">
  Active
</span>
```

**Neutral badge:**
```tsx
<span className="inline-flex items-center
  bg-[var(--bg-subtle)] text-[var(--text-secondary)]
  px-[length:var(--space-3)] py-[length:var(--space-1)]
  rounded-[length:var(--radius-full)] text-[length:var(--text-xs)]
  font-[number:var(--font-medium)]">
  Standard
</span>
```

---

## Layout Patterns

### Page Container

```tsx
<div className="min-h-screen bg-[var(--bg-base)]">
  <main className="max-w-7xl mx-auto px-[length:var(--space-6)] py-[length:var(--space-12)]">
    {/* Page content */}
  </main>
</div>
```

---

### Section Spacing

- Between major sections: `mb-[length:var(--space-16)]` (64px)
- Between subsections: `mb-[length:var(--space-12)]` (48px)
- Between related elements: `mb-[length:var(--space-6)]` (24px)
- Between form fields: `mb-[length:var(--space-4)]` (16px)

---

### Grid Layouts

**Two-column responsive:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-[length:var(--space-6)]">
  {/* Grid items */}
</div>
```

**Three-column responsive:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[length:var(--space-6)]">
  {/* Grid items */}
</div>
```

---

## Component Library

**shadcn/ui** on top of Tailwind. Components live in `components/ui/`.

**Rules:**
- Use the `shadcn` CLI to add new components — do not write from scratch
- Customize shadcn components by overriding their CSS variables to match our token system
- Never modify shadcn source files directly — extend via composition or wrapper components

---

## Icons

**Lucide React** — stroke-based icons only, no filled variants.

**Icon sizes:**
- Inline with text: `h-4 w-4` (16px)
- Buttons: `h-5 w-5` (20px)
- Feature icons: `h-6 w-6` (24px)
- Hero icons: `h-8 w-8` (32px)

**Usage:**
```tsx
import { Check, X, AlertCircle } from 'lucide-react'

<Check className="h-5 w-5 text-[var(--status-success)]" />
<X className="h-5 w-5 text-[var(--status-error)]" />
<AlertCircle className="h-5 w-5 text-[var(--status-warning)]" />
```

---

## Interaction States

### Hover States

- Buttons: reduce opacity to 90% or shift background to `--brand-primary-dim`
- Links: shift color from `--text-secondary` to `--text-primary`
- Cards: add subtle shadow lift or border color change

### Focus States

- Inputs: border color changes to `--brand-primary`
- Buttons: add focus ring with `focus-visible:ring-2 ring-[var(--brand-primary)] ring-offset-2`
- Links: underline appears

### Disabled States

- Reduce opacity to 50%
- Cursor changes to `cursor-not-allowed`
- Remove hover effects

### Loading States

- Show spinner or skeleton
- Disable interaction
- Maintain layout (no content shift)

---

## Accessibility

- All interactive elements must have visible focus states
- Color is never the only indicator of state — use icons or text labels
- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text
- All form inputs have associated labels (visible or aria-label)
- Buttons have descriptive text or aria-label (no icon-only buttons without labels)

---

## Copy and Tone

- **Concise and direct** — no marketing fluff
- **Honest about limitations** — "Typically 5–10 business days" not "Lightning fast!"
- **Action-oriented** — "Upload your documents" not "Documents can be uploaded"
- **Error messages are specific** — "Passport photo is too blurry" not "Invalid file"
- **Success messages are reassuring** — "Your documents have been approved" not just "Success"

---

## Implementation Checklist

When building a new component:

- [ ] Uses semantic tokens only (no hardcoded colors or spacing)
- [ ] Follows the spacing grid (multiples of 8px)
- [ ] Has hover, focus, and disabled states
- [ ] Is keyboard accessible
- [ ] Has proper ARIA labels where needed
- [ ] Matches the type scale and font weights
- [ ] Uses appropriate border radius for its depth
- [ ] Includes loading states if async
- [ ] Has error states if it can fail
- [ ] Copy is concise and action-oriented
