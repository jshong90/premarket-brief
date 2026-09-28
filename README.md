# The Warren Relative Strength Scanner — Daily Snapshot Prototype

## Open or upload

Open `index.html` for the combined morning brief and relative strength scanner. `premarket.html` opens the same dashboard for compatibility. For GitHub, unzip this archive and upload the contents, with both HTML files and the `data/` folder at the repository root. Do not upload the ZIP as the website. The `source/` folder contains the editable React + TypeScript + Vite project and is optional for hosting.

## Daily snapshot

**The capture cutoff is 06:20 AM America/Los_Angeles (09:20 AM Eastern), ten minutes before the open.** It follows daylight saving time, rather than remaining fixed to UTC−8 all year. No new session is created on weekends or US stock-market holidays.

Stocks and ETFs: 04:00 to 09:20 ET. NQ and ES futures: prior calendar day 18:00 to 09:20 ET. The end is exclusive: the 09:19 one-minute bar is the last eligible bar, and the 09:20 bar is excluded. If collection runs late, request historical bars bounded by the same cutoff; do not use later live range fields.

The hosted pages read `data/snapshot.json` once when opened and keep it fixed. `premarket.html` is the briefing-only overview; `index.html` is the detailed relative-strength scanner. There is no polling or live refresh. Search, sorting, benchmark comparisons, resilience and recovery views use that same packet. Reloading the page reads the latest published packet.

## Data status and publishing

The scanner rows in the included packet are the **legacy September 28, 2026 example**, with approximate drawdowns from the earlier conversation. Its cutoff is unknown and its inputs are unverified. It is labeled accordingly; it is not a verified 06:20 capture or a complete $50B+ scan. The Premarket page also carries the user-provided September 28 morning briefing, organized into Equities, Bonds, Macro and News with reference links. Missing recovery, raw stock prices, market caps and sector ranges remain blank.

A ChatGPT task is scheduled to produce the daily snapshot JSON at 06:20 Pacific. It uses TradingView first and alternate sources only for required fields TradingView cannot supply. It retains source, observation time, cutoff and collection time, and reports missing coverage.

To update the hosted dashboard, rename that day's JSON to `snapshot.json` and replace `data/snapshot.json` in the repository. Both pages update together. No rebuild is required. For source development, also update `source/public/data/snapshot.json`; rebuilding copies this file into the standalone package. Archive dated JSON files separately if desired.

**Automatic publication to GitHub is not connected.** The static website does not run a scheduler or inherit the ChatGPT TradingView connection. The task delivers its data file here; a separate repository integration is required to publish it automatically. The current TradingView OHLCV tool supplies the futures bars but excludes equity extended-hours bars. Timestamped stock and sector ranges therefore need an alternate source. Data availability and latency depend on provider access. No credentials belong in the HTML or public repository.

When opened directly with `file://`, the page uses its embedded legacy example because browsers restrict local file fetching. Serve over HTTP to load the external snapshot packet.

## Methodology

- Range drawdown = (1 − session low / session high) × 100, positive magnitude.
- Downside capture = ticker drawdown / benchmark drawdown × 100. Lower is more resilient.
- RS advantage = benchmark drawdown − ticker drawdown, in percentage points.
- Recovery = (last eligible price / premarket low − 1) × 100, displayed and ranked separately.

Thresholds: below 40% exceptional; 40% to below 70% clear; 70% to below 100% moderate; 100% through 125% market-like; above 125% laggard.

The high/low range ignores event order and measures relative range size, not chronological maximum drawdown. The equity window is shorter than the futures window. Capture is undefined for a zero or missing benchmark range. Calculations use unrounded valid inputs; display values are rounded.

Target universe: US common stocks with market cap ≥ $50B. NQ for the specified growth names and technology/communication sectors, ES otherwise, explicitly COST, MA, WMT and MCD. All 11 sector ETFs use ES. Assignments are in `source/src/lib/scanner.ts`.

## Snapshot file contract

`data/snapshot.json` illustrates the row layout with legacy inputs. For a new daily packet:

- `sessionDate`: YYYY-MM-DD in New York; `cutoffAt`: ISO timestamp exactly at 09:20 ET; `fetchedAt`: actual ISO collection time at or after the cutoff.
- `status`: `frozen`, `partial`, or `unavailable`. `imported` is reserved for legacy, unverified examples and must not assert a cutoff.
- `universeCount`: discovered universe size; `universeComplete`: whether discovery is complete; `messages`: coverage and delay notes.
- `stocks`, `sectors`, `benchmarks`: arrays; benchmarks must contain NQ and ES. Sector rows use ES.
- `marketContext`: optional five-row strip for `SPX`, `SPY`, `QQQ`, `VIX` and `US10Y`. Use a compact value when only a level is available; include `series` with timestamped values when a sparkline is valid. SPX cash-index values must be labeled as prior close when premarket data is unavailable. Missing values remain null.
- `briefing`: optional `{indices, bonds, macro, earnings, news}` arrays. Each note has `title`, `body`, `source`, a direct HTTPS `url`, and an optional `publishedAt` or `asOf`. Empty arrays are valid and render as an explicit no-note state.
- Instrument fields: `ticker`, `name`, `sector`, `benchmark`, `high`, `low`, `last`, `previousClose`, `drawdown`, `volume`, `marketCap`, `source`, `asOf`. Numbers unavailable from valid sources must be null, not zero. Optional `highTime`, `lowTime`, `retrievedAt`, `issue` retain provenance.
- Benchmark fields: `id`, `high`, `low`, `drawdown`, `source`, `asOf`, optional `highTime`, `lowTime`, `issue`.
- `asOf`, `highTime`, `lowTime` identify the actual bar timestamps inside the eligible window. New rows need complete high/low timestamps, a valid range, and positive known equity session volume to be ranked. Missing metadata leaves that row unranked. Delays belong in `issue` and `messages`.

The loader validates the packet, rejects observations outside the cutoff window, and recomputes drawdown from raw ranges for new snapshots. It cannot authenticate the provider or establish that every expected bar was supplied; the collector must verify coverage. Invalid files show an error and the clearly labeled legacy example.

## Source development

In `source/`, install dependencies with npm or pnpm and run:

```sh
npm run dev
npm test
npm run build
node scripts/package-standalone.mjs
```

Direct dependencies are pinned. Node ≥22.13 is required. `build` produces `source/dist/`; the packaging script embeds both page entries, carries the shared runtime chunk, and copies the data packet into the root. A hosted build has no required market-data backend.

Validation: production build, TypeScript, formula thresholds, missing/zero data, benchmark mapping, recovery, daylight saving offsets, the fixed 09:20 cutoff, out-of-window rejection, incomplete ranges, and legacy rankings.

## Consolidated layout
The morning brief has five sections: overnight indices, overnight bonds, upcoming macro events, upcoming earnings, and overnight news. The button beside the Morning brief heading skips to the scanner; the button beside the Relative strength heading returns to the brief. Both use same-page anchors and account for the sticky header.
