import type { ReactNode } from 'react';

export function BriefStack({ children }: { children: ReactNode }) {
  return <div className="morning-sections">{children}</div>;
}

/** Selects paired/single-topic layout; callers retain visibility and content decisions. */
export function OvernightPair({ equities, bonds, children }: {
  equities: boolean;
  bonds: boolean;
  children: ReactNode;
}) {
  return <div className={`overnight-pair${equities && bonds ? '' : ' is-single-topic'}${equities ? ' has-equities' : ''}${bonds ? ' has-bonds' : ''}`}>
    {children}
  </div>;
}
