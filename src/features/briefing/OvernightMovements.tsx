import type { Snapshot } from '@/lib/scanner';
import { BriefTable } from '@/components/brief/BriefTable';
import { NumericCell } from '@/components/brief/NumericCell';
import { CommentaryNotes } from '@/components/brief/Commentary';
import { BriefCard } from '@/components/brief/BriefCard';
import { OvernightPair } from '@/components/brief/BriefLayout';

type IndexQuoteRow = { label: string; fridayClose: number | null; scanPrice: number | null; changePercent: number | null };
type IndexQuoteNote = { indexQuotes?: IndexQuoteRow[] };

function IndexOvernightTable({ data }: { data: Snapshot }) {
  const legacyQuotes = (data.briefing?.indices ?? []).flatMap((note) => (note as typeof note & IndexQuoteNote).indexQuotes ?? []);
  const getLegacyQuote = (symbol: 'NQ' | 'ES') => legacyQuotes.find((row) =>
    symbol === 'NQ' ? /nasdaq|\bNQ\b/i.test(row.label) : /s\s*&?p|\bES\b/i.test(row.label),
  );
  const quoteFor = (symbol: 'NQ' | 'ES') => {
    const quote = data.indexQuotes?.find((row) => row.id === symbol);
    const legacy = getLegacyQuote(symbol);
    const previous = quote ? quote.previousClose : legacy?.fridayClose ?? null;
    const current = quote ? quote.value : legacy?.scanPrice ?? null;
    return { id: symbol, label: quote?.label ?? symbol, previous, current,
      change: previous !== null && current !== null && previous > 0 ? (current / previous - 1) * 100 : quote ? null : legacy?.changePercent ?? null,
      approximate: false, asOf: quote?.asOf ?? null };
  };
  const vix = data.marketContext?.find((row) => row.id === 'VIX');
  const rows = [
    quoteFor('NQ'),
    quoteFor('ES'),
    {
      id: 'VIX', label: 'VIX', previous: vix?.previousClose ?? null, current: vix?.value ?? null,
      change: vix?.value != null && vix.previousClose != null && vix.previousClose !== 0
        ? (vix.value / vix.previousClose - 1) * 100
        : null,
      approximate: vix?.approximate ?? false,
      asOf: vix?.asOf ?? null,
    },
  ];

  return <BriefTable role="indices" columns={['Market', 'Prev. Session Close', 'Premarket', 'Change (%)']}>
    {rows.map((row) => <tr key={row.id}>
      <th scope="row">{row.label}</th>
      <NumericCell value={row.previous} format="price" approximate={row.approximate} />
      <NumericCell value={row.current} format="price" approximate={row.approximate} asOf={row.current == null ? null : row.asOf} />
      <NumericCell value={row.change} format="percent" approximate={row.approximate} movement="standard" />
    </tr>)}
  </BriefTable>;
}

export function OvernightMovementsPanel({ data, showEquities = true, showBonds = true }: { data: Snapshot; showEquities?: boolean; showBonds?: boolean }) {
  const indexNotes = data.briefing?.indices ?? [];
  const bondNotes = data.briefing?.bonds ?? [];
  if (!showEquities && !showBonds) return null;
  return <BriefCard id="brief-overnight-movements" number={1} title="Overnight movements" role="overnight">
    <OvernightPair equities={showEquities} bonds={showBonds}>
      {showEquities && <section className="overnight-column" aria-labelledby="brief-indices">
        <h3 id="brief-indices">Overnight movements on the indices</h3>
        <IndexOvernightTable data={data} />
        <div className="overnight-commentary"><CommentaryNotes notes={indexNotes} empty="No index commentary supplied." /></div>
      </section>}
      {showBonds && <section className="overnight-column" aria-labelledby="brief-bonds">
        <h3 id="brief-bonds">Overnight movements on bonds</h3>
        <TreasuryYieldsTable data={data} />
        <div className="overnight-commentary"><CommentaryNotes notes={bondNotes} empty="No bond commentary supplied." /></div>
      </section>}
    </OvernightPair>
  </BriefCard>;
}

const treasuryTenors = ['5Y', '10Y', '30Y'] as const;
function TreasuryYieldsTable({ data }: { data: Snapshot }) {
  const yields = data.marketContext?.find((row) => row.id === 'US10Y');
  const yieldRows = data.treasuryYields ?? [];
  const rows = treasuryTenors.map((tenor) => {
    const supplied = yieldRows.find((row) => row.tenor === tenor);
    return {
      tenor,
      value: supplied?.value ?? (tenor === '10Y' ? yields?.value : null) ?? null,
      previousClose: supplied?.previousClose ?? (tenor === '10Y' ? yields?.previousClose : null) ?? null,
      asOf: supplied?.asOf ?? (tenor === '10Y' ? yields?.asOf : null),
      approximate: supplied?.approximate ?? (tenor === '10Y' ? yields?.approximate : false),
    };
  });
  const missing = rows.flatMap((row) => [
    ...(row.previousClose === null ? [`${row.tenor} previous session close`] : []),
    ...(row.value === null ? [`${row.tenor} premarket quote`] : []),
  ]);
  return <>
    <BriefTable role="yields" columns={['Treasury', 'Prev. Session Close', 'Premarket', 'Change']}>
        {rows.map((row) => {
          const { tenor } = row;
          const current = row.value;
          const previous = row.previousClose;
          const changeBps = current !== null && previous !== null ? (current - previous) * 100 : null;
          const approximate = row.approximate;
          return <tr key={tenor}>
            <th scope="row">{tenor}</th>
            <NumericCell value={previous} format="yield" approximate={approximate} />
            <NumericCell value={current} format="yield" approximate={approximate} asOf={current === null ? null : row.asOf} />
            <NumericCell value={changeBps} format="basisPoints" movement="inverse" />
          </tr>;
        })}
    </BriefTable>
    {missing.length > 0 && <p className="treasury-yields-note">Unavailable: {missing.join(', ')}. Blank values are not estimated.</p>}
  </>;
}
