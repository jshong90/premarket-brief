# The Warren Relative Strength Scanner — Daily Snapshot Prototype

## Open or upload

This repository is the editable React + TypeScript + Vite project. `index.html` opens the combined morning brief and relative strength scanner; `premarket.html` is a compatibility entry to the same dashboard. Vercel builds the app into `dist/`.

## Daily snapshot

**The relative-strength scanner cutoff is 06:20 AM America/Los_Angeles (09:20 AM Eastern), ten minutes before the open.** It follows daylight saving time, rather than remaining fixed to UTC−8 all year. No new scanner session is created on weekends or US stock-market holidays. Index and bond quote updates are separate from this cutoff: refresh them only at the user's request, at the actual observation time, without changing an already captured scanner range.

Stocks and ETFs: 04:00 to 09:20 ET. NQ and ES futures: prior calendar day 18:00 to 09:20 ET. The end is exclusive: the 09:19 one-minute bar is the last eligible bar, and the 09:20 bar is excluded. If collection runs late, request historical bars bounded by the same cutoff; do not use later live range fields.

The hosted dashboard reads `data/snapshot.json` once when opened and keeps it fixed. Both HTML entries show the same combined page. There is no polling or live refresh. The stock table shows only the 25 rankable names with the lowest downside capture for the selected benchmark (ticker breaks ties). Search and sector filters narrow that set; column sorting and the recovery tab reorder it without changing membership or RS rank. Coverage and classification counts still use the whole packet. Reloading the page reads the latest published packet. The `?dev=1` query enables design controls whose changes are local to that browser; it does not publish market data or design choices.

## Data status and publishing

The current packet, `public/data/snapshot.json`, is an **October 7, 2026 draft**. It contains user-supplied commentary and macro events carried forward from the October 5 source check. Market-context, index, Treasury-yield, and futures key-level values were populated from verified bars at or before 09:20 ET on October 7; Robinhood supplied SPY/QQQ extended-hours bars, and TradingView supplied futures, VIX, and yield data with its 15+ minute delay notice. ES/NQ key levels are complete; YM/RTY remain blank because TradingView returned no usable bars. The stock scanner universe remains uncaptured, so the packet is still a draft. The October 6 packet is archived at `public/data/snapshot-2026-10-06.json`.

