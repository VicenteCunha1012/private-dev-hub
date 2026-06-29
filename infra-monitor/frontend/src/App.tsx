import { useState, useEffect, useCallback, useRef } from 'react';
import { infraApi, type PortInfo, type ServiceStatus, type StatusResponse, type ServiceConfig } from './api/infraApi';

type Tab = 'ports' | 'services';
type RefreshInterval = 0 | 5000 | 10000 | 30000;

function App() {
  const [tab, setTab] = useState<Tab>('ports');

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-h)', letterSpacing: '-0.3px' }}>
          <span style={{ color: 'var(--accent)' }}>{'>'}_</span> Infra Monitor
        </h1>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: 3, border: '1px solid var(--border)' }}>
          <TabBtn active={tab === 'ports'} onClick={() => setTab('ports')}>Ports</TabBtn>
          <TabBtn active={tab === 'services'} onClick={() => setTab('services')}>Services</TabBtn>
        </div>
      </header>
      {tab === 'ports' ? <PortsView /> : <ServicesView />}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 16px', borderRadius: 4, fontSize: 13, fontWeight: active ? 600 : 400,
        color: active ? 'var(--accent)' : 'var(--text)',
        background: active ? 'rgba(6,182,212,0.12)' : 'transparent',
        border: 'none', cursor: 'pointer', transition: 'all 0.12s',
      }}
    >
      {children}
    </button>
  );
}

// ── Ports tab ──────────────────────────────────────────────────────────────────

