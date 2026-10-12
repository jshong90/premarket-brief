# Dashboard component system

The rebuild is incremental. Preserve rendered markup, token values, topic filtering,
accessibility relationships and motion hooks before moving on to the next layer.

## Inventory and migration order

| Layer | Existing roles | Migration |
| --- | --- | --- |
| Tokens | Theme colors, UI/editorial fonts, text sizes, card inset, motion values | Centralized in globals.css; preserve Design Lab bindings |
| Repeated content | Commentary label/body/empty state, numbered section heading | Extracted into components/brief in increment 1 |
| Numeric displays | Price, yield, percent/basis-point change, timestamp, missing value | Extracted formatNumeric / NumericCell in increment 2 |
| Tables | Indices, Treasury yields, key levels | Shared BriefTable shell and NumericCell in increment 2 |
| Cards/layout | Card surface, header, body, stack, paired columns | Later: preserve selector hooks used by animations and responsive layout |
| Controls | Jump link, disclosure, theme toggle, Design Lab inputs | Later: consolidate only repeated behavior; reuse existing UI components |
| Sections/page | Brief, market context, calendar, earnings, scanner | Compose migrated building blocks; retain feature-specific logic |

## Increment 1

`CommentaryNotes` owns label/body/empty-state markup. It accepts only title/body
content, so it does not depend on snapshot formats, quote providers or source rules.
Equity, Bond and Energy all use it. Container placement remains with each section:
commentary beneath a table differs structurally from a standalone card body.

`SectionHeading` owns the numbered h2 heading. Callers provide its id, title and
number; parent sections retain aria-labelledby. It creates no extra wrapper.

Both components retain existing CSS classes. Styles remain token-driven in the
single stylesheet, and Design Lab continues targeting those roles. No new CSS,
state, packages or per-section appearance overrides were introduced.

## Rules for subsequent increments

- Migrate one repeated pattern at a time; do not wrap every HTML element.
- Use role-specific props, not a universal component with arbitrary style props.
- Keep data calculations, provenance and collection out of presentation primitives.
- Preserve semantic heading levels, table scopes, labels and reduced-motion behavior.
- Verify filled/empty and topic-selection states, desktop/mobile, both themes and
  Design Lab controls. Compare rendered markup when an extraction should be neutral.
- Roll back the increment with a commit revert; do not edit archived snapshots.

## Increment 2

`BriefTable` owns the scroll wrapper, native table, column headers and body. Its
indices/yields/levels roles retain their existing CSS hooks; feature adapters own
row headers, column titles, provenance and calculations. Calendar and scanner
tables are not forced into this briefing-specific shell.

`NumericCell` owns numeric formatting, optional observation time and movement
color. Price uses up to two decimals, yield uses three with %, percent changes
use two with a signed %, and basis-point changes use one with a signed bp.
Missing values use an em dash. Approximate inputs retain their tilde. The caller
explicitly selects standard or inverse movement colors: an increasing yield
retains the existing red treatment. Formatting never calculates or infers prices.

`numericFormat.ts` is the pure format/direction layer. Observation times remain
Eastern and DST-aware. Providers and snapshot validation remain upstream.

Verification: full tests/build, numeric unit/direction/DST tests, and whole-brief
HTML parity against the prior implementation in populated, empty, archive and
topic-filter states.
