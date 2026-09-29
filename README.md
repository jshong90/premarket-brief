# The Warren Relative Strength Scanner — Daily Snapshot Prototype

## Open or upload

This repository is the editable React + TypeScript + Vite project. `index.html` opens the combined morning brief and relative strength scanner; `premarket.html` is a compatibility entry to the same dashboard. Vercel builds the app into `dist/`.

## Daily snapshot

**The capture cutoff is 06:20 AM America/Los_Angeles (09:20 AM Eastern), ten minutes before the open.** It follows daylight saving time, rather than remaining fixed to UTC−8 all year. No new session is created on weekends or US stock-market holidays.

Stocks and ETFs: 04:00 to 09:20 ET. NQ and ES futures: prior calendar day 18:00 to 09:20 ET. The end is exclusive: the 09:19 one-minute bar is the last eligible bar, and the 09:20 bar is excluded. If collection runs late, request historical bars bounded by the same cutoff; do not use later live range fields.

The hosted dashboard reads `data/snapshot.json` once when opened and keeps it fixed. Both HTML entries show the same combined page. There is no polling or live refresh. Search, sorting, benchmark comparisons, resilience and recovery views use that same packet. Reloading the page reads the latest published packet.

## Data status and publishing

The scanner rows in the included packet are the **legacy September 28, 2026 example**, with approximate drawdowns from the earlier conversation. Its cutoff is unknown and its inputs are unverified. It is labeled accordingly; it is not a verified 06:20 capture or a complete $50B+ scan. The page carries the user-provided September 28 morning briefing in five sections: overnight indices, overnight bonds, upcoming macro events, upcoming earnings and overnight news. Missing recovery, raw stock prices, market caps and sector ranges remain blank.

A ChatGPT task is scheduled to produce the daily snapshot JSON at 06:20 Pacific. It uses TradingView first and alternate sources only for required fields TradingView cannot supply. It retains source, observation time, cutoff and collection time, and reports missing coverage.

To publish a new snapshot, replace `public/data/snapshot.json` and commit the change. Vercel rebuilds the dashboard and deploys it from that packet. Keep dated archives separately if desired.

**Automatic snapshot publication to GitHub is not connected.** The website does not run a scheduler or inherit the ChatGPT TradingView connection. The scheduled task delivers its data file here but does not write it into this repository; commit the new packet at `public/data/snapshot.json` to publish it through Vercel. The current TradingView OHLCV tool supplies the futures bars but excludes equity extended-hours bars. Timestamped stock and sector ranges therefore need an alternate source. Data availability and latency depend on provider access. No credentials belong in the HTML or public repository.

## Massive connection

The Vercel Function at `api/massive-bars.js` reads `MASSIVE_API_KEY` on the server and requests one ticker's one-minute bars for the fixed 04:00–09:20 ET stock/ETF window. It excludes the 09:20 bar, returns each included bar timestamp plus the derived high, low, last, volume and drawdown, and records retrieval time. It never returns the API key. The dashboard's **Snapshot schedule** panel has a **Test Massive connection** button that checks AAPL for the displayed snapshot date.

In Vercel, set the Environment Variable name to `MASSIVE_API_KEY`; store the Massive API key as its value for Production and Preview, then redeploy. The free plan is end-of-day, so a successful check validates historical minute-bar access only. It cannot populate a live 06:20 AM capture. The current endpoint is a per-ticker data connection check; it does not discover the complete $50B+ stock universe, fetch NQ/ES futures, generate a full snapshot, or publish a new `public/data/snapshot.json` automatically.

After deployment, open **Snapshot schedule** and run the connection test. The request can also be checked directly at `/api/massive-bars?symbol=AAPL&date=YYYY-MM-DD`, replacing the date with a valid market date. Do not put the API key in a browser URL, frontend file, or GitHub commit.

Run locally with `npm run dev`; use the Vercel preview or production URL for hosted access.

## Scanner description

The scanner uses premarket price ranges and some comparison rules to calculate relative strength. Results are based on the best available data and are intended as an aid, not a signal.

## Snapshot file contract

`public/data/snapshot.json` illustrates the row layout with legacy inputs; Vite publishes it at `dist/data/snapshot.json`. For a new daily packet:

- `sessionDate`: YYYY-MM-DD in New York; `cutoffAt`: ISO timestamp exactly at 09:20 ET; `fetchedAt`: actual ISO collection time at or after the cutoff.
- `status`: `frozen`, `partial`, or `unavailable`. `imported` is reserved for legacy, unverified examples and must not assert a cutoff.
- `universeCount`: discovered universe size; `universeComplete`: whether discovery is complete; `messages`: coverage and delay notes.
- `stocks`, `sectors`, `benchmarks`: arrays; benchmarks must contain NQ and ES. Sector rows use ES.
- `marketContext`: optional five-row strip for `SPX`, `SPY`, `QQQ`, `VIX` and `US10Y`. Use a compact value when only a level is available; include `series` with timestamped values when a sparkline is valid. SPX cash-index values must be labeled as prior close when premarket data is unavailable. Missing values remain null.
- `briefing`: optional `{indices, bonds, macro, earnings, news}` arrays. Each note has `title`, `body`, `source`, a direct HTTPS `url`, and an optional `publishedAt` or `asOf`. Empty arrays are valid and render as an explicit no-note state.
- Instrument fields: `ticker`, `name`, `sector`, `benchmark`, `high`, `low`, `last`, `previousClose`, `drawdown`, `volume`, `marketCap`, `source`, `asOf`. Numbers unavailable from valid sources must be null, not zero. Optional `highTime`, `lowTime`, `retrievedAt`, `issue` retain provenance.
- Benchmark fields: `id`, `high`, `low`, `drawdown`, `source`, `asOf`, optional `highTime`, `lowTime`, `issue`.
- `asOf`, `highTime`, `lowTime` identify the actual bar timestamps inside the eligible window. New rows need complete high/low timestamps, a valid range, and positive known equity session volume to be ranked. Missing metadata leaves that row unranked. Delays belong in `issue` and `messages`.

The loader validates the snapshot packet before display. It cannot authenticate the provider or independently verify source coverage; invalid files show an error and the clearly labeled legacy example.

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

## Text color tokens

Edit the theme values in `src/globals.css`; component text colors reference semantic roles rather than literal hex values. `npm test` checks both CSS files for hard-coded `color` declarations.

| Role | Token | Light | Dark |
| --- | --- | --- | --- |
| Main text, headings, dates | `--foreground` / `--text-primary` | `#3E3026` | `#E7E8E9` |
| Supporting text | `--text-secondary` | `#555555` | `#C5C8CB` |
| Muted text | `--text-muted` | `#6B6B6B` | `#AEB2B6` |
| Text on primary buttons | `--text-inverse` | `#FFFFFF` | `#25282B` |
| Price up / down | `--price-up` / `--price-down` | `#27824D` / `#C63E3E` | `#62C982` / `#F07878` |
| Error text | `--text-error` | `#934E45` | `#E2AFA7` |

Resilience text has five `--rs-*-text` roles, with theme-specific values. The five `--rs-*` spectrum fills are shared by both themes. This text palette does not govern surface and border colors.

## Consolidated layout
The morning brief has five sections: overnight indices, overnight bonds, upcoming macro events, upcoming earnings, and overnight news. The button beside the Morning brief heading skips to the scanner; the button beside the Relative strength heading returns to the brief. Both use same-page anchors and account for the sticky header.
