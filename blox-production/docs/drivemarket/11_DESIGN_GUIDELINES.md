# 11 — Design Guidelines (Mandatory)

**Product:** DriveMarket  
**Related:** [`06_UI_IA_SCREENS.md`](06_UI_IA_SCREENS.md) (IA only) · [`00_README.md`](00_README.md) · [`07_BUILD_PHASES.md`](07_BUILD_PHASES.md)

**This file is mandatory before any UI work.** Information architecture lives in `06`; visual and interaction design live here. Implementing agents must not improvise generic AI UI.

DriveMarket is a **new brand**, not a reskin of any other financing product. Other brand-token docs may be used only as a *format* reference (how to structure tokens and engineer do/don’t lists)—**never** as a palette to copy.

---

## 1. Brand direction

### Name & tagline

| Item | Value |
|------|-------|
| Brand | **DriveMarket** (working title — rename cascades here first) |
| Tagline (placeholder) | **Cars you can finance. Clearly.** |
| Voice | Confident, precise, high-trust. Short sentences. No hype slang. |
| Visual direction name | **Editorial Automotive Marketplace** |

### Personality

- Vehicle-forward and marketplace-first: the car is the hero, not a dashboard widget.
- Finance is calm infrastructure—clarity over spectacle.
- Qatar market: international, modern, daylight confidence; avoid neon fintech clichés.

### Logo clearspace (until final assets exist)

Reserve mark slots in code and layout even before final SVG/PNG delivery:

| Slot | Token / asset path (planned) | Use |
|------|------------------------------|-----|
| Wordmark light | `brand.logo.wordmarkOnDark` → `/brand/dm-wordmark-light.svg` | Dark hero / dark chrome |
| Wordmark dark | `brand.logo.wordmarkOnLight` → `/brand/dm-wordmark-dark.svg` | Light nav, auth cards |
| Mark only | `brand.logo.mark` → `/brand/dm-mark.svg` | Favicon, compact nav |
| Clearspace | Minimum **0.5× mark height** on all sides | Never crowd with chips/stats |

Until artwork lands, use typeset wordmark in the display font at nav size—do not substitute a random icon font car glyph as the logo.

### Brand test (locked)

If the first viewport could belong to another brand after removing the nav, branding is too weak. The wordmark or typeset brand name must be a **hero-level signal**, not only nav text.

---

## 2. Color tokens

CSS prefix: `--dm-*`.  
Implementation: `packages/shared/src/config/brand-tokens.ts` + `packages/shared/src/styles/global.scss`.

### 2.1 Named direction — “Gulf Graphite & Signal Amber”

A cool graphite foundation with a single precious amber CTA. Daylight canvas. No purple wash. No cream/terracotta default. No lime-teal clone of other products.

| Token name | CSS variable | Hex | Role |
|------------|--------------|-----|------|
| Graphite 980 | `--dm-graphite-980` | `#0B1215` | Deepest chrome, hero overlays |
| Graphite 900 | `--dm-graphite-900` | `#121A1E` | Primary dark surfaces, side nav |
| Graphite 800 | `--dm-graphite-800` | `#1C282E` | Elevated dark panels |
| Graphite 700 | `--dm-graphite-700` | `#2A3A42` | Borders on dark |
| Ink | `--dm-ink` | `#142027` | Primary text on light |
| Slate 600 | `--dm-slate-600` | `#5A6B73` | Secondary text |
| Slate 400 | `--dm-slate-400` | `#8A9AA2` | Tertiary / placeholders |
| Slate 200 | `--dm-slate-200` | `#D5DEE3` | Hairline borders light |
| Canvas | `--dm-canvas` | `#EEF2F4` | Page background (cool mist) |
| Surface | `--dm-surface` | `#FFFFFF` | Content surfaces |
| Surface muted | `--dm-surface-muted` | `#F5F8F9` | Zebra / inset |
| Signal Amber | `--dm-amber` | `#E6A100` | **CTA precious** — rare |
| Amber deep | `--dm-amber-deep` | `#B87B00` | Amber pressed / text on light amber wash |
| Sky Steel | `--dm-steel` | `#2F6F8F` | Interactive everyday (links, secondary, focus) |
| Steel soft | `--dm-steel-soft` | `#E3EEF4` | Soft selected / chip wash |
| Success | `--dm-success` | `#1B7F5A` | Paid / positive |
| Success soft | `--dm-success-soft` | `#E6F5EF` | |
| Warning | `--dm-warning` | `#C47A00` | Overdue caution (not CTA) |
| Warning soft | `--dm-warning-soft` | `#FFF4E0` | |
| Danger | `--dm-danger` | `#B42318` | Reject / destructive |
| Danger soft | `--dm-danger-soft` | `#FCEBEA` | |

