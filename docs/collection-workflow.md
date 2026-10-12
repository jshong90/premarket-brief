# Collection and publishing workflow

The site reads a static packet. Collection runs outside the browser. The pipeline prepares a candidate, validates it, then applies and publishes it explicitly. It does not assume that ChatGPT MCP connections are available to Node or Vercel.

## Source of truth

- `scripts/pipeline/sources.mjs`: approved instruments, exact provider symbols, field-specific fallback order, and editorial source checklist.
- `docs/data-sources.md`: generated source table. `npm run brief:sources` updates it; tests detect drift.
- `.collection/`: ignored working area for calendar decisions, provider responses, capability/close caches, collection receipts and candidate packets. Keep credentials and account data out of these files. Only save market responses.
- `public/data/snapshot.json`: published packet. All numeric edits go through generation; user commentary remains separate.

The current pipeline covers market context, index quotes, Treasury yields and futures key levels. Its common futures records can also supply scanner benchmarks during an explicit scanner capture. It does not add a new stock-universe crawler or change scanner methodology.

## Daily sequence

1. Verify the trading date with official exchange and bond-market calendars. Save `.collection/calendar.json` with `sessionDate`, `equitiesOpen`, `bondsOpen`, `previousEquitySession`, `previousBondSession`, `previousFuturesSession`, `source`, direct HTTPS `url`, and actual ISO `checkedAt`. Previous session dates are explicit because equities, bonds and futures can have different holiday schedules. A closed equity session stops the pipeline.
2. Prepare a collection plan. It groups each instrument's required fields and records the start time for measuring the complete gathering process. Futures bars are requested once; their last eligible close also feeds the indices table. US10Y is collected once for both the header and bonds table.
3. Fetch the planned requests through the available MCP connections. Batch tickers where the provider supports it, and run independent provider groups concurrently. Save response envelopes to `.collection/responses.json`. Do not copy the same price into multiple JSON sections.
4. Run collection/normalization. Failed providers advance to the configured fallback. An explicitly unsupported field is cached for 24 hours; transient failures receive one bounded retry and are not cached as unsupported. Missing file-bridge responses remain unavailable, so a missing connector never masquerades as a successful request.
5. Generate and validate a candidate. Review its messages, times, provider attempts and coverage. Existing commentary and calendar entries remain verbatim. An unsuccessful requested refresh clears that field in the candidate instead of retaining an old price.
6. Apply the candidate locally, then publish. Publishing runs tests and a production build before committing only changed snapshot/catalog files. Add `--push` to push the commit to the configured Git upstream; Vercel's existing Git integration handles deployment. Verify Vercel's deployment status separately: a successful push does not prove a successful deployment.

Commands, run from the repository root:

```sh
npm run brief:plan -- --calendar .collection/calendar.json --output .collection/plan.json
npm run brief:collect -- --plan .collection/plan.json --input .collection/responses.json --output .collection/capture.json
npm run brief:generate -- --capture .collection/capture.json --output .collection/candidate.json
npm run brief:validate -- --input .collection/candidate.json
npm run brief:apply -- --input .collection/candidate.json
npm run brief:publish -- --push
```

When Git transport is unavailable in the tool environment, use the GitHub Git Data API after the same local validation gates, preserving the current remote head as parent and checking it when updating the branch. Do not include any unrelated files.

The CLI never writes a plan, capture or candidate into `public/data`. Applying is a separate operation guarded by a hash of the base packet: if the current packet changed since generation, regenerate the candidate. A filesystem lock prevents simultaneous applies. Neither collection nor generation deploys anything.

## Response envelope / MCP file bridge

The input is an array, or an object containing `responses`. Each envelope contains:

| Field | Meaning |
| --- | --- |
| `id`, `kind` | Plan instrument ID; `quote` or `bars` |
| `provider`, `symbol` | Registry provider key and the exact requested symbol |
| `unit` | `price` or `percent`; Treasury yield 5.2 means 5.2%, not 0.052 |
| `url` | Direct HTTPS source reference |
| `retrievedAt` | Actual ISO time the provider response was obtained |
| `delayMinutes` | Provider-reported delay, or `null` if unknown |
| `intervalMinutes` | Required value `1` for bars, including a quote obtained from bars |
| `data` | Market response: a quote object or OHLC minute-bar array/container |
| `previousClose` | Optional `{value, asOf, symbol, source, url}`; a matched, separately timestamped prior-session reference |
| `error` | On failure, `{code, message}`; codes include `unsupported`, `unavailable`, `transient`, `invalid` |

