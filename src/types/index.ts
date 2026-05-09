// types/index.ts — Shared TypeScript types for NexusAI

export interface User {
  id: string;
  name: string;
  email: string;
  telegram_token?: string;
  telegram_chat_id?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

export interface Ticker {
  symbol: string;
  price: number;
  change24h: number;
  changePct: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  bid: number;
  ask: number;
  lastUpdate: number;
}

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Signal {
  id: string;
  pair: string;
  type: "BUY" | "SELL" | "HOLD";
  strength: number;
  price: number;
  target_price: number;
  stop_loss: number;
  confidence: number;
  reason: string;
  ai_generated: boolean | number;
  status: "ACTIVE" | "CLOSED" | "PENDING";
  created_at: number;
  // Legacy camelCase compat
  targetPrice?: number;
  stopLoss?: number;
  aiGenerated?: boolean;
  timestamp?: number;
}

export interface Bot {
  id: string;
  user_id: string;
  name: string;
  pair: string;
  strategy: string;
  status: "RUNNING" | "STOPPED" | "PAUSED";
  profit: number;
  trades: number;
  win_rate: number;
  capital: number;
  current_position?: "LONG" | "SHORT" | null;
  started_at: number;
}

export interface Trade {
  id: string;
  user_id?: string;
  bot_id?: string | null;
  pair: string;
  side: "BUY" | "SELL";
  price: number;
  amount: number;
  total: number;
  fee: number;
  pnl: number;
  status: "FILLED" | "PENDING" | "CANCELLED";
  created_at?: number;
  timestamp?: number;
}

export interface Strategy {
  id: string;
  user_id?: string;
  name: string;
  description: string;
  win_rate: number;
  total_trades: number;
  profit_factor: number;
  max_drawdown: number;
  parameters: Record<string, number> | string;
}

export interface BacktestResult {
  profit: number;
  trades: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
}
// In your types file
export interface KlineUpdate {
  symbol: string;
  interval: string;
  data: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    closed: boolean;
  };
}

export type KlineMessage = {
  symbol: string;
  interval: string;
  data: KlineUpdate[];
}

// WebSocket message types
export type WSMessage =
  | { type: "TICKERS"; data: Ticker[] }
  | { type: "BOTS_UPDATE"; data: Bot[] }
  | { type: "NEW_TRADE"; data: Trade }
  | { type: "NEW_SIGNALS"; data: Signal[] }
  | { type: "INIT"; data: { bots: Bot[]; trades: Trade[]; signals: Signal[] } }
  | { type: "PING" | "PONG" }
  | {type: "KLINE"; data: KlineUpdate[]};

export type Page = "dashboard" | "trading" | "signals" | "bots" | "strategy" | "history" | "settings";

export const PAIR_DISPLAY: Record<string, string> = {
  BTCUSDT: "BTC/USDT", ETHUSDT: "ETH/USDT", BNBUSDT: "BNB/USDT",
  SOLUSDT: "SOL/USDT", XRPUSDT: "XRP/USDT", ADAUSDT: "ADA/USDT",
  DOGEUSDT: "DOGE/USDT", AVAXUSDT: "AVAX/USDT", DOTUSDT: "DOT/USDT",
  MATICUSDT: "MATIC/USDT", LTCUSDT: "LTC/USDT", LINKUSDT: "LINK/USDT",
};

export const PAIRS = Object.keys(PAIR_DISPLAY);

export function fmtPrice(price: number): string {
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price < 100) return price.toFixed(3);
  if (price < 10000) return price.toFixed(2);
  return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
