// components/CandlestickChart.tsx

import { useEffect, useRef } from "react";
import type { OHLCV } from "../types";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  IChartApi,
  UTCTimestamp
} from "lightweight-charts";

interface Props {
  candles: OHLCV[];
  height?: number;
}

export default function CandlesStick({
  candles,
  height = 300
}: Props) {

  const chartRef = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    chart.current = createChart(chartRef.current, {
      height,
      layout: {
        background: { color: "#0b1220" },
        textColor: "#94a3b8"
      },
      grid: {
        vertLines: { color: "#0f1b2d" },
        horzLines: { color: "#0f1b2d" }
      },
      crosshair: {
        mode: 0
      },
      rightPriceScale: {
        borderColor: "#1e293b"
      },
      timeScale: {
        borderColor: "#1e293b"
      }
    });

    const candleSeries = chart.current.addSeries(CandlestickSeries, {
      upColor: "#00d084",
      downColor: "#ff4757",
      borderVisible: false,
      wickUpColor: "#00d084",
      wickDownColor: "#ff4757"
    });

    const volumeSeries = chart.current.addSeries(HistogramSeries, {
      priceFormat: {
        type: "volume"
      },
      priceScaleId: ""
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0
      }
    });

    const ema20Series = chart.current.addSeries(LineSeries, {
      color: "#ffaa00",
      lineWidth: 2
    });

    const ema50Series = chart.current.addSeries(LineSeries, {
      color: "#4da6ff",
      lineWidth: 2
    });

    const validCandles = candles.filter(c => c && c.time);

    const candleData = validCandles.map(c  => ({
        time: parseInt(c.time) / 1000 as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      }));

    candleSeries.setData(validCandles);
    volumeSeries.setData(
      candles.map(c => ({
        time: (parseInt(c.time) / 1000) as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "#00d08455" : "#ff475755"
      }))
    );
    function ema(values: number[], period: number) {
      const k = 2 / (period + 1);
      let ema = values[0];
      const result = [ema];

      for (let i = 1; i < values.length; i++) {
        ema = values[i] * k + ema * (1 - k);
        result.push(ema);
      }

      return result;
    }


    const closes = validCandles.map(c => c.close);
    const ema20 = ema(closes, 20);
    const ema50 = ema(closes, 50);
/*
    ema20Series.setData(
      ema20.map((v, i) => ({
        time:validCandles[i / 1000 as UTCTimestamp].time as UTCTimestamp,
        value: v
      }))
    );

    ema50Series.setData(
      ema50.map((v, i) => ({
        time: validCandles[i / 1000 as UTCTimestamp].time as UTCTimestamp,
        value: v
      }))
    );
*/
    chart.current.timeScale().fitContent();

    const resize = () => {
      chart.current?.applyOptions({
        width: chartRef.current!.clientWidth
      });
    };

    window.addEventListener("resize", resize);
    resize();

    return () => {
      window.removeEventListener("resize", resize);
      chart.current?.remove();
    };

  }, [candles, height]);

  return <div ref={chartRef} style={{ width: "100%" }} />;
}