Quote aliases accepted: `value`, `price`, `last_trade_price`, `c`, `close`, `close_price`; time aliases: `asOf`, `timestamp`, `updated_at`, `t`, `time`, `begins_at`. Bars accept `h/high/high_price`, `l/low/low_price`, `c/close/close_price`, and `t/time/timestamp/begins_at`. Bar containers can be an array, `bars`, `results`, or `data.bars`. Epoch seconds/milliseconds and ISO times with explicit zones are accepted. Minute timestamps mean the **start** of the minute. End-stamped responses must be translated by a provider-specific adapter before import; never guess.

If a provider's real response has a different shape, add a tested adapter rather than silently guessing field meanings. Generation re-derives canonical records from the retained raw evidence and rejects altered derived values. The envelope is the integration boundary; MCP tools and their authentication are supplied by the collection operator. The included file bridge processes real responses but does not itself call MCP tools.

For an authenticated programmatic connection, `brief:collect --adapter /absolute/path/adapter.mjs` loads a module exporting `fetchBatch(provider, requests)`. Return one envelope/error per request. The coordinator handles batching, deduplication, fallback and processing; the adapter handles provider transport/authentication. Credentials remain outside the repository.

## Cutoff, delay and shared observations

- Equities: 04:00 ET through, excluding, 09:20 ET. Futures ranges: prior calendar day 18:00 ET through, excluding, 09:20 ET. DST conversion uses the application's existing rules.
- Only completed one-minute bars qualify. Retrieval before a minute closes excludes that bar. The 09:20 bar and regular-session values are excluded even when collected late.
- Range coverage counts unique eligible minute buckets. Missing buckets, unknown delay and actual latest timestamps are disclosed. Partial ranges can appear as partial key levels; they cannot supply complete scanner benchmarks.
- OpenMarket's `HYPERLIQUID_HIP3 / xyz:SP500` is labeled as a temporary SPX proxy, not the cash index. A cash SPX previous close cannot be used to compute change against it. Both values must refer to the exact same instrument. No silent substitution with ES.
- Prior-session closes are cached by instrument, exact provider symbol and previous trading date. They retain original provenance. Live quotes and ranges are never silently reused from a previous run.
- Earlier equity/VIX/yield readings remain null as current prices. On a bond holiday, the prior reference can be preserved, but an old yield is not labeled as a fresh quote.
- Quote refreshes leave the scanner cutoff, status and observations alone. `--scanner-benchmarks` is an explicit generation option for an existing cutoff-based scanner packet; both benchmark fields come from the same normalized futures records as Key Levels. Incomplete benchmark ranges remain null.
- `capture.json` retains raw successful market responses, canonical records, attempt logs, delay/coverage details and timings. `timing.elapsedMs` measures plan creation through collection completion; `processingMs` measures normalization/adapter execution. File replay processing time is not provider latency.

## Rollover

`npm run brief:rollover -- --date YYYY-MM-DD --calendar .collection/calendar.json --output .collection/rollover.json` prepares an archive plus a clean next-session draft, without applying either. Review, then use `brief:apply -- --input .collection/rollover.json` and `brief:publish`.

The archive preserves values and commentary; a draft becomes `archived` without claiming it was frozen. A different existing dated archive cannot be overwritten. The new draft has empty quote/range/scanner values and empty briefing arrays so old commentary and events cannot appear as today's report. The archive pointer and catalog are updated automatically. Failures during local apply restore the original packet/catalog. The Git publication contains the packet and catalog together. Tests are session-independent; they do not require a particular date or a particular count of events.

## Editorial content

Consult the generated checklist when updating macro/earnings notes. Trading Economics is primary for U.S. economic and Fed events, using the U.S.-only, two-star-minimum filter; official Fed pages are backup verification. Auctions use TreasuryDirect and U.S. Treasury sources. Earnings use Earnings Whispers and the strict above-$25B screen with dated StockAnalysis evidence. Overnight news is user-supplied. Collection does not parse user commentary for numbers or rewrite their words. Broader calendar scraping and unattended MCP authentication are not implemented by this pipeline.

## Replay and review

Existing response files can be replayed without new provider calls. Replaying retains the original retrieval and observation times. It must not be presented as a fresh market capture. Keep raw files local and retain them until the candidate is verified. Do not clear the published JSON to test the collector: prepare a separate blank base or rollover draft first, and replace the live packet only after review.
