const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:10410';

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export interface PortInfo {
  port: number;
  protocol: string;
  state: string;
  pid: number | null;
  process: string | null;
  isPortal: boolean;
  portalModule: string | null;
}

export interface PortsResponse {
  ports: PortInfo[];
  scannedAt: number;
}

export interface ServiceConfig {
  name: string;
  url: string;
}

export interface ServiceStatus {
  name: string;
  url: string;
  status: 'up' | 'down' | 'degraded';
  responseTimeMs: number;
  error?: string | null;
}

export interface StatusResponse {
  services: ServiceStatus[];
  checkedAt: string;
}

export const infraApi = {
  ports: (range?: 'portal') =>
    fetchJson<PortsResponse>(range ? `/ports?range=${range}` : '/ports'),
  getStatus: () => fetchJson<StatusResponse>('/status'),
  getConfig: () => fetchJson<ServiceConfig[]>('/config'),
  updateConfig: (services: ServiceConfig[]) =>
    fetchJson<ServiceConfig[]>('/config', { method: 'POST', body: JSON.stringify(services) }),
};
