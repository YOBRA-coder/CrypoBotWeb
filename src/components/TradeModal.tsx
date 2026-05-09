import React, { useMemo, useState } from "react"
import { S } from "../pages/styles"

export default function TradeModal({
  trade,
  currentPrice,
  onClose
}: any) {

  const [tp, setTp] = useState("")
  const [sl, setSl] = useState("")

  const pnl = useMemo(() => {
    return trade.side === "BUY"
      ? (currentPrice - trade.price) * trade.amount
      : (trade.price - currentPrice) * trade.amount
  }, [trade, currentPrice])

  const modal = { background: "#1a2332", borderRadius: 12, padding: 20, maxWidth: 400, width: "90%" }
  const header = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }
  const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }
  const input = {
  flex: 1,
  padding: 8,
  background: "#070d17",
  border: "1px solid #0a1828",
  borderRadius: 6,
  width: "100%",
  color: "#e0eaf5"
};

  return (
    <div style={{position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999}}>
      <div style={modal}>

        <div style={header}>
          <div>
            <div style={{ fontWeight: 800 }}>
              {trade.pair}
            </div>

            <div style={{
              color: trade.side === "BUY"
                ? "#00d084"
                : "#ff4757"
            }}>
              {trade.side}
            </div>
          </div>

          <button onClick={onClose} style={S.btnO}>
            ✕
          </button>
        </div>

        <div style={grid}>
          <Stat label="Entry" value={trade.price.toFixed(2)} />
          <Stat label="Current" value={currentPrice.toFixed(2)} />
          <Stat label="Amount" value={trade.amount} />
          <Stat
            label="PnL"
            value={pnl.toFixed(2)}
            color={pnl >= 0 ? "#00d084" : "#ff4757"}
          />
        </div>

        <div style={{ marginTop: 16 }}>

          <input
            placeholder="Take Profit"
            value={tp}
            onChange={e => setTp(e.target.value)}
            style={input}
          />

          <input
            placeholder="Stop Loss"
            value={sl}
            onChange={e => setSl(e.target.value)}
            style={input}
          />

          <button style={S.btn}>
            Update Trade
          </button>

          <button style={S.danger}>
            Close Position
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: any) {
  return (
    <div style={{
      background: "#0f1722",
      padding: 10,
      borderRadius: 8
    }}>
      <div style={{
        color: "#6b7a90",
        fontSize: 11
      }}>
        {label}
      </div>

      <div style={{
        color: color || "#fff",
        fontWeight: 700
      }}>
        {value}
      </div>
    </div>
  )
}