### 2.2 Role mapping

| Role | Token | Where |
|------|-------|-------|
| Foundation / structure | Graphite 900–980 | Marketplace hero overlay edge, ops side nav, auth dark panel |
| Surface / canvas | Surface on Canvas | Forms, tables, listing areas below hero |
| Interactive everyday | Sky Steel | Links, secondary buttons, active nav, focus ring pair |
| CTA (precious) | Signal Amber | **One** primary hero action per view (and/or one headline money figure accent—never both competing) |
| Neutrals | Slate scale | Secondary text, hairlines, disabled |
| Success / warning / danger | Semantic tokens | Status only—not decoration |

### 2.3 Amber vs Steel (core rule)

- **Steel** = the color you interact with all day.
- **Amber** = the color you *notice*. If two amber CTAs fight on one screen, one is wrong.
- **Never** put white text on Signal Amber — use Graphite 980 / Ink on amber (`#142027` on `#E6A100`).
- **Never** put amber text on white at small sizes without checking contrast; prefer amber as fill with dark text.

### 2.4 Application status chip colors

| `application_status` | Background | Text |
|----------------------|------------|------|
| draft | `--dm-surface-muted` | `--dm-slate-600` |
| under_review | `--dm-steel-soft` | `--dm-steel` |
| resubmission_required | `--dm-warning-soft` | `--dm-warning` |
| contract_signing_required | `#E8E4F0` optional soft violet-gray **or** steel-soft | Ink — prefer steel-soft to avoid purple brand drift: use `--dm-steel-soft` / `--dm-graphite-800` |
| contracts_submitted | `--dm-steel-soft` | `--dm-graphite-800` |
| contract_under_review | `--dm-steel-soft` | `--dm-steel` |
| down_payment_required | `--dm-warning-soft` | `--dm-warning` |
| down_payment_submitted | `--dm-success-soft` | `--dm-success` |
| pending_finance_activation | `--dm-steel-soft` | `--dm-steel` |
| active | `--dm-success-soft` | `--dm-success` |
| completed | `--dm-surface-muted` | `--dm-slate-600` |
| rejected | `--dm-danger-soft` | `--dm-danger` |
| submission_cancelled | `--dm-surface-muted` | `--dm-slate-600` |

### 2.5 Listing status chips

| `listing_status` | Background | Text |
|------------------|------------|------|
| draft | muted | slate |
| published | success-soft | success |
| reserved | warning-soft | warning |
| sold | graphite-800 text on slate-200 | ink |
| archived | muted | slate |

### 2.6 Contrast rules

- Body text on canvas/surface: Ink on white/canvas — target **WCAG AA** (≥ 4.5:1).
- Amber CTA: dark text on amber fill ≥ 4.5:1.
- Do not use steel at light tints for small text on white without verification.
- Disabled: slate-400 on muted; do not rely on color alone.

---

## 3. Typography

### 3.1 Font families (locked)

| Role | Family | Notes |
|------|--------|-------|
| UI / editorial | **Fraunces** (soft optical sizing) for display; **Source Serif 4** alternative if Fraunces unavailable — prefer **Fraunces** display + **Manrope** for UI body | Expressive, not default sans stack |
| UI body / chrome | **Manrope** | 400–700 |
| Numbers / money / rates / QID / tenure | **IBM Plex Mono** or **JetBrains Mono** tabular | Lock: **IBM Plex Mono** |

**Forbidden as primary brand fonts:** Inter, Roboto, Arial, Helvetica, system-ui, Poppins, Open Sans.

Load via self-hosted files or Google Fonts in shared `global.scss`; apps must not each pick different families.

### 3.2 Scale

| Token | Size / line | Weight | Use |
|-------|-------------|--------|-----|
| `--dm-text-display` | 48px / 1.1 (mobile 36) | Fraunces 600 | Home hero headline only |
| `--dm-text-h1` | 32px / 1.2 | Fraunces 600 | Page titles |
| `--dm-text-h2` | 24px / 1.25 | Manrope 650 | Section titles |
| `--dm-text-h3` | 18px / 1.3 | Manrope 650 | Card/listing titles |
| `--dm-text-body` | 16px / 1.5 | Manrope 400 | Body |
| `--dm-text-body-sm` | 14px / 1.45 | Manrope 400 | Tables, secondary |
| `--dm-text-caption` | 12px / 1.4 | Manrope 500 | Labels, chips |
| `--dm-text-money` | 16–28px contextual | IBM Plex Mono 500–600 | Prices, installments |

