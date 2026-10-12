import { useState } from 'react';

/** A real iframe viewport exercises the dashboard's media queries without changing data. */
export function ResponsivePreview() {
  const [width,setWidth]=useState(375);
  return <>
    <label className="section-meta">Preview width <select aria-label="Dashboard preview width" value={width} onChange={event=>setWidth(Number(event.target.value))}>
      <option value={320}>320 px</option><option value={375}>375 px</option><option value={390}>390 px</option><option value={768}>768 px</option><option value={1200}>1200 px</option>
    </select></label>
    <p className="section-meta">This frame displays the published dashboard. Its theme and Design Lab preferences are shared with the page.</p>
    <iframe className="reference-preview" title="Responsive dashboard preview" src="./index.html" width={width} height={800} loading="lazy" />
  </>;
}
