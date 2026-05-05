// api/client.ts — Typed API client for NexusAI Python backend

import type {
  User, Ticker, OHLCV, Signal, Bot, Trade, Strategy, BacktestResult,
} from "../types";

const BASE = "https://cryptobotapi.onrender.com";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function req<T>(path: string, opts: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { ...headers, ...(opts.headers as object || {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, err.detail || "Request failed");
  }
  return res.json();
}

// ── Auth ───────────────────────────────────────────────────────────────────────
export const authApi = {
  signup: (name: string, email: string, password: string) =>
    req<{ token: string; user: User }>("/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password }) }),

  login: (email: string, password: string) =>
    req<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  me: (token: string) => req<User>("/auth/me", {}, token),
};

// ── Market ─────────────────────────────────────────────────────────────────────
export const marketApi = {
  tickers: () => req<Ticker[]>("/market/tickers"),
  klines: (symbol: string, interval = "1h", limit = 100) =>
    req<OHLCV[]>(`/market/klines/${symbol}?interval=${interval}&limit=${limit}`),
};

// ── Signals ────────────────────────────────────────────────────────────────────
export const signalsApi = {
  list: (token: string) => req<Signal[]>("/signals", {}, token),
  generate: (token: string) => req<Signal[]>("/signals/generate", { method: "POST" }, token),
  sendTelegram: (token: string, signalId: string) =>
    req<{ ok: boolean }>(`/signals/${signalId}/telegram`, { method: "POST" }, token),
  copy: (token: string, signal_id: string) =>
    req<Signal>("/signals/copy",{method: "POST",body:JSON.stringify(signal_id)}, token),  
};

// ── Bots ───────────────────────────────────────────────────────────────────────
export const botsApi = {
  list: (token: string) => req<Bot[]>("/bots", {}, token),
  create: (token: string, data: { name: string; pair: string; strategy: string; capital: number }) =>
    req<Bot>("/bots", { method: "POST", body: JSON.stringify(data) }, token),
  update: (token: string, id: string, data: { status?: string; capital?: number }) =>
    req<Bot>(`/bots/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token),
  delete: (token: string, id: string) =>
    req<{ ok: boolean }>(`/bots/${id}`, { method: "DELETE" }, token),
};

// ── Trades ─────────────────────────────────────────────────────────────────────
export const tradesApi = {
  list: (token: string) => req<Trade[]>("/trades", {}, token),
  place: (token: string, data: { pair: string; side: string; amount: number; order_type: string; limit_price?: number }) =>
    req<Trade>("/trades", { method: "POST", body: JSON.stringify(data) }, token),
};

// ── Strategies ─────────────────────────────────────────────────────────────────
export const strategiesApi = {
  list: (token: string) => req<Strategy[]>("/strategies", {}, token),
  update: (token: string, id: string, parameters: Record<string, number>) =>
    req<Strategy>(`/strategies/${id}`, { method: "PATCH", body: JSON.stringify({ parameters }) }, token),
  backtest: (token: string, id: string) =>
    req<BacktestResult>(`/strategies/${id}/backtest`, { method: "POST" }, token),
};

// ── Settings ───────────────────────────────────────────────────────────────────
export const settingsApi = {
  updateTelegram: (token: string, telegram_token: string, telegram_chat_id: string) =>
    req<{ ok: boolean }>("/settings/telegram", { method: "PATCH", body: JSON.stringify({ telegram_token, telegram_chat_id }) }, token),
  testTelegram: (token: string) =>
    req<{ ok: boolean }>("/settings/telegram/test", { method: "POST" }, token),
};

export { ApiError };
