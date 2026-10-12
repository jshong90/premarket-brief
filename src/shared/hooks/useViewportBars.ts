import { useEffect, useRef } from 'react';

/** Replays the shared CSS fill on each viewport entry; removes it on exit. */
export function useViewportBars() {
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (!('IntersectionObserver' in window)) {
      panel.classList.add('bars-visible');
      return () => panel.classList.remove('bars-visible');
    }
    const reveal = new IntersectionObserver(entries => {
      for (const entry of entries) {
        entry.target.classList.toggle('bars-visible', entry.isIntersecting);
      }
    }, { threshold: 0, rootMargin: '0px 0px -32px 0px' });
    reveal.observe(panel);
    return () => {
      reveal.disconnect();
      panel.classList.remove('bars-visible');
    };
  }, []);
  return panelRef;
}
