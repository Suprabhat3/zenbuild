# ZenBuild styles — how theming works

One theme, defined once, applied everywhere. There are no scope wrappers that
gate the theme; a brand-new page with zero styling work renders correctly.

## Token source of truth

All palette, elevation, font, and shadcn tokens live on `:root` in
[`src/app/globals.css`](../app/globals.css), in the `tokens` cascade layer:

- **`--zb-*`** — the warm editorial palette (cream/ink/rose/gold/sage),
  shadow scale, and nothing else. These are the only places hex values may
  appear.
- **`--font-display`** (Instrument Serif) / **`--font-body`** (Schibsted
  Grotesk) — full font stacks. The raw `next/font` variables
  (`--font-*-src`) are injected by the root layout; never reference them
  directly.
- **shadcn bridge** — `--background`, `--card`, `--primary`, `--radius`, …
  are aliases of `--zb-*` values so every shadcn/base-ui primitive is themed
  automatically.

**Never** redefine a palette value in a surface stylesheet. If a surface
needs a local shorthand (landing does), alias it:
`--accent: var(--zb-accent);`.

## Fonts

Tailwind's `font-sans` → `--font-body` and `font-heading` → `--font-display`
(mapped in `@theme inline`). Prefer the utilities over hand-written
`font-family` rules in new code.

## Stylesheet map

| File | Namespace | Used by |
|------|-----------|---------|
| `app/globals.css` | tokens + element base | everything |
| `styles/app.css` | `.app-*` (+ `[data-slot]` overrides for shadcn) | authenticated app shell |
| `styles/auth.css` | `.auth-*`, `.onb-*`, `.otp-*` | auth, onboarding, error/404 |
| `styles/landing.css` | everything scoped under `.landing` | marketing homepage only |
| `styles/legal.css` | `.legal-*` | terms/privacy |

Rules:

1. **Every selector is namespaced** — either by class prefix (`.app-`,
   `.auth-`, `.legal-`) or by an ancestor scope (`.landing .btn`). No generic
   global class names (`.btn`, `.tile`, `.nav`, …) may exist at top level.
   Landing markup keeps its short class names; the `.landing` wrapper on
   `app/page.tsx` provides the scope.
2. **When to write a class vs Tailwind utilities**: reusable visual patterns
   (panels, chips, steppers) get an `.app-*` class here; one-off spacing and
   layout tweaks use Tailwind utilities in the component.
3. All stylesheets are imported once, in the root layout, in this order:
   globals → landing → auth → legal → app.
4. Single light theme (locked decision, docs/enhancement.md). The `dark`
   custom-variant exists only to keep stray `dark:` utilities inert.
