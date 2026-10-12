# CSS ownership

`src/globals.css` is now an import manifest, not a place to append styles. The
legacy monolith has been replaced by the owned stylesheets below. They compile
through the same Vite/PostCSS entry; there is no additional runtime loader.

| Owner | Stylesheet | Responsibility |
| --- | --- | --- |
| Foundations | src/styles/foundations.css | Theme/geometry/font tokens, reset foundations, Tailwind token mapping |
| Shared UI/layout | src/styles/shared.css | Page layout, common controls, surfaces, headings, utilities and reference frame |
| Header/context | src/features/dashboard/DashboardHeader.css | Navigation, dates, theme placement and market context |
| Briefing | src/features/briefing/Briefing.css | Brief cards, commentary, tables, calendar, earnings and sources |
| Scanner | src/features/dashboard/Scanner.css | Rankings, benchmark cards, scale, drawers and scanner states |
| Builder | src/features/briefing-builder/BriefingBuilder.css | Topic-selection page |
| Archive | src/pages/ArchivePage.css | Snapshot archive page |
| Motion | src/styles/motion.css | Shared reveal/reduced-motion behavior and keyframes |
| Design Lab | src/features/design-lab/DesignLabs.css | Lab UI and explicit development overrides of shared tokens |
| Connection diagnostic | src/features/connections/MassiveConnectionTest.css | Diagnostic component, imported by that component |

## What was removed

- 98 base declarations already overridden by explicit rules in both themes.
- The retired red briefing-section heading selector, absent from current markup.
- 20 obsolete dark fallback token values, aligned to the active dark theme.
- Historical patch comments; stylesheet ownership replaces conversational history.
- Ten scattered token blocks were consolidated before component rules were merged.

Older active rules were retained and rewritten into their owners. Responsive,
theme, hover/focus, empty/loading, drawer, archive and reduced-motion states are
supported behavior, not dead CSS. Do not infer unused code from one initial view.

## Change protocol and guardrails

Edit a component's existing role in its stylesheet. Put palette and shared sizes
in foundations. Keep theme/responsive/state variants with their owner. Do not
add a competing override to globals.css or create a second appearance system.
The import order is deliberate: foundations/shared, feature styles, motion,
then explicit development controls. Changes to order require cascade review.

`tests/text-tokens.test.mjs` follows all authored stylesheet imports and checks
for duplicate selector/property declarations across owners, hardcoded text/fonts,
empty selectors and non-accessibility !important. It also enforces that globals.css
contains imports only. Third-party CSS is kept separate from authored rules.

Use the visual reference and its responsive frame for review. Compare both themes,
stock details, sorting/filter controls, disclosures, motion and archived snapshots
before release. Synthetic examples never enter the published snapshot data.

## Verification of this migration

The preview matched all sampled computed properties of 110 component elements
against the original stylesheet in both themes (zero differences). Checks covered
colors, backgrounds, typography, padding/margins/gaps, borders, display and grid
columns. Five responsive frame widths had no document overflow. Sources expansion,
stock details, Design Lab text controls, builder and all eight archive entries were
verified. Full tests and production build passed. The comparison is broad evidence
of preserved appearance; future states still need the normal component review.