Tracking: display −0.02em; H1 −0.015em; body 0.

### 3.3 Money / numeric class

```html
<span class="dm-money">QAR 185,000</span>
<span class="dm-numeric">12.5%</span>
```

Always tabular figures. Currency code or symbol consistent via shared formatter (`Intl`, QAR).

---

## 4. Layout & composition

### 4.1 Grid & spacing

- **8pt grid.** Spacing tokens: 4, 8, 12, 16, 24, 32, 48, 64.
- Content max width marketplace: **1200px** for browse grids; hero full-bleed edge-to-edge.
- Ops content max: **1440px** for tables.
- Gutters: 16 mobile / 24 tablet / 32 desktop; money screens prefer 24–32.

### 4.2 Radius scale

| Token | Value | Use |
|-------|-------|-----|
| `--dm-radius-sm` | 8px | Inputs, chips |
| `--dm-radius-md` | 12px | Buttons, controls |
| `--dm-radius-lg` | 16px | Listing cards, panels |
| `--dm-radius-xl` | 24px | Hero media mask only if needed—prefer square full-bleed |

Avoid `rounded-full` pill spam. Chips may use 999px only for small status pills sparingly.

### 4.3 Elevation

Max **two** shadow levels (cool graphite tint, never pure black):

| Token | Value (guidance) |
|-------|------------------|
| `--dm-shadow-1` | `0 1px 2px rgba(11, 18, 21, 0.06), 0 1px 3px rgba(11, 18, 21, 0.04)` |
| `--dm-shadow-2` | `0 8px 24px rgba(11, 18, 21, 0.12)` |

Hairline borders: `1px solid color-mix(in srgb, var(--dm-graphite-900) 8%, transparent)` or `--dm-slate-200`.

### 4.4 Marketplace home — first viewport (locked)

**One composition, not a dashboard.**

Allowed in the first viewport:

1. Brand (wordmark or large typeset name)
2. One headline
3. One short supporting sentence
4. One CTA group (primary + optional ghost)
5. One dominant **full-bleed** vehicle image (edge-to-edge)

**Forbidden in the first viewport:** stat strips, schedules, event listings, address blocks, promos, “this week” callouts, metadata rows, card grids, pill clusters, floating badges on the hero image, inset/side-panel hero cards, tiled collages.

Featured listings, trust copy, and browse strips belong **below** the fold.

### 4.5 Browse / search

Dense but scannable. Listing cards are allowed as **interaction containers** for selection. Prefer image-led cards with price in numeric font; avoid heavy multi-shadow card stacks.

### 4.6 Ops portals

Dealer / credit / finance / admin / super-admin may use denser tables and side nav. **Same token set**—density differs by shell, not by a second palette.

### 4.7 Atmosphere

- Hero: full-bleed photography with a soft graphite gradient scrim for text legibility (`linear-gradient` from graphite-980 at 55–70% opacity on the text side)—not a purple wash.
- Below fold: calm canvas; no gradients on ordinary cards.
- Optional subtle noise/grain only on hero, ≤ 3% opacity.

---

## 5. Components

### 5.1 Buttons

| Variant | Style | Use |
|---------|-------|-----|
| Primary | Amber fill + ink text | One per view hero action |
| Secondary | Steel outline or steel soft fill | Everyday |
| Ghost | Transparent + ink/steel text | Tertiary |
| Destructive | Danger fill + white text | Reject / delete confirms |

Height: 40px default; 48px primary on marketing. Radius `--dm-radius-md`. Do not use glow.

### 5.2 Inputs

- Height 40–44px; radius sm; hairline border slate-200; focus: steel ring 2px + soft steel halo.
- Labels above fields (not only placeholder).
- Errors: danger text + border; helper caption 12px.

### 5.3 Chips / status

Use tables in §2.4–2.5. Caption size; no emoji.

### 5.4 Tables (ops)

- Sticky header; zebra optional via surface-muted.
- Row height ≥ 48px for touch.
- Numeric columns right-aligned with `.dm-money`.

