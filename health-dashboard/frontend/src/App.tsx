import { useState, useEffect, useCallback, useRef } from "react";
import { healthApi, type StatusResponse, type ServiceStatus } from "./api/healthApi";

type RefreshInterval = 0 | 5000 | 10000 | 30000;

function App() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(10000);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await healthApi.getStatus();
      setData(result);
    } catch {
      /* keep last data visible on transient errors */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (refreshInterval > 0) {
      timerRef.current = setInterval(fetchStatus, refreshInterval);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refreshInterval, fetchStatus]);

  const handleRefresh = () => {
    setLoading(true);
    fetchStatus();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'r') { e.preventDefault(); handleRefresh(); }
    };
    document.addEventListener('keydown', handle, true);
    return () => document.removeEventListener('keydown', handle, true);
  }, [fetchStatus]);

  if (loading && !data) {
    return (
      <div className="loading">
        <div className="spinner" />
        Checking services...
      </div>
    );
  }

  const services = data?.services ?? [];
  const upCount = services.filter((s) => s.status === "up").length;
  const downCount = services.filter((s) => s.status === "down").length;
  const degradedCount = services.filter((s) => s.status === "degraded").length;
  const total = services.length;

  let summaryClass = "all-up";
  if (downCount > 0) summaryClass = "some-down";
  else if (degradedCount > 0) summaryClass = "some-degraded";

  const summaryDotColor =
    downCount > 0 ? "var(--red)" : degradedCount > 0 ? "var(--yellow)" : "var(--accent)";

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString();
    } catch {
      return iso;
    }
  };

  return (
    <>
      <div className="header">
        <h1>Health Dashboard</h1>
        <div className="header-controls">
          {data && (
            <span className="timestamp">Last: {formatTime(data.checkedAt)}</span>
          )}
          <button type="button" onClick={handleRefresh}>
            Refresh<kbd style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, padding: '1px 4px', marginLeft: 4, lineHeight: 1.5 }}>r</kbd>
          </button>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value) as RefreshInterval)}
          >
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
            <option value={0}>Off</option>
          </select>
        </div>
      </div>

      <div className={`summary-bar ${summaryClass}`}>
        <div className="summary-dot" style={{ background: summaryDotColor }} />
        {upCount}/{total} services up
        {degradedCount > 0 && ` · ${degradedCount} degraded`}
        {downCount > 0 && ` · ${downCount} down`}
      </div>

      <div className="services-grid">
        {services.map((svc) => (
          <ServiceCard key={svc.name} service={svc} />
        ))}
      </div>
    </>
  );
}

function ServiceCard({ service }: { service: ServiceStatus }) {
  return (
    <div className="service-card">
      <div className="card-header">
        <div className={`status-dot ${service.status}`} />
        <span className="name">{service.name}</span>
      </div>
      <div className="card-meta">
        <span className="response-time">{service.responseTimeMs}ms</span>
      </div>
      {service.error && <div className="card-error">{service.error}</div>}
    </div>
  );
}

export default App;