The separate [06:35 opening experiment](https://premarket-brief-silk.vercel.app/?dev=1&scan=0635) reads `public/data/snapshot-opening-0635.json`; the default 06:20 snapshot remains the baseline. This October 1 packet uses Robinhood 04:00–09:34 ET stock and sector ETF minute bars and adds TradingView ES/NQ 09:20–09:34 ET futures bars to the original overnight range. The first five minutes of regular trading are included. The same ten-actual-minute gate, downside-capture formula, and top-25 ranking apply. Coverage is 189/312 stocks and 6/11 sector ETFs; the post-cutoff universe remains partial. Index and bond quotes, key levels, and user-authored commentary are copied from the baseline, with no market-quote refresh. The experiment is a separate dated data packet, not a new default cutoff.

The dashboard does not fetch market data or create snapshots at runtime. It reads `data/snapshot.json` once when opened and keeps that packet fixed. To publish a new session, archive the old packet as `public/data/snapshot-YYYY-MM-DD.json`, replace `public/data/snapshot.json`, and point `previousArchiveDate` at the newest archive. To update the current brief, edit only the relevant snapshot fields, validate, test, build, and commit. Vercel rebuilds the app and publishes the packet. A page reload loads the new data.

Automatic snapshot publication to GitHub is not connected. A scheduled or manual collection process must explicitly produce and commit the JSON packet; the website does not inherit ChatGPT's TradingView connection or run a market-data scheduler. Data sources and availability are described below. No credentials belong in the HTML or public repository.

On a request to refresh index or bond quotes, use Robinhood MCP first. If the instrument or required value is unavailable, check Public.com as the secondary source for that data type; use TradingView Official MCP when neither broker source supplies the required field and timestamp. VIX remains sourced from TradingView. Reuters and CNBC are additional candidates for Treasury-yield reporting. Check the quoted contract or tenor, session, observation time, delay, and units. Record actual sources and timestamps on the affected rows. Never fill gaps with a related cash index, ETF, or estimate. Set `quotesRefreshedAt` to the time of the completed requested update; do not treat this as the scanner's `fetchedAt` or `cutoffAt`. Preserve every user-authored title and body verbatim unless the user requests a wording change.

## Data sources by section

The section contracts are stable; providers are replaceable. The dashboard consumes normalized snapshot fields and does not call any market-data provider from the browser. If a source is reliable and supplies the required fields with valid timestamps, keep using it. Change a source only when it fails on coverage, timestamp quality, latency, or required fields. A provider swap should usually update the packet's `source` and URL metadata, not the section's rendering or calculations.

| Dashboard area | Current source assignment | Required handling |
| --- | --- | --- |
| Market context strip | Robinhood MCP for supported index and ETF quotes; Public.com as the secondary source where Robinhood cannot supply the value; TradingView Official MCP for CBOE:VIX and when neither broker source provides the required field. For Treasury yields, Reuters and CNBC are also candidates. Historical values retain the actual source already recorded in the packet. | Cash SPX is not a premarket instrument. Keep unsupported or uncaptured current values null; never silently substitute ES for SPX. Include the actual source and observation timestamp. |
| 01 · Overnight movements — indices | Robinhood MCP for available index and futures quotes; TradingView Official MCP for unsupported contracts/values. Prior-session closes retain their recorded source. | Keep NQ and ES quotes in the separate `indexQuotes` array. Do not infer values from commentary. Compute percentage change from a matching previous close and timestamped current quote. A prior close alone is not a current quote. |
| 01 · Overnight movements — bonds | Robinhood MCP for available Treasury yields; Public.com as the secondary source where supported; TradingView Official MCP when neither connection provides timestamped yields. Reuters and CNBC may supply a report when instrument quotes are unavailable. | Keep the previous-session close separate from a current reading. Record source, observation time, retrieval time, and any reporting lag. Do not estimate missing yields or imply that unsynchronized observations are a single cutoff snapshot. |
| 02 · Key Levels | TradingView Official MCP timestamped one-minute futures bars for ES, NQ, YM, and RTY. | Futures window is prior-day 18:00 ET through, but not including, 09:20 ET. Derive highs and lows only from eligible bars; preserve the bar timestamps and disclose absent minute buckets. October 1 levels were captured separately from the scanner. |
| 03 · Upcoming macro events | Trading Economics for U.S. releases explicitly requested or approved for the brief; Federal Reserve Board and relevant regional Fed Bank calendars for Fed events; U.S. Treasury tentative schedule, TreasuryDirect upcoming auctions and timing guidance for auctions. Econoday is a secondary time cross-check only when an official source does not state the exact ET time. | Keep release scope selective; do not import the full economic calendar. Record event date and ET time, link primary sources first, and preserve any secondary time cross-check as a related source. `src/lib/macroCalendar.ts` centralizes source URLs, sorts entries chronologically, and excludes timed events at or after 4:00 p.m. ET from the displayed table. |
| 04 · Upcoming earnings | Company investor-relations announcements, such as Accenture Newsroom and NIKE Investor Relations. | Prefer the company's own schedule for release date and timing. Keep the announcement's publication date when available. |
| 05 · Overnight news | Issuer investor-relations releases for company results; Reuters for macro/economic reporting; Associated Press for broad market-close summaries. | Link each factual item to its source and preserve its actual publication or observation date. User-authored notes/commentary are exempt from outside sourcing. |
| Relative-strength scanner | Robinhood MCP for the $50B+ stock universe, official prior closes, and timestamped premarket equity/sector ETF ranges. TradingView Official MCP supplies NQ and ES futures bars because Robinhood's MCP has no futures-history tool. Requested current sector prices use the latest available TradingView 1-minute regular-session bar close, with its observation time and potential 15+ minute delay kept separate from scanner ranges. Massive is a possible alternate only if its timestamped coverage is valid. | Keep the existing downside-capture calculation and bands. Ignore Robinhood's interpolated bars. This capture requires at least ten actual traded minute bars for an observed equity range; thinner tapes remain unranked. Leave the 09:19 ET cutoff price null when no real trade occurred in that minute. Disclose that the live universe was discovered after the cutoff and any incomplete coverage. |

### Section 03 refresh

Section 03 stays part of the static snapshot; the site does not scrape calendars at runtime. Add or revise event notes in `public/data/snapshot.json` using a date title and a time-prefixed body such as `8:30 a.m. ET — ECONOMIC RELEASE · Initial jobless claims`. Use `sourceKey` values from `src/lib/macroCalendar.ts` for configured primary references. That module resolves display links, sorts by date and ET time, and drops timed events at or after 4:00 p.m. ET. The snapshot remains the source of selected event facts.

For economic releases, Trading Economics is an index for only the U.S. reports you explicitly request or approve; there is no broad default import. For Fed events, check the Board's monthly calendar or the relevant Reserve Bank's official event/speech page. For auctions, check Treasury's tentative schedule and TreasuryDirect's upcoming auction details; use Treasury's refunding or auction announcements for offering sizes. Retain Econoday only to cross-check an exact event time when the primary page does not give one. The existing October 5 release selection is preserved; no new economic releases were added. Discord Markdown is produced only on request.

### Provenance rules and current gaps

- Provider data must retain source, direct URL where applicable, actual bar/observation time, retrieval time, and any delay or coverage issue. Keep provider-specific details in the snapshot metadata so the page remains source-independent.
- The expandable Sources card lists briefing-note links, index quote links when supplied, and Treasury-yield references. It does not yet expose links for Market Context rows, whose source and timestamp remain in the packet metadata.
- The October 1 Key Levels rows contain observed cutoff-window highs and lows with bar and retrieval timestamps. ES and NQ have 920 eligible minute bars; YM and RTY each have eight absent minute buckets, disclosed on their rows. The scanner reuses the captured ES/NQ range as its benchmarks and uses independently sourced Robinhood stock and sector ranges.
- The TradingView connection can report a delay of 15 minutes or more. A late collection must still use bars bounded by the original cutoff, and the delay must remain visible.
- Changing a provider does not change the section contract. Change the provider assignment in this README only when the source is deliberately replaced; the packet must continue to meet the same field, timestamp, coverage, and null-handling rules.

## Massive connection (alternate source)

The Vercel Function at `api/massive-bars.js` reads `MASSIVE_API_KEY` server-side and requests one ticker's one-minute bars for the 04:00–09:20 ET stock/ETF window. It excludes the 09:20 bar, returns timestamps plus derived high, low, last, volume, and drawdown, and records retrieval time. It never returns the API key.

Massive is not the dashboard's default market-data connection. Use it only to fill required fields the designated sources cannot provide, and only when the returned bars cover the intended session with usable timestamps. A successful endpoint test is not a full scanner run: it does not discover the $50B+ universe, fetch NQ/ES futures, generate a complete snapshot, or publish `public/data/snapshot.json`. The free plan is end-of-day, so it cannot supply a live 06:20 AM capture.

In Vercel, set the Environment Variable name to `MASSIVE_API_KEY`; store the Massive API key as its value for Production and Preview, then redeploy. Use the **Data connections** drawer's **Test Massive connection** control to check AAPL for the displayed snapshot date. The endpoint can also be checked at `/api/massive-bars?symbol=AAPL&date=YYYY-MM-DD`, replacing the date with a valid market date. Do not put the API key in a browser URL, frontend file, or GitHub commit.

Run locally with `npm run dev`; use the Vercel preview or production URL for hosted access.

## Scanner description

The scanner uses premarket price ranges and some comparison rules to calculate relative strength. Results are based on the best available data and are intended as an aid, not a signal.

## Snapshot file contract

`public/data/snapshot.json` is the editable daily packet; Vite publishes it at `dist/data/snapshot.json`. For a new daily packet:

- `sessionDate`: YYYY-MM-DD in New York. A `draft` has a preparation time in `fetchedAt` and no `cutoffAt`. A finalized scanner has `cutoffAt` exactly at 09:20 ET and `fetchedAt` at or after the cutoff. `quotesRefreshedAt` independently records an on-request quote update and may be earlier or later than the scanner cutoff.
- `status`: `draft` for a prepared brief with no frozen scanner; `frozen`, `partial`, or `unavailable` for cutoff-based scanner captures. `imported` is reserved for legacy, unverified examples and must not assert a cutoff.
- `previousArchiveDate`: most recent dated archive, when available. A `?date=YYYY-MM-DD` request opens its corresponding `snapshot-YYYY-MM-DD.json` file. Update the pointer when archiving a session.
- `universeCount`: discovered universe size; `universeComplete`: whether discovery is complete; `messages`: coverage and delay notes.
- `stocks`, `sectors`, `benchmarks`: arrays; benchmarks must contain NQ and ES. Sector rows use ES.
- `marketContext`: optional five-row strip for `SPX`, `SPY`, `QQQ`, `VIX` and `US10Y`. Use a compact value when only a level is available; include `series` with timestamped values when a sparkline is valid. SPX cash-index values must be labeled as prior close when premarket data is unavailable. Missing values remain null.
- `indexQuotes`: separate NQ and ES rows with `previousClose`, `value`, their observation times, source, optional URL and retrieval time. A current value needs its own `asOf`; missing values stay null with an issue. User commentary lives in `briefing.indices` and must not be parsed for quote values or rewritten when quotes refresh.
- `briefing`: optional `{indices, bonds, macro, earnings, news}` arrays. Each note has `title`, `body`, `source`, a direct HTTPS `url`, and an optional `publishedAt` or `asOf`. Macro notes may set `sourceKey` to resolve a primary source from `src/lib/macroCalendar.ts`; related sources hold secondary cross-checks. Empty arrays are valid and render as an explicit no-note state.
- Instrument fields: `ticker`, `name`, `sector`, `benchmark`, `high`, `low`, `last`, `previousClose`, `drawdown`, `volume`, `marketCap`, `source`, `asOf`. Numbers unavailable from valid sources must be null, not zero. Optional `highTime`, `lowTime`, `retrievedAt`, `issue` retain provenance.
- Benchmark fields: `id`, `high`, `low`, `drawdown`, `source`, `asOf`, optional `highTime`, `lowTime`, `issue`.
- `asOf`, `highTime`, `lowTime` identify the actual bar timestamps inside the eligible window. New rows need complete high/low timestamps, a valid range, and positive known equity session volume to be ranked. Missing metadata leaves that row unranked. Delays belong in `issue` and `messages`.

The loader validates the snapshot packet before display, including quote signs, types, and key-level ranges. It cannot authenticate the provider or independently verify source coverage; invalid files show an error. The production build runs the tests against both checked-in packets before publishing.

## Development

Requires Node.js ≥22.13.

```sh
npm ci
npm run dev
npm test
npm run build
```

The production build writes to `dist/`. Vercel uses the checked-in build configuration and publishes that directory. Direct dependencies are pinned; `package-lock.json` locks the full dependency tree.

Validation covers TypeScript, snapshot structure, source metadata, date handling, cutoff handling, the legacy example, and the Massive route's ET daylight-saving windows, 09:20 exclusion, field provenance and server-only API-key use.

## Design reference

The combined dashboard uses the theme blocks and semantic text roles in `src/globals.css`. Change a theme token there to update every element that consumes it. Surface, border, and some component colors still have explicit rules; the component table below locates those exceptions. `src/MassiveConnectionTest.css` styles the connection result. The older CSS for the former separate Premarket layout is retained in `src/globals.css`, but both HTML entries now render the combined dashboard.

### Theme colors

| Role / affected elements | CSS token | Light | Dark |
| --- | --- | --- | --- |
| Page canvas | `--background` | `#F4F1EB` | `#25282B` |
| Main text, headings, dates, briefing paragraphs | `--foreground`, `--text-primary` | `#000000` | `#E7E8E9` |
| Supporting labels and navigation | `--text-secondary` | `#555555` | `#C5C8CB` |
| Muted captions, metadata, source details | `--muted-foreground`, `--text-muted` | `#6B6B6B` | `#AEB2B6` |
| Cards and market tiles | `--card` | `#FBFAF8` | `#303438` |
| Popovers | `--popover` | `#FBFAF8` | `#383C40` |
| Secondary surfaces | `--secondary` | `#E8E5DF` | `#3A3E42` |
| Muted surfaces | `--muted` | `#EEECE7` | `#34383C` |
| Accent surfaces | `--accent` | `#E7E4DE` | `#44494E` |
| Primary controls | `--primary` | `#555555` | `#D1D3D5` |
| Text on primary controls | `--primary-foreground`, `--text-inverse` | `#FFFFFF` | `#25282B` |
| Base border / input border | `--border` / `--input` | `#B7B3AC` / `#AAA69F` | `#666C72` / `#747A80` |
| Focus ring | `--ring` | `#777777` | `#B7BBC0` |
| Positive price | `--price-up` (from `--green`) | `#27824D` | `#62C982` |
| Negative price / destructive | `--price-down` (from `--red`) | `#C63E3E` | `#F07878` |
| Error text | `--text-error` | `#934E45` | `#E2AFA7` |
| Success text | `--text-success` | `#27824D` | `#62C982` |

`--card-foreground`, `--popover-foreground`, `--secondary-foreground`, and `--accent-foreground` follow `--foreground`. The page title, centered header date, ticker/company name, and briefing body therefore change together. `npm test` rejects hard-coded CSS `color` declarations so future text changes keep using roles.

### Resilience colors

The spectrum fills are identical in both modes. Label colors vary by mode for legibility.

| Classification | Fill token / both modes | Text token | Light text | Dark text |
| --- | --- | --- | --- | --- |
| Exceptional | `--rs-exceptional` `#C3F86B` | `--rs-exceptional-text` | `#A64F24` | `#C3F86B` |
| Clear | `--rs-clear` `#89B861` | `--rs-clear-text` | `#A64F24` | `#A6D982` |
| Moderate | `--rs-moderate` `#708C5D` | `--rs-moderate-text` | `#86694F` | `#A9B7A3` |
| Market-like | `--rs-market` `#BEA16E` | `--rs-market-text` | `#806044` | `#C8B998` |
| Laggard | `--rs-laggard` `#C5807A` | `--rs-laggard-text` | `#A34F45` | `#DEA19C` |

These fills appear in the resilience scale, stock capture tracks, and sector bars. Price red/green is separate from the resilience scale.

### Component color exceptions

These are explicit component rules in `src/globals.css`; changing only a base token will not necessarily change them.

| Element | Light | Dark |
| --- | --- | --- |
| Top bar background / border | `#FBFAF8` / `#D7D3CC` | `#292D31` / `#454A4F` |
| Sticky market strip background / border | `rgba(251,250,248,.97)` / `#D7D3CC` | `rgba(41,45,49,.97)` / `#4A4F54` |
| Card and market tile outer border | `#B7B3AC` | `#666C72` |
| Inner dividers in panels, scanner, sector and scale rows | `#C3BFB8` | `#5D6369` |
| Benchmark card gradient | `#FBFAF8` → `#F0EEE9` | `#34383C` → `#2C3034` |
| Source notice surface / border | `#EEECE7` / `#D7D3CC` | `#34383C` / `#4A4F54` |
| Status chip / theme toggle surface and border | `#EFEDE8` / `#D0CCC5` | `#35393D` / `#555B60` |
| Primary button normal → hover | `#555555` → `#3E3E3E` | `#D1D3D5` → `#FFFFFF` |
| Secondary button surface / border | `#EFEDE8` / `#D0CCC5` | `#3A3E42` / `#555B60` |
| Capture/coverage/sector track background | `#E2DED7` | `#44494E` |
| Connection result surface / border (`MassiveConnectionTest.css`) | `#FFF8EE` / `#D5C6B3` | `#20271C` / `#45533A` |

### Typography and size

| Element | Family / weight | Size |
| --- | --- | --- |
| General UI and controls | Source Sans 3 / normal | 16px body; controls vary below |
| Morning brief and Relative strength titles | Newsreader / 700 | `--dashboard-title-size`: 43px, 35px at ≤700px |
| Centered top-bar date | Newsreader / 700 | Same `--dashboard-title-size` token as the page titles |
| Numbered morning sections | Newsreader / 700 | `--dashboard-section-size`: 24px |
| Card and note titles | Newsreader / 500 | `--dashboard-card-title-size`: 16px |
| Briefing paragraphs | Newsreader / 400 | 14px desktop, 13px at ≤640px; bonds copy 13px |
| Brief closing line | Newsreader label / 500; Source Sans 3 detail / normal | 20px label, 14px detail |
| Eyebrows, buttons, chips and metadata | Source Sans 3 / 600 where emphasized | Mostly 12px; heading chip 10px at ≤540px |
| Market-strip price | UI monospace / 500 | 20px |
| Scanner table | UI monospace for numeric values, Source Sans 3 for labels | 14px body, 12px headers/company secondary labels |
| Index quotes / key-level tables | Source Sans 3 with monospace numeric values | 14px / 13px body; 12px headings; 11px timestamps |
| Benchmark headline number | Source Sans 3 / 500 | 34px base; 38px at ≥1450px, 29px at ≤1200px, 28px at ≤640px |

Source Sans 3 and Newsreader load weights 400, 500, 600, and 700 from Google Fonts. Source Sans 3 uses Arial, Helvetica, then generic sans-serif as fallbacks; Newsreader uses Georgia. Numeric fields use `ui-monospace`, SFMono-Regular, Menlo, Consolas, then generic monospace. Shared layout sizes are `--card-radius: 8px`, `--card-gap: 16px`, and `--card-inset: 20px` (16px at ≤1200px; 14px at ≤640px). The active snapshot date is centered in the top bar; each page section keeps its own centered title and status.

### Motion

Section cards fade in while moving upward 12px over 650ms whenever they enter the viewport. Cards in the same group stagger by 70ms, capped after the fourth card. The Sources card expands over 480ms with a shorter opacity transition. All decorative motion is disabled when the user requests reduced motion.

## Consolidated layout

The morning brief has five sections: combined overnight indices and bonds, key levels, upcoming macro events, upcoming earnings, and overnight news. The button beside the Morning brief heading skips to the scanner; the button beside the Relative strength heading returns to the brief. Both use same-page anchors and account for the sticky header.