function PortsView() {
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
      const res = await infraApi.ports(portalOnly ? 'portal' : undefined);
      setPorts(res.ports);
      setScannedAt(res.scannedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch ports');
    } finally {
      setLoading(false);
    }
  }, [portalOnly]);

  useEffect(() => { void fetchPorts(); }, [fetchPorts]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => void fetchPorts(), 5000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchPorts]);

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

  const isConflict = (p: PortInfo) =>
    p.isPortal && !!p.portalModule && p.state === 'LISTEN' &&
    p.process !== '' && p.process != null &&
    !['java', 'docker-proxy', 'nginx', 'postgres', 'ttyd'].some(e => p.process!.toLowerCase().includes(e));

  const stateBadgeStyle = (state: string) => {
    if (state === 'LISTEN') return { background: 'rgba(34,197,94,0.12)', color: 'var(--success)' };
    if (state === 'ESTABLISHED') return { background: 'rgba(6,182,212,0.12)', color: 'var(--accent)' };
    if (state === 'TIME_WAIT' || state === 'CLOSE_WAIT') return { background: 'rgba(245,158,11,0.12)', color: 'var(--warning)' };
    return { background: 'rgba(156,163,175,0.12)', color: 'var(--text)' };
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        {scannedAt && <span style={{ fontSize: 12, color: 'var(--text)', opacity: 0.7 }}>Last scan: {new Date(scannedAt).toLocaleTimeString()}</span>}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button className={autoRefresh ? 'active' : ''} onClick={() => setAutoRefresh(p => !p)}>
            {autoRefresh ? 'Auto: ON (5s)' : 'Auto: OFF'}
          </button>
          <button className={portalOnly ? 'active' : ''} onClick={() => setPortalOnly(p => !p)}>
            {portalOnly ? 'Portal only' : 'Show all'} <Kbd>p</Kbd>
          </button>
          <button onClick={() => void fetchPorts()} disabled={loading}>
            {loading ? 'Scanning...' : 'Refresh'} <Kbd>r</Kbd>
          </button>
        </div>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Port</th><th>Protocol</th><th>State</th><th>PID</th><th>Process</th><th>Module</th><th></th>
            </tr>
          </thead>
          <tbody>
            {ports.length === 0 && !loading && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text)' }}>No ports found</td></tr>
            )}
            {ports.map((p, i) => (
              <tr
                key={`${p.port}-${p.protocol}-${i}`}
                className={p.isPortal ? 'portal-row' : ''}
                style={{ cursor: p.state === 'LISTEN' ? 'pointer' : 'default' }}
                onClick={() => p.state === 'LISTEN' && window.open(`http://localhost:${p.port}`, '_blank')}
              >
                <td style={{ fontWeight: 600 }}>{p.port}</td>
                <td>{p.protocol}</td>
                <td>
                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, fontFamily: 'var(--sans)', textTransform: 'uppercase', letterSpacing: '0.3px', ...stateBadgeStyle(p.state) }}>
                    {p.state}
                  </span>
                </td>
                <td style={{ color: 'var(--text)', opacity: 0.7 }}>{p.pid ?? '-'}</td>
                <td>{p.process ?? '-'}</td>
                <td>
                  {p.portalModule && (
                    <span style={{ background: 'var(--accent-bg)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
                      {p.portalModule}
                    </span>
                  )}
                </td>
                <td>
                  {isConflict(p) && (
                    <span style={{ background: 'var(--warning-bg)', color: 'var(--warning)', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                      CONFLICT
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Services tab ───────────────────────────────────────────────────────────────

function ServicesView() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(10000);
  const [editMode, setEditMode] = useState(false);
  const [editedServices, setEditedServices] = useState<ServiceConfig[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await infraApi.getStatus();
      setData(result);
    } catch { /* keep last data */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (refreshInterval > 0) timerRef.current = setInterval(fetchStatus, refreshInterval);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [refreshInterval, fetchStatus]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'r') { e.preventDefault(); setLoading(true); fetchStatus(); }
    };
    document.addEventListener('keydown', handle, true);
    return () => document.removeEventListener('keydown', handle, true);
  }, [fetchStatus]);

  const startEdit = async () => {
    const cfg = await infraApi.getConfig();
    setEditedServices(cfg);
    setEditMode(true);
  };

  const saveEdit = async () => {
    await infraApi.updateConfig(editedServices);
    setEditMode(false);
    fetchStatus();
  };

  if (loading && !data) {
    return <div className="loading"><div className="spinner" />Checking services...</div>;
  }

  const services = data?.services ?? [];
  const upCount = services.filter(s => s.status === 'up').length;
  const downCount = services.filter(s => s.status === 'down').length;
  const degradedCount = services.filter(s => s.status === 'degraded').length;
  const total = services.length;
  const summaryColor = downCount > 0 ? 'var(--red)' : degradedCount > 0 ? 'var(--yellow)' : 'var(--accent)';

  if (editMode) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Edit Services</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditMode(false)}>Cancel</button>
            <button className="active" onClick={saveEdit}>Save</button>
          </div>
        </div>
        {editedServices.map((svc, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input
              value={svc.name}
              onChange={e => setEditedServices(prev => prev.map((s, j) => j === i ? { ...s, name: e.target.value } : s))}
              placeholder="Name"
              style={{ width: 180, padding: '6px 10px', fontSize: 13, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }}
            />
            <input
              value={svc.url}
              onChange={e => setEditedServices(prev => prev.map((s, j) => j === i ? { ...s, url: e.target.value } : s))}
              placeholder="URL"
              style={{ flex: 1, padding: '6px 10px', fontSize: 13, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }}
            />
            <button onClick={() => setEditedServices(prev => prev.filter((_, j) => j !== i))} style={{ color: 'var(--danger)', padding: '4px 10px' }}>✕</button>
          </div>
        ))}
        <button onClick={() => setEditedServices(prev => [...prev, { name: '', url: '' }])} style={{ marginTop: 8 }}>+ Add</button>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: summaryColor }} />
          <span style={{ fontSize: 13 }}>{upCount}/{total} up{degradedCount > 0 ? ` · ${degradedCount} degraded` : ''}{downCount > 0 ? ` · ${downCount} down` : ''}</span>
          {data && <span style={{ fontSize: 12, color: 'var(--text)', opacity: 0.6 }}>· {new Date(data.checkedAt).toLocaleTimeString()}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={startEdit}>Edit</button>
          <select value={refreshInterval} onChange={e => setRefreshInterval(Number(e.target.value) as RefreshInterval)}>
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
            <option value={0}>Off</option>
          </select>
          <button onClick={() => { setLoading(true); fetchStatus(); }}>Refresh <Kbd>r</Kbd></button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {services.map(svc => <ServiceCard key={svc.name} service={svc} />)}
      </div>
    </>
  );
}

function ServiceCard({ service }: { service: ServiceStatus }) {
  const color = service.status === 'up' ? 'var(--success)' : service.status === 'degraded' ? 'var(--warning)' : 'var(--danger)';
  const bg = service.status === 'up' ? 'rgba(34,197,94,0.08)' : service.status === 'degraded' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)';
  return (
    <div style={{ background: 'var(--bg-card)', border: `1px solid var(--border)`, borderRadius: 8, padding: '14px 16px', borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{service.name}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: bg, color }}>{service.status.toUpperCase()}</span>
        <span style={{ fontSize: 11, color: 'var(--text)', opacity: 0.6 }}>{service.responseTimeMs}ms</span>
      </div>
      {service.error && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 8, opacity: 0.8 }}>{service.error}</div>}
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, padding: '1px 4px', marginLeft: 4, lineHeight: 1.5 }}>
      {children}
    </kbd>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: 'var(--danger)', marginBottom: 16, fontSize: 13 }}>
      {children}
    </div>
  );
}

export default App;
