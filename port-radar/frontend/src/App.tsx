import { useState, useEffect, useCallback, useRef } from 'react';
import type { PortInfo } from './api/radarApi';
import { radarApi } from './api/radarApi';

function App() {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [scannedAt, setScannedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalOnly, setPortalOnly] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPorts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await radarApi.ports(portalOnly ? 'portal' : undefined);
      setPorts(res.ports);
      setScannedAt(res.scannedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch ports');
    } finally {
      setLoading(false);
    }
  }, [portalOnly]);

  useEffect(() => {
    void fetchPorts();
  }, [fetchPorts]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        void fetchPorts();
      }, 5000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchPorts]);

  const isConflict = (p: PortInfo): boolean => {
    if (!p.isPortal || !p.portalModule) return false;
    if (p.state !== 'LISTEN') return false;
    const proc = (p.process ?? '').toLowerCase();
    const expected = ['java', 'docker-proxy', 'nginx', 'postgres', 'ttyd'];
    return proc !== '' && !expected.some(e => proc.includes(e));
  };

  const isClickable = (p: PortInfo): boolean => p.state === 'LISTEN';

  // Keyboard shortcuts
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'r') { e.preventDefault(); void fetchPorts(); }
      if (e.key === 'p') { e.preventDefault(); setPortalOnly(prev => !prev); }
    };
    document.addEventListener('keydown', handle, true);
    return () => document.removeEventListener('keydown', handle, true);
  }, [fetchPorts]);

  const handlePortClick = (p: PortInfo) => {
    if (isClickable(p)) {
      window.open(`http://localhost:${p.port}`, '_blank');
    }
  };

  const formatTime = (ts: number): string => {
    return new Date(ts).toLocaleTimeString();
  };

  const stateBadgeClass = (state: string): string => {
    switch (state) {
      case 'LISTEN': return 'badge badge-listen';
      case 'ESTABLISHED': return 'badge badge-established';
      case 'TIME_WAIT':
      case 'CLOSE_WAIT': return 'badge badge-wait';
      default: return 'badge badge-other';
    }
  };

  return (
    <div>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text-h)',
            letterSpacing: '-0.3px',
          }}>
            <span style={{ color: 'var(--accent)' }}>{'>'}_</span> Port Radar
          </h1>
          {scannedAt && (
            <span style={{ fontSize: 12, color: 'var(--text)', opacity: 0.7 }}>
              Last scan: {formatTime(scannedAt)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={autoRefresh ? 'active' : ''}
            onClick={() => setAutoRefresh(prev => !prev)}
          >
            {autoRefresh ? 'Auto: ON (5s)' : 'Auto: OFF'}
          </button>
          <button
            className={portalOnly ? 'active' : ''}
            onClick={() => setPortalOnly(prev => !prev)}
          >
            {portalOnly ? 'Portal only' : 'Show all'}<kbd style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, padding: '1px 4px', marginLeft: 4, lineHeight: 1.5 }}>p</kbd>
          </button>
          <button onClick={() => void fetchPorts()} disabled={loading}>
            {loading ? 'Scanning...' : 'Refresh'}<kbd style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, padding: '1px 4px', marginLeft: 4, lineHeight: 1.5 }}>r</kbd>
          </button>
        </div>
      </header>

      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 6,
          color: 'var(--danger)',
          marginBottom: 16,
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        <table>
          <thead>
            <tr>
              <th>Port</th>
              <th>Protocol</th>
              <th>State</th>
              <th>PID</th>
              <th>Process</th>
              <th>Module</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ports.length === 0 && !loading && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text)' }}>
                  No ports found
                </td>
              </tr>
            )}
            {ports.map((p, i) => (
              <tr
                key={`${p.port}-${p.protocol}-${p.state}-${i}`}
                className={p.isPortal ? 'portal-row' : ''}
                style={{ cursor: isClickable(p) ? 'pointer' : 'default' }}
                onClick={() => handlePortClick(p)}
              >
                <td style={{ fontWeight: 600 }}>{p.port}</td>
                <td>{p.protocol}</td>
                <td>
                  <span className={stateBadgeClass(p.state)}>{p.state}</span>
                </td>
                <td style={{ color: 'var(--text)', opacity: 0.7 }}>{p.pid ?? '-'}</td>
                <td>{p.process ?? '-'}</td>
                <td>
                  {p.portalModule && (
                    <span style={{
                      background: 'var(--accent-bg)',
                      color: 'var(--accent)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                    }}>
                      {p.portalModule}
                    </span>
                  )}
                </td>
                <td>
                  {isConflict(p) && (
                    <span style={{
                      background: 'var(--warning-bg)',
                      color: 'var(--warning)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: 'var(--sans)',
                    }}>
                      CONFLICT
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          font-family: var(--sans);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .badge-listen {
          background: rgba(34, 197, 94, 0.12);
          color: var(--success);
        }
        .badge-established {
          background: rgba(6, 182, 212, 0.12);
          color: var(--accent);
        }
        .badge-wait {
          background: rgba(245, 158, 11, 0.12);
          color: var(--warning);
        }
        .badge-other {
          background: rgba(156, 163, 175, 0.12);
          color: var(--text);
        }
      `}</style>
    </div>
  );
}

export default App;
