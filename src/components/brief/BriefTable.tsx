import type { ReactNode } from 'react';

const tableRoles = {
  indices: { wrapper: 'index-quotes-wrap', table: 'index-quotes' },
  yields: { wrapper: 'treasury-yields-wrap', table: 'treasury-yields-table' },
  levels: { wrapper: 'key-levels-wrap', table: 'key-levels-table' },
} as const;

/** Shared native table structure; feature adapters retain their row calculations. */
export function BriefTable({ role, columns, children }: {
  role: keyof typeof tableRoles;
  columns: readonly string[];
  children: ReactNode;
}) {
  const classes = tableRoles[role];
  return <div className={classes.wrapper}><table className={classes.table}>
    <thead><tr>{columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead>
    <tbody>{children}</tbody>
  </table></div>;
}
