import type { Snapshot } from '@/lib/scanner';
import type { KeyLevel, SnapshotKeyLevels } from './keyLevelsTypes';
import { BriefTable } from '@/components/brief/BriefTable';
import { NumericCell } from '@/components/brief/NumericCell';
import { formatFuturesSession } from './futuresSession';

const majorIndices: KeyLevel['id'][] = ['ES', 'NQ', 'YM', 'RTY'];
const indexNames: Record<KeyLevel['id'], string> = {
  ES: 'S&P 500 (ES)',
  NQ: 'Nasdaq-100 (NQ)',
  YM: 'Dow (YM)',
  RTY: 'Russell 2000 (RTY)',
};
const tvSymbols: Record<KeyLevel['id'], string> = {
  ES: 'CME_MINI:ES1!',
  NQ: 'CME_MINI:NQ1!',
  YM: 'CBOT_MINI:YM1!',
  RTY: 'CME_MINI:RTY1!',
};
export function KeyLevelsTable({ data }: { data: Snapshot }) {
  const keyLevelData = data as SnapshotKeyLevels;
  const keyLevels = keyLevelData.keyLevels ?? [];
  const byId = new Map(keyLevels.map((row) => [row.id, row]));
  const coverageIssues = keyLevels.filter((row) => row.issue);
  return <>
    <BriefTable role="levels" columns={['Market', 'Premarket high', 'Premarket low']}>
        {majorIndices.map((id) => {
          const row = byId.get(id);
          return <tr key={id}>
            <th scope="row"><a href={row?.url ?? `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbols[id])}`} target="_blank" rel="noreferrer">{row?.label ?? indexNames[id]} ↗</a></th>
            <NumericCell value={row?.high} format="price" asOf={row?.highTime} />
            <NumericCell value={row?.low} format="price" asOf={row?.lowTime} />
          </tr>;
        })}
    </BriefTable>
    <p className="key-levels-note">Window: {formatFuturesSession(data.sessionDate)}; the 9:20 AM ET bar is excluded. {coverageIssues.length > 0 ? coverageIssues.map((row) => `${row.label}: ${row.issue}`).join(' ') : 'All four rows have complete returned-bar coverage.'}</p>
  </>;
}
