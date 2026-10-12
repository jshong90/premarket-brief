# Market collection changes

- Read `docs/data-sources.md` and `docs/collection-workflow.md` before a refresh. `scripts/pipeline/sources.mjs` is the machine-readable registry; do not rediscover known unsupported sources or swap instruments silently.
- Begin with `brief:plan` and a sourced session-calendar decision. Fetch each requested instrument once per required window through available approved MCPs. Save market-only responses as envelopes in `.collection/`; never save credentials or account holdings.
- Use `brief:collect` and `brief:generate` to fan observations into the snapshot. Do not hand-edit the same quote in several display sections. Feed valid futures bars into both the last-price and range fields through generation. Honor provider delay, session windows and actual observation timestamps.
- Run `brief:validate`, tests and build before publishing. Preserve commentary verbatim. Do not turn a quote refresh into a frozen scanner capture.
- For rollover, prepare and review the transaction with `brief:rollover`, then apply. Dated archives are immutable. New-session quote fields and commentary must start empty.
- Keep source docs synchronized with `brief:sources`. Never add date-specific assertions to tests for the current snapshot; historical fixture assertions are fine.
- Do not clear a populated current snapshot or perform a new live test until the user authorizes that step. Preparing code and synthetic test fixtures is safe; fixtures must never enter public data.
