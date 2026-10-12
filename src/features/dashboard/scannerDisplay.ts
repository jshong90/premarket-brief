import type { Band } from '@/lib/scanner';

export const number = (v: number | null | undefined, digits=2) => v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
export const quotePrice = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:3});
export const percent = (v: number | null | undefined, digits=2) => v == null ? '—' : `${number(v,digits)}%`;
export const signed = (v: number | null | undefined, suffix='%') => v == null ? '—' : `${v>0?'+':''}${number(v)}${suffix}`;
export const clock = (v: string | null | undefined) => !v ? '—' : new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v));
export const tone = (band: Band | null) => band === 'Exceptional RS' ? 'exceptional' : band === 'Clear RS' ? 'clear' : band === 'Moderate RS' ? 'moderate' : band === 'Laggard' ? 'laggard' : 'neutral';