### 5.5 Listing card anatomy

1. Image 16:10 (browse)  
2. Make/model/year title (H3)  
3. Price `.dm-money`  
4. Optional dealer name (caption)  
5. Whole card clickable; no nested amber buttons on card face (CTA on detail)

### 5.6 Calculator block

- Clear tenure and down-payment controls.
- Monthly payment as the single amber-adjacent emphasis **or** large ink money—pick one emphasis.
- Disclaimer caption: estimate until underwriting.

### 5.7 Empty states

- Short headline + one sentence + one CTA.
- Optional monochrome line illustration of a vehicle silhouette—no stock handshake photos, no emoji.

### 5.8 Navigation

| Shell | Pattern |
|-------|---------|
| Marketplace | Top nav: brand left; Vehicles, Help; auth right |
| Ops | Side nav graphite-900; active item steel accent bar |

### 5.9 Modals & toasts

- Modal: surface, radius lg, shadow-2; focus trap.
- Toast: slate/ink; success/danger variants; auto-dismiss 4–6s; no stacked rainbow toasts.

---

## 6. Motion

**Maximum 2–3 intentional motions** product-wide:

1. **Surface lift** — listing card / secondary button hover: `translateY(-2px)` + shadow-1 → shadow-2.  
2. **Content fade** — route section enter: opacity 0→1, 160–220ms.  
3. **CTA accent** — primary amber hover: slight brightness to amber-deep border; no bounce.

| Token | Value |
|-------|-------|
| Easing | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Fast | 120ms |
| Base | 180ms |
| Slow | 240ms |

Honor `prefers-reduced-motion: reduce` — disable lift/fade; instant state changes.

No decorative particle fields, no continuous glow pulses, no parallax noise on ops screens.

---

## 7. Imagery

- Prefer **real vehicle photography** (dealer uploads). Neutral daylight or soft showroom; avoid heavy Instagram filters.
- Hero: one car, dominant, edge-to-edge. No floating badge stickers on the image.
- Aspect ratios: browse card **16:10**; detail gallery main **16:9**; thumbnails **1:1**.
- Do not use stock “handshake,” “happy family with keys,” or generic fintech gradient meshes as the main visual idea.
- Alt text required for listing images (make/model/year).

---

## 8. Marketplace vs ops

| Concern | Marketplace | Ops |
|---------|-------------|-----|
| First impression | Editorial hero | Utility dashboard OK |
| Density | Comfortable | Compact tables |
| Primary CTA color | Amber rare | Amber for the single commit action on a detail view; steel elsewhere |
| Tokens | Same `--dm-*` | Same `--dm-*` |
| Cards | Listing cards for selection | Prefer tables; cards only for interaction groupings |

---

## 9. Soft white-label (dealer portal)

From `companies.branding` + `logo_url`:

| May override | Must not override |
|--------------|-------------------|
| Dealer portal logo in side nav header | Marketplace public chrome / home hero brand |
| Primary accent (maps to steel **or** a single accent used like steel—not a second amber) | Signal Amber CTA semantics (keep amber as platform CTA) |
| | Typography families |
| | Status semantic colors |
| | Canvas/surface system |

**Contrast safeguard:** if overridden accent fails AA next to white/ink, fall back to `--dm-steel` and show admin/dealer warning.

Public listing detail may show dealer name + small logo near specs; the page remains DriveMarket-branded.

---

## 10. RTL / Arabic readiness

Ship hooks from day one even if English-only copy:

- Use logical properties: `margin-inline`, `padding-inline`, `inset-inline-start`, etc.
- Mirror nav order under `[dir="rtl"]`.
- Keep QAR amounts and QID in numeric font; Western numerals acceptable for MVP money.
- When Arabic enabled: add **Noto Naskh Arabic** or **IBM Plex Sans Arabic** for body; do not force Fraunces on Arabic runs.
- Calculator layout must not break when labels lengthen.

---

## 11. Accessibility

| Requirement | Bar |
|-------------|-----|
| Contrast | WCAG AA for text and amber CTA |
| Focus | Visible steel + graphite focus ring on all interactive elements |
| Hit targets | ≥ 40px (44px preferred on mobile primary) |
| Keyboard | Full apply wizard, auth, pay without mouse |
| Images | Alt text |
| Status | Not color-only—chip text label always |
| Motion | `prefers-reduced-motion` |
| Forms | Labels associated; errors announced |

---

## 12. Engineer do / don’t

