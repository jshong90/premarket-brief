# Approved collection sources

Generated from scripts/pipeline/sources.mjs. Run npm run brief:sources after an intentional source change.

| Dashboard data | Primary source | Backup | Handling |
| --- | --- | --- | --- |
| SPX premarket reference | [OpenMarket MCP](https://openmarket.xyz/) | — | HYPERLIQUID_HIP3 / xyz:SP500 is a temporary proxy, not the SPX cash index. Keep the proxy and its prior close on the same instrument. |
| SPY, QQQ and individual-equity quotes | [Robinhood MCP](https://robinhood.com/) | [Public.com MCP](https://public.com/) | Public.com is the quote fallback. Scanner ranges require actual timestamped OHLCV bars; quote-only data stays unranked. |
| U.S. Treasury yields (2Y, 5Y, 10Y, 30Y) | [Robinhood MCP](https://robinhood.com/) | [Public.com MCP](https://public.com/) → [Yahoo Finance](https://finance.yahoo.com/) → [Trading Economics](https://tradingeconomics.com/) | Try Yahoo Finance, then Trading Economics when prior providers fail. Yahoo has no configured 2Y yield symbol. Use exact pre-cutoff timestamped observations; Trading Economics 2Y uses 5-minute bars, other maturities use 1-minute bars. Disclose resolution and compare against the last actual Treasury session, including holidays. |
| VIX | [TradingView Official MCP](https://www.tradingview.com/) | — | TradingView Official MCP · CBOE:VIX. Retain the observation time. |
| ES/NQ quotes and Key Levels | [OpenMarket MCP](https://openmarket.xyz/) | [Yahoo Finance](https://finance.yahoo.com/) | Use OpenMarket workspace Ebzd9R2U (NQ pane 0, ES pane 1). Confirm the current contracts before collection. If CME reads are blocked, try Yahoo ES=F/NQ=F and verify the actual contract and premarket window. Trading Economics is checked next but its public US500/US100 proxies cannot substitute for ES/NQ. Leave unsupported fields blank; keep TradingView scanner benchmarks separate. |
| Timestamped ES/NQ scanner benchmark ranges | [TradingView Official MCP](https://www.tradingview.com/) | — | Completed one-minute OHLC bars for the exact overnight window only. Partial or missing ranges remain null; never substitute a quote or an unbounded chart high/low. |
| U.S. equity-universe discovery | [Robinhood MCP](https://robinhood.com/) | — | Report the discovered count and disclose coverage gaps; do not claim complete discovery without evidence. |
| Sector-strength panel | Not collected | — | Retired. Do not collect or display sector-relative-strength rows. |

| Briefing field | Primary source | Backup | Handling |
| --- | --- | --- | --- |
| U.S. economic releases | [Trading Economics](https://tradingeconomics.com/calendar) | — | U.S. calendar only; include upcoming events rated at least two stars. Recheck dates and ET times. |
| Fed policy events, releases and speakers | [Trading Economics](https://tradingeconomics.com/calendar) | [Federal Reserve Board / relevant regional Fed](https://www.federalreserve.gov/newsevents/calendar.htm) | Trading Economics is primary; use official Fed event pages only to verify or fill a missing detail. Keep chronological and omit events at or after 16:00 ET. |
| Treasury auctions and offering sizes | [TreasuryDirect / U.S. Treasury](https://www.treasurydirect.gov/auctions/upcoming/) | — | Use official auction schedules and Treasury announcements for offering sizes; include relevant upcoming items before market close. |
| Earnings | [Earnings Whispers](https://www.earningswhispers.com/calendar) | — | Verify release timing; retain only companies strictly above $25B market capitalization with dated evidence. |
| Earnings market-cap checks | [StockAnalysis](https://stockanalysis.com/list/biggest-companies/) | — | Dated USD market-cap evidence for the earnings screen only; do not treat this list as a complete scanner universe. |
| Overnight news | User-provided | — | The user supplies news and commentary. Do not search or scrape other news sources. |
