import { formatET, formatNumeric, movementClass, type Movement, type NumericFormat } from './numericFormat';

type NumericCellProps = {
  value: number | null | undefined;
  format: NumericFormat;
  approximate?: boolean;
  movement?: Movement;
  asOf?: string | null;
};

/** Native table cell: no extra wrapper, computation or inferred observation time. */
export function NumericCell({ value, format, approximate = false, movement, asOf }: NumericCellProps) {
  const observed = formatET(asOf);
  return <td className={`mono${movement ? ` ${movementClass(value, movement)}` : ''}`}>
    {formatNumeric(value, format, approximate)}{observed && <small>{observed} ET</small>}
  </td>;
}