### Do

- Implement tokens in `brand-tokens.ts`, `theme.ts`, `global.scss` and consume via CSS variables / MUI theme overrides.
- Use `.dm-money` / `.dm-numeric` for money, rates, QID, tenure.
- Keep one amber primary action per view.
- Build marketplace home as one full-bleed composition per §4.4.
- Use listing cards only as selection containers.
- Share one palette across marketplace and ops.
- Enforce server states; chips only reflect Postgres status.
- Wire Phase 0/1 acceptance to this document’s visual QA checklist.

### Don’t

- Don’t use purple-on-white or purple-to-indigo gradients.
- Don’t use warm-cream (`#F4F1EA`-like) + terracotta defaults.
- Don’t use broadsheet newspaper dense hairline multi-column marketing layouts.
- Don’t use Inter, Roboto, Arial, system-ui, Poppins as primary fonts.
- Don’t put white text on amber CTAs.
- Don’t ship emoji as UI ornament.
- Don’t stack multi-layer black shadows or glow effects.
- Don’t spam `rounded-full` pills in the hero.
- Don’t put stat strips, card grids, or floating badges in the first viewport.
- Don’t invent a second ops-only rainbow theme.
- Don’t hide reserved/sold cars as available through styling hacks—status is server-driven.

---

## 13. Implementation map

| Surface | Path (new repo) |
|---------|-----------------|
| Token constants | `packages/shared/src/config/brand-tokens.ts` |
| MUI theme | `packages/shared/src/config/theme.ts` |
| CSS variables + fonts | `packages/shared/src/styles/global.scss` |
| Status chip map | `packages/shared/src/config/status-styles.ts` |
| Money component | `packages/shared/src/components/MoneyText.tsx` |
| Flutter later | `apps/mobile/lib/core/theme/dm_tokens.dart` (Phase 5) |

MUI overrides must map `palette.primary` to steel for everyday components and expose amber as `palette.warning` **or** a custom `brand.cta`—do not let MUI default purple primary ship.

Example CSS variable block (authoritative hex in §2.1):

```scss
:root {
  --dm-graphite-980: #0b1215;
  --dm-graphite-900: #121a1e;
  --dm-ink: #142027;
  --dm-canvas: #eef2f4;
  --dm-surface: #ffffff;
  --dm-amber: #e6a100;
  --dm-steel: #2f6f8f;
  --dm-success: #1b7f5a;
  --dm-danger: #b42318;
  --dm-font-display: "Fraunces", "Times New Roman", serif;
  --dm-font-ui: "Manrope", "Segoe UI", sans-serif;
  --dm-font-mono: "IBM Plex Mono", ui-monospace, monospace;
  --dm-ease: cubic-bezier(0.22, 1, 0.36, 1);
}
```

---

## 14. Visual QA checklist

Run before marking Phase 0/1 UI done and before any UI-heavy PR merge.

### Marketplace

- [ ] Login / auth panel: brand-forward; fonts correct; no purple MUI default
- [ ] Home first viewport: brand + one headline + one support + CTA group + full-bleed vehicle; no stats/pills/cards in hero
- [ ] Browse: scannable listing cards; prices tabular
- [ ] Listing detail: gallery, calculator, single primary Apply CTA
- [ ] One money view (calculator or schedule): `.dm-money` used

### Dealer

- [ ] Login
- [ ] Inventory list
- [ ] Inventory detail / editor
- [ ] Applications list (read-only financing)

### Credit

- [ ] Login
- [ ] Queue list
- [ ] Application detail with actions
- [ ] Status chips match §2.4

### Finance

- [ ] Login
- [ ] Schedule / application money view
- [ ] No Activate button present

### Admin / Super-admin

- [ ] Login
- [ ] One list + one detail
- [ ] Activity log (super-admin) readable density

### Cross-cut

- [ ] Focus rings visible
- [ ] Amber never carries white text
- [ ] No Inter/Roboto primary
- [ ] Reduced-motion respected
- [ ] Reserved/sold not styled as freely available

---

## 15. Phase acceptance tie-in

Per `07_BUILD_PHASES.md`:

- **Phase 0:** tokens file + theme wired + marketplace home matches §4.4.  
- **Phase 1:** browse/detail/apply follow components herein; visual QA marketplace home + detail signed.  
- Later phases inherit the same system; white-label rules apply in Phase 5.

Failure to follow this document is a **product defect**, not a stylistic preference.
