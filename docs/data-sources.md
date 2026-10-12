# Approved collection sources

Generated from scripts/pipeline/sources.mjs. Run npm run brief:sources after an intentional source change.

| Instrument | Quote order | Range source |
| --- | --- | --- |
| SPX (CFD proxy) | TradingView Official MCP | — |
| SPY | Robinhood MCP → Public.com MCP → TradingView Official MCP | — |
| QQQ | Robinhood MCP → Public.com MCP → TradingView Official MCP | — |
| VIX | TradingView Official MCP | — |
| US2Y | Robinhood MCP → Public.com MCP → TradingView Official MCP | — |
| US5Y | Robinhood MCP → Public.com MCP → TradingView Official MCP | — |
| US10Y | Robinhood MCP → Public.com MCP → TradingView Official MCP | — |
| US30Y | Robinhood MCP → Public.com MCP → TradingView Official MCP | — |
| ES | Robinhood MCP → Public.com MCP → TradingView Official MCP | TradingView Official MCP |
| NQ | Robinhood MCP → Public.com MCP → TradingView Official MCP | TradingView Official MCP |
| YM | Robinhood MCP → Public.com MCP → TradingView Official MCP | TradingView Official MCP |
| RTY | Robinhood MCP → Public.com MCP → TradingView Official MCP | TradingView Official MCP |

| Calendar field | Source | Handling |
| --- | --- | --- |
| U.S. economic releases | [Trading Economics](https://tradingeconomics.com/calendar) | Only explicitly approved releases; recheck dates and ET times. |
| Fed events | [Federal Reserve Board / relevant regional Fed](https://www.federalreserve.gov/newsevents/calendar.htm) | Official event pages; chronological; omit events at or after 16:00 ET. |
| Treasury auctions | [TreasuryDirect / U.S. Treasury](https://www.treasurydirect.gov/auctions/upcoming/) | Verify auction date, deadline and offering sizes; omit after-close events. |
| Earnings | [Earnings Whispers](https://www.earningswhispers.com/calendar) | Verify release timing; retain only companies above $25B with dated market-cap evidence. |
| Earnings market caps | [StockAnalysis](https://stockanalysis.com/list/biggest-companies/) | Dated USD capitalization; do not guess missing values. |
