const BASE_URL =
  import.meta.env.VITE_ARCADE_API_URL ?? "http://localhost:10413";

/* ---------- Types ---------- */

export interface CoinsResponse {
  balance: number;
  history: unknown[];
}

export interface EarnCoinsRequest {
  amount: number;
  reason: string;
}

export interface CatalogEntry {
  id: string;
  name: string;
  type: string;
  description: string;
  icon: string;
}

export interface InsertCoinResponse {
  sessionId: string;
  games: CatalogEntry[];
}

export interface StartGameResponse {
  ok: boolean;
}

export interface SubmitScoreRequest {
  gameId: string;
  score: number;
  durationSeconds?: number;
  won?: boolean;
}

export interface SubmitScoreResponse {
  isHighScore: boolean;
  previousHigh: number;
}

export interface ScoreEntry {
  gameId: string;
  gameName: string;
  highScore: number;
  lastScore: number;
  timesPlayed: number;
  lastPlayed: string;
}

/* ---------- Helpers ---------- */

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `API ${options?.method ?? "GET"} ${path} failed (${res.status}): ${body}`,
    );
  }

  return res.json() as Promise<T>;
}

/* ---------- Endpoints ---------- */

export function getCoins(): Promise<CoinsResponse> {
  return request<CoinsResponse>("/coins");
}

export function earnCoins(body: EarnCoinsRequest): Promise<{ balance: number }> {
  return request<{ balance: number }>("/coins/earn", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getCatalog(): Promise<CatalogEntry[]> {
  return request<CatalogEntry[]>("/catalog");
}

export function insertCoin(): Promise<InsertCoinResponse> {
  return request<InsertCoinResponse>("/play/insert-coin", {
    method: "POST",
  });
}

export function startGame(
  sessionId: string,
  gameId: string,
): Promise<StartGameResponse> {
  return request<StartGameResponse>("/play/start", {
    method: "POST",
    body: JSON.stringify({ sessionId, gameId }),
  });
}

export function submitScore(
  body: SubmitScoreRequest,
): Promise<SubmitScoreResponse> {
  return request<SubmitScoreResponse>("/scores", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getScores(): Promise<ScoreEntry[]> {
  return request<ScoreEntry[]>("/scores");
}
