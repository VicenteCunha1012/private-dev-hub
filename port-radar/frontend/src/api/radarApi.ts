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

export interface ConfigResponse {
  procNetPath: string;
  procPath: string;
}

export interface HealthResponse {
  status: string;
}

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:10410';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const radarApi = {
  health: () => fetchJson<HealthResponse>('/health'),
  config: () => fetchJson<ConfigResponse>('/config'),
  ports: (range?: 'portal') =>
    fetchJson<PortsResponse>(range ? `/ports?range=${range}` : '/ports'),
};
