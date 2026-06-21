const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:10411";

export interface ServiceConfig {
  name: string;
  url: string;
}

export interface ServiceStatus {
  name: string;
  url: string;
  status: "up" | "down" | "degraded";
  responseTimeMs: number;
  error?: string | null;
}

export interface StatusResponse {
  services: ServiceStatus[];
  checkedAt: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const healthApi = {
  getHealth: () => request<{ status: string }>("/health"),
  getStatus: () => request<StatusResponse>("/status"),
  getConfig: () => request<ServiceConfig[]>("/config"),
  updateConfig: (services: ServiceConfig[]) =>
    request<ServiceConfig[]>("/config", {
      method: "POST",
      body: JSON.stringify(services),
    }),
  exportConfig: () => request<ServiceConfig[]>("/config/export"),
  importConfig: (services: ServiceConfig[]) =>
    request<ServiceConfig[]>("/config/import", {
      method: "POST",
      body: JSON.stringify(services),
    }),
};
