import type { ReactNode } from 'react';

/** Native fragment navigation retains focus/scroll behavior and shared motion hooks. */
export function SectionJump({ target, children }: {
  target: 'morning-brief' | 'relative-strength';
  children: ReactNode;
}) {
  return <a className="primary-button section-jump" href={`#${target}`}>{children}</a>;
}
