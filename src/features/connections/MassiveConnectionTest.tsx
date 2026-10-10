import { useState } from 'react';
import './MassiveConnectionTest.css';

type ApiResult = {
  sessionDate: string;
  bars: Array<{ time: string; high: number; low: number; close: number; volume: number | null }>;
  high: number | null;
  low: number | null;
  issue: string | null;
};

const price = (value: number | null) => value == null ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MassiveConnectionTest({ sessionDate }: { sessionDate: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const testConnection = async () => {
    setState('loading');
    setMessage('Requesting timestamped AAPL premarket bars…');
    try {
      const response = await fetch(`/api/massive-bars?symbol=AAPL&date=${encodeURIComponent(sessionDate)}`, { cache: 'no-store' });
      const result = await response.json() as ApiResult & { error?: string };
      if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
      if (!result.bars.length) throw new Error(result.issue || 'Massive returned no eligible premarket bars.');
      setState('success');
      setMessage(`Connected · ${result.bars.length} one-minute bars for AAPL on ${result.sessionDate}. High ${price(result.high)}, low ${price(result.low)}. The frozen snapshot was not changed.`);
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Massive request failed.');
    }
  };

  return <div className="provider-card massive-test-card">
    <div><strong>Massive</strong><span className={`provider-status ${state === 'success' ? 'positive' : ''}`}>{state === 'success' ? 'Connected' : 'Secondary source'}</span></div>
    <p>Test access to AAPL’s timestamped 04:00–09:19 ET bars for {sessionDate}. The free plan provides end-of-day data, so this checks historical access, not a live 06:20 AM feed.</p>
    <button className="primary-button" onClick={testConnection} disabled={state === 'loading'}>{state === 'loading' ? 'Testing…' : 'Test Massive connection'}</button>
    {message && <p className={`provider-test-result ${state}`} role={state === 'error' ? 'alert' : 'status'}>{message}</p>}
  </div>;
}
