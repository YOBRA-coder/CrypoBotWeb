// pages/shared.ts — Shared page props type
import type { Ticker, Signal, Bot, Trade, Strategy } from "../types";

export interface PageProps {
  tickers: Ticker[];
  signals: Signal[];
  setSignals: React.Dispatch<React.SetStateAction<Signal[]>>;
  bots: Bot[];
  setBots: React.Dispatch<React.SetStateAction<Bot[]>>;
  trades: Trade[];
  setTrades: React.Dispatch<React.SetStateAction<Trade[]>>;
  strategies: Strategy[];
  setStrategies: React.Dispatch<React.SetStateAction<Strategy[]>>;
  notify: (msg: string, type?: "success" | "error" | "info") => void;
}
