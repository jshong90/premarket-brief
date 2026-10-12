# Styling rules and audit

## Shared roles

- `--font-ui`: Source Sans 3, then Arial/Helvetica/sans-serif. Controls, data labels, and all commentary use this role.
- `--font-editorial`: Newsreader, then Georgia/serif. Page/section headings and general briefing notes use this role.
- `--commentary-label-size`: 14px, weight 600, line height 1.5.
- `--commentary-body-size`: 13px, weight 400, line height 1.6.
- `--brief-body-size`: 14px desktop / 13px mobile for general briefing notes.
- `--card-inset`, `--card-gap`, and `--card-radius`: shared card geometry.

Equity, Bond, and Energy commentary share `CommentaryNotes` in `MorningBrief.tsx`, including heading level, label/body classes, paragraph whitespace, separators, and empty states. Energy has a card-body inset; the indices/bonds commentary begins below a table. These are structural containers, with no section-specific typography.

Design Lab changes the role tokens. Its Brief text control applies to every commentary body and general briefing note. Its Card headings control applies to every commentary label. Fonts are declared once; component rules consume font tokens.

## October 12 audit

The global stylesheet had 1,239 rules, 3,366 declarations, and 49 priority declarations. The cleanup removes 310 shadowed declarations and 273 unused selector entries from prior layouts, including the former separate overview, retired sector panel, and compact standalone bond-card patches. The remaining sheet has 926 rules and 2,651 declarations before build optimization.

The eight remaining `!important` declarations are reduced-motion safeguards, including the development reduced-motion switch. Ordinary typography, theme, surface, and control styling no longer uses `!important`. The connection diagnostic uses shared surface, border, success, and error tokens rather than separate theme literals.

Theme, responsive, focus/hover, and development states remain explicit CSS variants. Resilience and price colors retain their semantic roles. Grouped selectors were split only to remove an earlier property already superseded by the same selector in the same context; surviving rules retain cascade order.

## Change protocol

Edit the existing component role or theme token. Avoid appending a corrective rule at the bottom of the sheet. Add a variant only when there is a real state or breakpoint difference. Do not use ARIA attributes to repair a section's typography.

`tests/text-tokens.test.mjs` parses the authored CSS and rejects:

- Literal text colors or repeated UI/editorial font definitions in component rules.
- Repeated selector/property declarations in the same media/state context.
- Empty selectors.
- `!important` outside reduced-motion safeguards.

Run the suite and production build, then inspect a preview in both themes. Verify commentary labels and bodies through computed styles, and verify production's commit matches the tested release. A successful build alone does not prove the production alias is serving that commit.

The subsequent ownership migration replaces globals.css with an import manifest. Current stylesheet locations and verification evidence are documented in [CSS ownership](css-ownership.md); the cleanup figures above describe the earlier audit.
