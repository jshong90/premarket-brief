# Project handover — Warren Premarket Brief

Prepared: October 12, 2026. Code baseline inspected: `1f5997a0966385b31a291395cf61d8c56290aa07` (PR #22).
This document is an operational handover and regression specification. Unchecked items are instructions for future verification, **not claims that every check already passed**. No finite checklist proves the absence of every possible defect; record uncovered cases and extend this document.

## 1. Start here

1. Read [AGENTS.md](AGENTS.md), [README.md](README.md), [CSS ownership](docs/css-ownership.md), [component system](docs/component-system.md), [source table](docs/data-sources.md), and [collection workflow](docs/collection-workflow.md).
2. Fetch current remote main. Inspect the working tree, current PRs, CI and production commit before editing. This baseline will become historical.
3. Identify whether the task changes presentation, data, collection, rollover or deployment. Keep unrelated work out of the diff.
4. Preserve user edits and populated data. Use synthetic fixtures for tests. Never overwrite production data merely to exercise a state.
5. Capture the affected page in both themes before visual changes, using both default preferences and the user's saved preferences when available.
6. Complete the relevant checks below, open a PR, let required checks pass, merge and verify the actual production alias.

### Project locations

| Item | Location |
| --- | --- |
| Repository | https://github.com/jshong90/premarket-brief |
| Production | https://premarket-brief-silk.vercel.app/ |
| Design reference | https://premarket-brief-silk.vercel.app/design-reference.html?dev=1 |
| Archive | https://premarket-brief-silk.vercel.app/archive.html |
| Brief builder | https://premarket-brief-silk.vercel.app/briefing-builder.html |
| Current published packet | public/data/snapshot.json |
| Dated archives | public/data/snapshot-YYYY-MM-DD.json |
| Archive catalog | public/data/archive-index.json |
| Approved source registry | scripts/pipeline/sources.mjs |
| CI | .github/workflows/quality.yml |

Do not rely on the previous agent's scratch checkout, browser state, credentials, temporary scripts or tool availability. Reacquire an authoritative checkout. A connector available in one conversation may be unavailable in another.

### User decisions to preserve

- The page is a snapshot-based morning brief with a relative-strength scanner below it.
- Public scanner explanations remain opaque. Approved wording: “The scanner uses premarket price ranges and some comparison rules to calculate relative strength. Results are based on the best available data and are intended as an aid, not a signal.”
- Do not add calculation formulas to public copy or this handover. Read implementation and tests when maintaining calculations. Opaque UI wording does not make shipped client code confidential.
- Commentary and overnight news are supplied by the user. Preserve their voice; do not add attribution qualifiers or rewrite the commentary during a quote refresh.
- Use approved data sources only. Source failure means a documented fallback or null, never an invented value.
- Sector-strength panel is retired. Do not restore it from old prompts or archived packets.
- Neutral themes, shared text tokens, red/green price movement and mode-independent resilience colors.
- All commentary labels and bodies use shared primitives, including Energy.
- Design Lab is a development aid. `?dev=1` is not authentication.
- User has authorized deployment of completed changes when required build/tests pass. Do not request approval for each routine step; do not interpret that as permission to erase data, secrets or unrelated work.
- Do not generate Discord output unless requested.
- Historical conversation requirements can be superseded. Current approved registry and current explicit user instructions govern; flag conflicts instead of silently changing providers.

## 2. Architecture and ownership

The browser renders a static, validated JSON packet. Collection happens outside the browser. ChatGPT MCP credentials are not automatically available to Node or Vercel. The collection file bridge is not an unattended market-data service.

| Layer | Files / responsibilities |
| --- | --- |
| Entrypoints | index.html, premarket.html, archive.html, briefing-builder.html, design-reference.html and corresponding src/*main.tsx |
| Packet loading | src/data/snapshotRepository.ts; src/data/archiveCatalog.ts |
| Packet parsing/domain | src/lib/snapshot.ts, scanner.ts, ranges.ts |
| Dashboard orchestration | src/features/dashboard/DashboardPage.tsx: loading, state, filters, sorting, selection and coordination |
| Header | DashboardHeader.tsx, MarketContextStrip.tsx, src/shared/ThemeToggle.tsx |
| Brief composition | src/features/briefing/MorningBrief.tsx |
| Brief features | OvernightMovements, KeyLevelsTable, MacroCalendar, EarningsCalendar, SourcesCard |
| Shared brief primitives | src/components/brief/: BriefCard, BriefLayout, BriefTable, NumericCell, Commentary, SectionHeading, SectionJump, SourcesDisclosure |
| Scanner presentation | ScannerOverview, ScannerRankings, ResilienceScale, InstrumentDrawer, ScannerInfoDrawer, SnapshotStatus |
| Scanner view helpers | scannerRows.ts, scannerDisplay.ts, scannerTypes.ts |
| Calendar / topics | src/lib/macroCalendar.ts, earningsCalendar.ts, briefingTopics.ts |
| Development surfaces | src/features/design-lab/; src/features/design-reference/ |
| Collection CLI | scripts/brief.mjs and scripts/pipeline/{sources,collection,model,snapshot,files}.mjs |
| Diagnostics | api/massive-bars.js; src/features/connections/MassiveConnectionTest.* |
| Build smoke checks | scripts/smoke-build.mjs |

Keep parsing, calculations and provider transport out of presentational primitives. Reuse real production components in the reference page rather than maintaining visual copies. Shared numeric formatting does not imply all financial units have identical precision.

### CSS after the migration

`src/globals.css` is an import manifest only. Edit the existing owner:

| Stylesheet | Owns |
| --- | --- |
| src/styles/foundations.css | Palette, typography, geometry tokens, base reset, Tailwind mapping |
| src/styles/shared.css | Shared layout, controls, surfaces, headings, utilities |
| src/features/dashboard/DashboardHeader.css | Header, date, navigation, market context |
| src/features/briefing/Briefing.css | Brief cards, tables, commentary, calendars, sources |
| src/features/dashboard/Scanner.css | Rankings, scales, cards, drawers, states |
| src/features/briefing-builder/BriefingBuilder.css | Builder |
| src/pages/ArchivePage.css | Archive |
| src/styles/motion.css | Shared motion and reduced-motion rules |
| src/features/design-lab/DesignLabs.css | Lab and explicit development overrides |
| src/features/connections/MassiveConnectionTest.css | Connection diagnostic |

Import order is intentional: foundations/shared, feature owners, motion, development controls. Vendor styles remain separate. Do not append corrective overrides to the manifest or use new hardcoded values to bypass tokens. Responsive, theme, focus and empty-state rules are real behavior, not evidence of dead CSS.

Resilience unfilled track: `--resilience-track`, dark #222222, light #DADADA. Spectrum: #c3f86b, #89b861, #708c5d, #bea16e, #c5807a in both modes. Source Sans 3 is the UI family; Newsreader is the editorial family. Consult foundations and README for the complete current palette and size roles.

## 3. Data sources and collection

The generated [source table](docs/data-sources.md) is the readable contract; `scripts/pipeline/sources.mjs` is its machine-readable owner. Do not maintain another independent source table.

At this baseline:
- Equity quotes and Treasury yields: Robinhood, Public.com fallback.
- ES/NQ quotes and key levels: configured OpenMarket charts; exact symbol and window evidence required.
- VIX: TradingView Official MCP.
- Timestamped ES/NQ scanner benchmark ranges: TradingView Official MCP, exact completed one-minute window.
- SPX premarket reference: configured OpenMarket temporary proxy, clearly labeled; never mix cash-index close with proxy current price.
- Universe discovery: Robinhood, with completeness disclosed.
- U.S. economic and Fed calendar: Trading Economics; U.S. and minimum two-star filtering for economic releases; official Fed sources as documented backup.
- Treasury auctions/offering sizes: TreasuryDirect/U.S. Treasury.
- Earnings: Earnings Whispers; strictly above $25B with dated StockAnalysis market-cap evidence.
- News/commentary: user.

Source capability is field-specific. A valid quote does not establish access to historical bars, a complete range, volume, universe discovery or a previous close.

### Normal refresh

Follow the full envelope schema and commands in [collection workflow](docs/collection-workflow.md):

```sh
npm run brief:plan -- --calendar .collection/calendar.json --output .collection/plan.json
npm run brief:collect -- --plan .collection/plan.json --input .collection/responses.json --output .collection/capture.json
npm run brief:generate -- --capture .collection/capture.json --output .collection/candidate.json
npm run brief:validate -- --input .collection/candidate.json
# Review the candidate before applying:
npm run brief:apply -- --input .collection/candidate.json
```

The calendar decision must establish equity/bond status and previous equity, bond and futures sessions with source and actual check time. Collection responses belong in ignored `.collection/`, contain market data only and preserve source, exact symbol, observation/retrieval time, units and reported delay. Fetch each instrument once per required window and fan it into displays. US10Y should not have independent conflicting header/table readings. Futures bars should feed both last price and eligible range.

A quote refresh is not a frozen scanner capture. Preserve original timestamps during replay. Unknown delay is unknown, not zero. Unsupported fields and transient failures have different retry/cache treatment.

### Rollover

```sh
npm run brief:rollover -- --date YYYY-MM-DD --calendar .collection/calendar.json --output .collection/rollover.json
# Review archive + clean draft transaction:
npm run brief:apply -- --input .collection/rollover.json
```

Archives are immutable. A draft archived after the session does not become a verified frozen capture. New-session quotes, scanner values and commentary start empty; prior-day facts must not become today's facts. Publication updates packet/catalog together. Do not manually copy an entire page to create a new date.

## 4. Build, release and rollback

Runtime: Node >=22.13.0; CI uses Node 22.x. Use the committed lockfile.

```sh
npm ci
npm run brief:validate
npm test
npm run build
node scripts/smoke-build.mjs
```

Tests/build regenerate the archive index. Inspect the resulting diff; do not commit accidental changes. `npm run build` includes TypeScript checking and Vite output. Vercel uses `npm ci`, then `npm test && npm run build`, output `dist`. CI additionally validates the packet and smoke-checks output.

1. Work from current main on a scoped branch.
2. Run gates, review diff, ensure no secrets, fixtures or unrelated data were added.
3. Open PR; required check is **Validate, test, and build**.
4. Review preview and affected interactions. Record exact commit and evidence.
5. Merge only the reviewed head. Use the existing Git-triggered Vercel production deployment.
6. Confirm deployment READY and Git SHA matches merged main. Open the public production alias, not just the immutable preview URL.
7. Verify current date, assets and packet on the alias. Check default URL and `?dev=1`.
8. Report the actual result; a commit, merge or push alone does not prove deployment.

An earlier manual/Git deployment race served an old build. Avoid redundant manual deployments. If broken, identify the last known good code **and data** state, revert through a reviewed commit or use an explicitly chosen deployment rollback. Verify alias again. Do not blindly restore an old snapshot when fixing CSS. Preserve newer valid data through a forward fix when appropriate.

### Existing automated coverage

All of these are invoked by `npm test`; read their assertions before claiming coverage:

| File | Area |
| --- | --- |
| tests/text-tokens.test.mjs | Authored stylesheet import traversal, duplicate declarations, text/font literals, manifest-only globals and related style guards |
| tests/numeric-format.test.mjs | Shared financial formatting |
| tests/macro-calendar.test.mjs | Calendar parsing/grouping including undated input regression |
| tests/scanner.test.mjs | Scanner domain behavior |
| tests/briefing-topics.test.mjs | Topic selection |
| tests/earnings-calendar.test.mjs | Earnings eligibility |
| tests/archive-catalog.test.mjs | Catalog handling |
| tests/snapshot-packets.test.mjs | Packet and historical fixture behavior |
| tests/massive-api.test.mjs | Server diagnostic endpoint |
| tests/collection-pipeline.test.mjs | Collection, candidates, rollover and related pipeline behavior |
| brief:sources --check | Generated source documentation drift |

Automated unit/structural checks are not comprehensive browser, accessibility, security or provider-integration tests. The current smoke script does not list design-reference.html among required files; check that entry separately. Do not claim complete cross-browser coverage from a Chromium run.

## 5. Regression execution protocol

Use the IDs below in PR evidence. Mark **PASS / FAIL / NOT RUN / N/A**, with reason, commit, environment, exact steps and observed result. A proposed check is not a pass. Stop optional repetition after relevant risks are resolved; run the broad matrix for shared architecture/style changes.

### Minimum matrix

| Dimension | Cases |
| --- | --- |
| Themes | Light, dark; default preferences and saved overrides |
| Widths | 320, 375, 390, 768, 1200, 1440 CSS px; immediately around actual CSS breakpoints |
| Browsers | Chromium; Safari/WebKit and Firefox for major UI releases; real iOS/Android when available |
| Data | Complete synthetic fixture, partial, unavailable, empty, malformed, long content, archived |
| Motion | Default, reduced motion, disabled/extreme Lab values, repeated viewport entry |
| Storage | Fresh, saved, legacy, malformed, blocked |
| Network | Normal, slow, offline, asset failure, packet 404/500, aborted request |
| Navigation | Direct URL, reload, internal link, back/forward, query parameters, anchors |
| Input | Mouse, touch, keyboard, screen-reader smoke |
| Deployment | Preview exact SHA, production exact SHA, fresh and previously open browser |

Reference responsive iframe widths include its border; measure the actual inner viewport. A 320px frame can have 318px content width. This is not an overflow defect by itself.

## 6. Regression checklist

### A. Repository, install and build

- [ ] A01 Fresh locked install succeeds on supported Node; no undeclared global tools.
- [ ] A02 All validation/test/build/smoke commands above pass at the candidate SHA.
- [ ] A03 Inspect git diff before/after gates; only intended source/docs/data changed.
- [ ] A04 Every HTML entry and referenced JS/CSS asset exists in dist.
- [ ] A05 Source imports resolve on a case-sensitive filesystem; no scratch paths.
- [ ] A06 No credentials, account holdings, raw private responses, temporary test scripts or generated fixtures in public output.
- [ ] A07 Lockfile/package changes agree; no install workaround hiding a dependency mismatch.
- [ ] A08 No new console errors, unhandled promises or unexpected React warnings.
- [ ] A09 Build output sizes compared with baseline; explain material CSS/JS growth.
- [ ] A10 README/source docs/ownership docs remain consistent with implementation.

### B. Routes and loading

- [ ] B01 Root, index.html and premarket.html render the intended dashboard.
- [ ] B02 Archive, builder and reference load directly and after refresh.
- [ ] B03 Current packet date drives the visible date; no hardcoded “today.”
- [ ] B04 Valid ?date=YYYY-MM-DD loads that archive and retains date during navigation.
- [ ] B05 Invalid dates, impossible dates, missing archives and malformed JSON show a usable error without silently displaying current data as the requested archive.
- [ ] B06 Archive catalog failure preserves documented direct-file fallback; aborts are respected.
- [ ] B07 ?scan=0635 remains an explicitly historical/alternate packet path; not mislabeled current.
- [ ] B08 Combined query precedence follows snapshotRepository; dev flag does not change selected snapshot.
- [ ] B09 Back/forward, jump anchors and reload retain expected navigation.
- [ ] B10 Slow loading, 404/500, offline and retry do not leave a blank page or stale success state.
- [ ] B11 Unmount/navigation abort prevents late responses replacing a newer selection.
- [ ] B12 No path traversal or arbitrary file fetch through date/query values.

### C. Header and market context

- [ ] C01 Logo/date/context arrangement is correct; removed masthead wording stays removed.
- [ ] C02 Date formatting, weekday, year and time zone agree with session date.
- [ ] C03 Date uses intended shared heading size/weight/color in both modes.
- [ ] C04 Header scroll behavior matches design; it does not unexpectedly cover content.
- [ ] C05 Context price, previous close, change, unit and timestamp refer to the same instrument.
- [ ] C06 Missing values render as unavailable, never zero or a fabricated flat change.
- [ ] C07 Positive/negative/flat and inverse VIX treatment match established semantics.
- [ ] C08 Temporary proxies are labeled; no silent cash SPX/ES/CFD mixing.
- [ ] C09 Long names, timestamps, unavailable labels and large numbers fit mobile.
- [ ] C10 Context backgrounds obey their own tokens/Lab controls, independent of card/header controls.
- [ ] C11 Theme control remains visible, keyboard accessible and correctly named.
- [ ] C12 No accidental restoration of previously removed context instruments; registry support alone is not a UI instruction.

### D. Brief composition and commentary

- [ ] D01 “Your Morning Brief” appears before scanner; headings and jump controls align.
- [ ] D02 Equities left/bonds right on wide screens; stack in readable order on narrow screens.
- [ ] D03 Each commentary sits beneath its corresponding table.
- [ ] D04 Equity Commentary, Bond Commentary and Energy Commentary share label/body roles.
- [ ] D05 User wording, punctuation, paragraph breaks and apostrophes preserved.
- [ ] D06 Price displays remain numeric/table content; collection never mines commentary for quotes.
- [ ] D07 No inherited minimum height or bottom padding creates unexplained empty space.
- [ ] D08 Card inset, heading gap, section gap and divider logic are consistent.
- [ ] D09 Empty, one-paragraph, long multi-paragraph and long-unbroken content layouts work.
- [ ] D10 Section numbering is contiguous for the actual visible composition.
- [ ] D11 Hiding a topic removes its section cleanly, without orphan headings or gaps.
- [ ] D12 No old “before the bell,” schedule, masthead or methodology links reappear accidentally.

### E. Numeric tables and key levels

- [ ] E01 Indices rows and columns use the current contract: Prev. Session Close, Premarket, Change (%).
- [ ] E02 Treasury tenors retain correct labels; yield %, yield-point changes and basis points are not confused.
- [ ] E03 Shared precision and rounding match numeric-format tests; calculations use valid unrounded inputs.
- [ ] E04 Null, zero, negative, very large and invalid numeric fixtures render safely.
- [ ] E05 Missing previous close does not produce division by zero, NaN, Infinity or misleading change.
- [ ] E06 Negative zero does not display as a false negative move.
- [ ] E07 Approximation markers appear only for explicitly approximate data.
- [ ] E08 Key-level high/low order, timestamps, exact symbol and session match the requested range.
- [ ] E09 Quote-only or unbounded chart data cannot masquerade as complete premarket range.
- [ ] E10 Incomplete range coverage is disclosed; highs/lows do not imply completeness.
- [ ] E11 Table headers use semantic th associations; numeric cells align consistently.
- [ ] E12 Small screens scroll the table wrapper if needed, not the entire document.
- [ ] E13 Timestamp text, source links and unit labels remain readable and unclipped.
- [ ] E14 Same observation reused across header, indices/bonds and key levels agrees everywhere.

### F. Macro calendar

- [ ] F01 U.S.-only, minimum-impact and approved-source rules applied as specified.
- [ ] F02 Events grouped by date and sorted chronologically within each date.
- [ ] F03 Fed events, auctions and offerings fit chronological presentation rather than disconnected duplicated blurbs.
- [ ] F04 Actual ET times populated, with source; unknown time is explicitly unknown.
- [ ] F05 DST conversion and date rollover tested; do not hardcode UTC offsets.
- [ ] F06 Events at/after 16:00 ET excluded where required by editorial rules.
- [ ] F07 Cancelled/rescheduled/duplicate events handled without showing both as current.
- [ ] F08 Undated/malformed title does not cause Invalid Date or toISOString crash.
- [ ] F09 Same-time events retain deterministic order.
- [ ] F10 This week/next week/month/year boundary and empty calendar render correctly.
- [ ] F11 Offering announcement, auction and settlement are not conflated.
- [ ] F12 Source URLs are direct and support the actual event/date/time.
- [ ] F13 Long event names wrap without collapsing the time column.
- [ ] F14 Previous-session calendar items do not leak into a clean draft.

### G. Earnings

- [ ] G01 Earnings Whispers release date/timing recorded; unknown timing not guessed.
- [ ] G02 Only market caps strictly greater than $25B qualify; exactly $25B excluded.
- [ ] G03 Missing, nonfinite, stale/unusable or unsupported market-cap evidence does not silently pass.
- [ ] G04 Dated USD cap, source and URL retained.
- [ ] G05 Before-open/after-close/session groups and date ordering correct.
- [ ] G06 Company icon failure has a readable ticker/name fallback and no layout collapse.
- [ ] G07 Duplicate share classes/events handled deliberately, not accidentally deduplicated by company name.
- [ ] G08 Empty sessions disappear cleanly; no eligible companies has an honest empty state.
- [ ] G09 Structured and legacy earnings fixtures render according to parser contract.
- [ ] G10 Compact company/ticker layout remains readable at mobile widths.

### H. Scanner correctness and UI

Use synthetic fixtures and existing domain tests; do not expose proprietary mechanics in user-facing text.

- [ ] H01 Quote-only rows remain unranked; valid timestamped range and positive known session volume required.
- [ ] H02 Missing/zero/invalid benchmark inputs yield unavailable dependent metrics.
- [ ] H03 Boundary cases for every resilience category tested just below, at and above each boundary.
- [ ] H04 Equal scores use the defined deterministic ticker tie-break.
- [ ] H05 Recovery ordering is independent of resilience ordering.
- [ ] H06 Benchmark mapping and explicit overrides agree with current domain contract.
- [ ] H07 Market-cap eligibility and incomplete discovery messages accurate; count is not falsely called complete.
- [ ] H08 Missing high/low/last, inverted ranges, nonpositive values and out-of-window timestamps rejected or unranked.
- [ ] H09 Search handles ticker/company, case, whitespace, no matches and clearing.
- [ ] H10 Sector filter, benchmark selector, sort controls and tabs compose correctly.
- [ ] H11 Filter/sort does not mutate original records or assign false rank to invalid rows.
- [ ] H12 Ranking, leader cards, counts and drawer use the same selected data.
- [ ] H13 Loading/empty/unavailable/partial states keep explanation and controls usable.
- [ ] H14 Retired sector-strength panel stays absent.
- [ ] H15 Resilience spectrum colors identical in light/dark; neutral track darker than default card.
- [ ] H16 Numeric text/labels explain the scale without requiring color perception.
- [ ] H17 Stock drawer opens correct row; stale selection after filtering handled predictably.
- [ ] H18 Drawer Escape, close button, overlay dismissal, focus return and scroll locking work.
- [ ] H19 Source/connections drawer agrees with registry and actual connection status.
- [ ] H20 Public description remains approved opaque wording; no new formula tooltip.
- [ ] H21 Synthetic reference fixtures never enter published snapshots.

### I. Sources disclosure and links

- [ ] I01 Collapsed/expanded transitions work for short and long content.
- [ ] I02 aria-expanded/aria-controls match; collapsed content cannot receive focus.
- [ ] I03 No clipped references during animation or after resizing.
- [ ] I04 Reference count and actual visible citations agree.
- [ ] I05 Mixed-source fields identify provenance correctly.
- [ ] I06 External links use HTTPS and appropriate link security; unavailable links do not fabricate attribution.
- [ ] I07 SourcesDisclosure currently uses a singleton ID: verify no duplicate IDs if reused twice on one page.
- [ ] I08 Source failures/delay/coverage visible rather than buried behind an unexplained number.

### J. Builder, preferences and archive

- [ ] J01 All six topics work individually: equities, bonds, energy, macro, earnings, news.
- [ ] J02 All on, all off, only equities, only bonds and mixed selection render coherently.
- [ ] J03 Preview updates without mutating packet or archive files.
- [ ] J04 Saved selections persist as intended; ordinary public default remains the intended experience.
- [ ] J05 Legacy v1 preferences migrate to v2 behavior, including news default.
- [ ] J06 Missing/corrupt/blocked storage does not crash rendering.
- [ ] J07 Preferences are browser-local behavior, not secure identity/access control.
- [ ] J08 Archive order, labels, links and date agree with each file.
- [ ] J09 Every catalog entry resolves; missing file/date mismatch reported.
- [ ] J10 Dated archive remains byte-for-byte unchanged during an ordinary refresh.
- [ ] J11 Archive page handles zero, one and many entries and long status messages.
- [ ] J12 Back to current returns current packet, not a cached archive.
- [ ] J13 Historical schemas remain readable or fail explicitly; no silent rewriting of history.

### K. Tokens, CSS and appearance

- [ ] K01 globals.css remains imports only; owner/import order preserved.
- [ ] K02 No duplicate selector/property patches, hardcoded text/font exceptions or unjustified !important.
- [ ] K03 Heading/body/label/link colors use intended tokens in both themes.
- [ ] K04 Price movement and resilience functional colors remain exceptions by design.
- [ ] K05 Card border/divider contrast checked against text and surfaces.
- [ ] K06 Default, hover, focus, active, selected, disabled and unavailable states inspected.
- [ ] K07 Shared card padding/radius/gaps and numeric alignment match reference.
- [ ] K08 Grid background appears after cold load, reload, theme toggle and navigation.
- [ ] K09 Fonts load; blocked/slow font request leaves legible fallback with acceptable layout shift.
- [ ] K10 No late stylesheet overrides cause a color flash or missing grid.
- [ ] K11 Gradient clipping, radius, surface opacity and stacking correct on nested cards.
- [ ] K12 Header/card/context backgrounds can vary independently without unintended inheritance.
- [ ] K13 Long text, large text, source content and empty cards use the same formatting logic.
- [ ] K14 Compare affected computed styles before/after: color, background, font family/size/weight/line-height, margin, padding, gap, borders, radius, display and grid columns.
- [ ] K15 Removing a selector requires evidence across routes/states, not one viewport's coverage report.
- [ ] K16 Third-party CSS is not accidentally included in authored-style refactoring.

### L. Motion and Design Lab

- [ ] L01 Morning-paper reveal, jumps, card entry and bars replay on viewport re-entry.
- [ ] L02 Initially visible elements appear; no permanently opacity-zero content.
- [ ] L03 Rapid scroll/re-entry and tab switching do not accumulate observers or animations.
- [ ] L04 Reduced motion leaves all content visible and usable.
- [ ] L05 IntersectionObserver unavailable path still displays content.
- [ ] L06 Main page and reference resilience use the same hook/timing logic.
- [ ] L07 Sources expand/collapse animates without clipping or focus leakage.
- [ ] L08 Parallax does not create blank edges, horizontal overflow or obscure controls.
- [ ] L09 Every slider/input has a label, correct bounds and per-control reset.
- [ ] L10 Master reset restores defaults and removes stale overrides as designed.
- [ ] L11 Hex text input supports copy/paste; malformed values handled safely.
- [ ] L12 Linear/radial/angular gradient controls produce valid backgrounds at extremes.
- [ ] L13 Text controls affect correct roles, including all commentary labels/bodies.
- [ ] L14 Lab theme matches page; theme change preserves intended separate theme values.
- [ ] L15 Saved overrides survive reload as intended; fresh profile shows actual defaults.
- [ ] L16 Reference and production views remain consistent after Lab adjustments.
- [ ] L17 Restore user preferences after testing; record originals before changing them.
- [ ] L18 Developer controls absent from ordinary public view unless explicitly enabled.

### M. Accessibility and responsive behavior

- [ ] M01 Semantic heading hierarchy, named regions and table headers preserved.
- [ ] M02 Keyboard can reach every interactive control in logical order.
- [ ] M03 Focus indicator visible in both themes and against gradients.
- [ ] M04 Drawers trap focus appropriately, Escape closes and focus returns to trigger.
- [ ] M05 Radix selects/tabs work with arrows, Enter/Space and Escape.
- [ ] M06 Links are links, actions are buttons; no clickable noninteractive rows without equivalent keyboard access.
- [ ] M07 No duplicate IDs or broken aria references.
- [ ] M08 Screen-reader smoke: date, numeric units, unavailable state, controls and selected tab understandable.
- [ ] M09 Text contrast meets applicable WCAG AA targets; nontext control/focus contrast checked.
- [ ] M10 Color is not the only indicator of movement/status/resilience.
- [ ] M11 200% zoom and enlarged text do not lose content or controls.
- [ ] M12 Reflow at narrow widths; document scrollWidth does not exceed viewport unexpectedly.
- [ ] M13 Touch targets sufficiently large/spaced; no hover-only essential information.
- [ ] M14 Landscape phone, safe areas and on-screen keyboard do not conceal controls.
- [ ] M15 Sticky/fixed/portal layers have correct stacking and do not block scrolling.
- [ ] M16 Forced colors/high contrast and reduced-motion modes remain usable.
- [ ] M17 Loading/error changes announced appropriately without overwhelming live-region output.

### N. Collection, temporal correctness and resilience

- [ ] N01 Calendar explicitly records current/previous equity, bond and futures sessions.
- [ ] N02 Weekend/holiday/early-close/different bond-holiday cases exercised with fixtures.
- [ ] N03 DST spring/fall and UTC date-boundary conversions tested.
- [ ] N04 Exact cutoff enforced when retrieval is late; cutoff minute and regular-session bars excluded.
- [ ] N05 In-progress minute excluded; seconds/milliseconds/ISO timestamps normalized correctly.
- [ ] N06 Start-stamped versus end-stamped bar meaning confirmed; no guessed conversion.
- [ ] N07 Duplicate/out-of-order bars, missing buckets and conflicting duplicates handled deterministically.
- [ ] N08 Actual source symbol, units and previous-session reference match; no cross-contract/proxy change computation.
- [ ] N09 Provider delay and partial coverage affect disclosure and eligibility.
- [ ] N10 Missing timestamp cannot become retrieval time by assumption.
- [ ] N11 Approved fallback used only for supported fields; unavailable connector is not success.
- [ ] N12 Unsupported capability cache expires; transient failure gets bounded retry, not permanent blacklist.
- [ ] N13 Batch collection/deduplication does not omit fields or duplicate provider requests.
- [ ] N14 Prior-close cache key includes instrument/symbol/session and preserves provenance.
- [ ] N15 Old current quotes never reused as a successful fresh capture.
- [ ] N16 Missing refreshed field becomes null in candidate rather than retaining stale price.
- [ ] N17 Candidate re-derivation detects tampering with derived values.
- [ ] N18 Replay retains original times; processing duration not mislabeled provider latency.
- [ ] N19 Quote refresh preserves scanner status/cutoff unless explicitly running scanner capture.
- [ ] N20 Unknown market-universe coverage does not claim completeness.
- [ ] N21 Rates preserve percent units; do not convert 5.2% into 0.052% or vice versa.
- [ ] N22 Raw envelopes contain market data only, no credentials/holdings.
- [ ] N23 User notes/calendar remain unchanged during numeric refresh.

### O. Apply, rollover and publication safety

- [ ] O01 Plan/collect/generate do not write public files.
- [ ] O02 Base-hash mismatch blocks stale candidate apply.
- [ ] O03 Concurrent apply lock prevents two writers from corrupting files.
- [ ] O04 Failure restores original packet/catalog; interrupted transaction investigated before retry.
- [ ] O05 Archive with differing existing content cannot be overwritten.
- [ ] O06 New draft has correct date, empty fresh data and empty commentary arrays.
- [ ] O07 Archive status does not overclaim frozen validity.
- [ ] O08 Packet/catalog published atomically in one reviewed Git change.
- [ ] O09 Publish includes only intended files; remote head concurrency checked.
- [ ] O10 Failed validation/build prevents publication.
- [ ] O11 Production public URL serves expected SHA, assets and session after merge.
- [ ] O12 Old open tab, hard reload and clean browser converge to current deployment.
- [ ] O13 Developer suffix does not point to a different release.
- [ ] O14 Failed/queued older deployments cannot be mistaken for latest release.
- [ ] O15 Rollback preserves or deliberately restores data with documented scope.

### P. API, security and performance

- [ ] P01 Diagnostic endpoint accepts only documented methods/parameters/symbols/windows.
- [ ] P02 Invalid input, provider auth failure, rate limit, timeout and malformed upstream body handled without leaking secrets.
- [ ] P03 API key stays server-side; no VITE-prefixed secret, public JSON key or console leak.
- [ ] P04 Remote URLs/symbol parameters cannot become arbitrary server requests.
- [ ] P05 Commentary/source text renders safely; malicious HTML/script fixture does not execute.
- [ ] P06 External links and embedded content have intended restrictions; no accidental account data exposure.
- [ ] P07 Public dev/reference routes contain no privileged operations or secrets.
- [ ] P08 Slow network produces stable layout; avoid repeated packet requests or provider calls from renders.
- [ ] P09 Scroll/animation smooth with large scanner fixture; observer/listener cleanup verified.
- [ ] P10 No unbounded timer/retry loop, accumulating event listeners or excessive detached nodes.
- [ ] P11 Large archive/long notes remain responsive; images have fallback and stable dimensions.
- [ ] P12 Check asset caching independently from snapshot freshness; no stale successful data masking fetch failure.
- [ ] P13 Existing security/header configuration reviewed before claiming protection; dev query is never authorization.
- [ ] P14 Dependency/security tooling findings triaged in scope; do not perform unrelated upgrades during visual changes.

## 7. Known traps and remaining limits

| Symptom | First checks |
| --- | --- |
| Production looks old | Actual deployed SHA, alias, deployment queue, asset responses; do not immediately rewrite CSS |
| Colors/grid differ between browsers | Saved Design Lab preferences, theme initialization, asset/font load, cascade, then default clean profile |
| Card bottom looks too thick | Shared padding/gap, empty child margin, min-height, disclosure wrapper; avoid one-card patch |
| New table appears empty | Packet field/parser contract, selected date, source availability, null handling; not just markup |
| Macro time/date missing | Structured fields, timezone parsing, undated sorting; guard Date before ISO conversion |
| Scanner has no ranked rows | Evidence/volume/window eligibility; do not fill numbers to make UI look complete |
| Quote source works but range does not | Field capability, exact bars/window, delay and coverage |
| Preferences seem global | Local browser persistence vs public defaults; no authenticated preference service assumed |
| Archive contains older schema | Parser compatibility and immutable original packet; no mass rewrite |
| Drawer cannot be tested from current packet | Use synthetic ScannerSandbox on reference page |

Previous CSS migration evidence at baseline: 110 sampled elements compared in both themes with zero sampled computed-style differences; five responsive frame widths had no document overflow; sources, drawer, Design Lab, builder and eight archive entries checked; tests/build passed. This is historical evidence, not an assertion of all tests above.

Known limits:
- No complete automated browser/a11y/cross-browser suite is implied by current npm tests.
- The reference iframe is helpful but does not replace real mobile/browser testing.
- Source connectors and provider entitlements must be verified in the receiving agent's environment.
- File-bridge collection does not implement unattended MCP authentication or broad calendar scraping.
- Public frontend implementation can be inspected even when methodology copy is opaque.
- Some old fixtures/alternate packets remain intentionally; do not delete them by inference.
- A prior successful release does not prove future data completeness or current production health.

## 8. Handoff / release evidence template

Copy into the next PR or task record:

```text
Task:
Base SHA:
Candidate SHA:
Files / layers changed:
Data session and packet hash (if affected):
Source registry changes (if any):
Commands run + results:
Regression IDs PASS:
Regression IDs FAIL:
Regression IDs NOT RUN + reasons:
N/A IDs + rationale:
Browsers / viewport / theme / storage / motion states:
Screenshots or computed-style evidence:
Provider coverage, delay, missing inputs:
Preview URL + SHA:
Merged SHA:
Production deployment ID / READY status / alias SHA:
Post-release smoke result:
Rollback target and data considerations:
Remaining risks / next owner action:
```

When handing off again, update the baseline SHA and record current unresolved issues. Keep this document linked to the maintained owner docs rather than duplicating implementation details that will drift.
