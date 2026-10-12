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
| Cards/layout | Card surface, header, body, stack, paired columns | BriefCard, BriefStack and OvernightPair in increment 3 |
| Controls | Jump link, disclosure, theme toggle, Design Lab inputs | SectionJump and SourcesDisclosure in increment 4; existing UI controls retained |
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

## Increment 3

`BriefCard` composes the section surface, accessible numbered heading and body.
Four named roles preserve structural needs: notes, standalone commentary, key
levels, and the combined overnight layout. They select existing classes and body
wrappers; they do not add appearance overrides or new CSS.

`BriefStack` owns section stacking. `OvernightPair` owns paired/single-topic classes,
so the responsive layout continues using the original selectors. Topic visibility
and content stay in the feature. No wrapper elements were added. Sources retains
its disclosure-specific structure for the controls increment.

Verification: identical whole-brief markup across 24 content, archive and topic
selection states; tests/build and deployment checks. Existing theme, Design Lab
and viewport-motion selectors continue matching the same elements.

## Increment 4

`SectionJump` is the shared native fragment link for navigation between brief
and scanner. Callers supply the content; classes, arrows and targets are preserved.

`SourcesDisclosure` owns the disclosure state, toggle button, expanded/controls
attributes, animated reveal and inert collapsed content. Reference collection and
citation rendering remain in the briefing feature. The content id is fixed because
the page has one Sources disclosure. Do not mount several copies on one page
without first making their ids unique.

Existing theme toggles, Design Lab sliders and form controls already have their
own behavior; this increment does not create a universal control abstraction.
Verification includes whole-brief HTML parity and browser open/close checks.

## Increment 5: briefing section composition

MorningBrief now assembles dedicated OvernightMovements, MacroCalendar,
EarningsCalendar, KeyLevelsTable and SourcesCard feature components. It retains
section order, topic selection and page-level headings/navigation. Each feature
uses the shared presentation primitives and owns its existing data adaptation.

Key-level types and futures-session labeling are shared within the briefing
feature, avoiding copies between the key-level table and Sources. Imports are
direct; there is no component registry, new state layer or dynamic loader.

Whole-brief markup matches the prior implementation across 24 states; full tests
and build pass. Snapshot schemas, data collection, citations and market formulas
are unchanged. Header/market-context and scanner composition remain separate
future increments; the entire dashboard migration is not yet complete.

The archive audit also found an existing invalid-date conversion for undated macro titles. Source-month fallback now checks the Date value before conversion; undated labels and unconfirmed times remain undated. A regression test covers dated and undated source resolution.

## Increment 6: header and scanner overview

DashboardHeader composes navigation, the session date, ThemeToggle and the existing
MarketContextStrip. ScannerOverview renders the benchmark, leaders and coverage
cards. ResilienceScale owns the mode-independent classification display. The page
passes callbacks; snapshot loading, filter/selection state and calculations remain
centralized. Scanner display formatters moved unchanged into scannerDisplay.ts;
they retain the scanner's distinct precision and 24-hour timestamp conventions.

Before/after markup matches in 24 header/overview/scale combinations covering
compact state, archive navigation and imported/current modes. Full tests/build
pass. Scanner rankings, drawers and status footer remain the next composition step.

## Increment 7: rankings, drawers and footer

ScannerRankings composes the existing table, tabs, filters and empty states.
ScannerInfoDrawer owns information/connections presentation; InstrumentDrawer
owns the selected-stock presentation. SnapshotStatus renders observation/cutoff
status. ScannerRow and SortKey are shared types, not a second data store.

DashboardPage retains all snapshot, filter, sorting, selection, tool-registration
and motion state. Callbacks preserve the existing actions. Metric calculations
remain upstream of presentation, and public scanner wording is unchanged.

Tests/build and rankings/footer markup comparisons cover tab, mode, row and
search states. Drawer open/close and filter interactions are verified in preview.
The main page's presentation now composes feature sections; a visual primitive
reference page is a useful next step rather than adding further generic wrappers.

## Visual reference

`/design-reference.html?dev=1` renders the actual shared primitives with clearly
labeled synthetic samples. It covers commentary and editorial text, empty states,
price/percent/yield/basis-point roles, paired layout, key-level timestamps, card
roles, navigation, Sources disclosure and the resilience scale. ThemeToggle and
DesignLabs are the same controls as the dashboard, including saved preferences.

Primitive/scanner examples request no market packet, and no fixture is written into public/data. The responsive iframe separately loads the published dashboard. The
page is noindex and absent from dashboard navigation. The dev parameter is an
opt-in display convention, not authentication. Use this page to review shared
style changes together before modifying individual sections.

The resilience scale owns its viewport fill through `useViewportBars`, shared automatically wherever ResilienceScale is mounted. It uses the main-page threshold/root margin, toggles bars-visible on every entry/exit, cleans up the observer, and retains the existing CSS timing/stagger and reduced-motion rules. DashboardPage observes ranking bars only, avoiding two observers controlling the scale.

## Final consistency pass

372 repeated spacing, corner, border-width and font declarations now consume
shared tokens, preserving their resolved values. Spacing uses --space-2/4/6/8/10/
12/14/16/18/20/24/28/32/40/48. Corner sizes use --corner-4/5/6/7/8/9/10/12/14/16.
--border-width is 1px; Tailwind's font-sans consumes the existing --font-ui.
Existing semantic card inset/gap/radius and responsive variants remain the owners
of card formatting. Chart dimensions, data-driven bar widths, logo geometry and
breakpoints are layout/visual constraints rather than general spacing tokens.

The reference includes a synthetic scanner sandbox using the real rankings and
instrument drawer, with shared filter/sort behavior from scannerRows.ts. Synthetic
examples are isolated from public/data and never presented as a live capture.
A responsive iframe displays the actual published dashboard at 320, 375, 390,
768 or 1200 CSS pixels so media-query behavior can be reviewed directly.

Motion ownership is explicit: the scale owns its viewport observer, disclosure
owns open state with shared CSS timing, and page-level heading/card/parallax
observers coordinate the layout once. Design Lab modifies the same shared motion
variables; it is a development control, not a second production animation system.

Browser audit passed synthetic stock-detail open/Escape close, search, company/Recovery sorting, sector filter and benchmark override. Responsive frame widths 320/375/390/768/1200 showed no document overflow; mobile/tablet layouts stacked overnight columns and desktop retained two columns.
