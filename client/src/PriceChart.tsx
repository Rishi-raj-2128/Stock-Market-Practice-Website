import type { Candle } from './analysis'

export type ChartType = 'line' | 'area' | 'candles'

interface Props {
  candles: Candle[]
  maxDays?: number
  chartType?: ChartType
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

export function PriceChart({ candles, maxDays = 120, chartType = 'line' }: Props) {
  const slice = candles.slice(Math.max(0, candles.length - maxDays))
  if (slice.length < 2) return null

  const closes = slice.map((c) => c.close)
  const lows = slice.map((c) => c.low)
  const highs = slice.map((c) => c.high)

  const min = Math.min(...(chartType === 'candles' ? lows : closes))
  const max = Math.max(...(chartType === 'candles' ? highs : closes))
  const pad = (max - min) * 0.06 || min * 0.02 || 1
  const lo = min - pad
  const hi = max + pad

  const w = 100
  const h = 42

  const first = closes[0]!
  const last = closes[closes.length - 1]!
  const stroke = last >= first ? 'var(--chart-up)' : 'var(--chart-down)'

  const toY = (y: number) => {
    const t = (y - lo) / (hi - lo)
    return h - clamp(t, 0, 1) * h
  }

  const linePoints = closes
    .map((y, i) => {
      const x = (i / (closes.length - 1)) * w
      const vy = toY(y)
      return `${x.toFixed(2)},${vy.toFixed(2)}`
    })
    .join(' ')

  const areaPath = `M 0 ${h} L ${linePoints.replaceAll(' ', ' L ')} L ${w} ${h} Z`

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} className="price-chart" preserveAspectRatio="none">
        {chartType === 'area' && <path d={areaPath} fill={stroke} opacity={0.18} />}

        {chartType === 'candles' ? (
          <>
            {slice.map((c, i) => {
              const xCenter = (i / (slice.length - 1)) * w
              const wickX = xCenter
              const yHigh = toY(c.high)
              const yLow = toY(c.low)
              const yOpen = toY(c.open)
              const yClose = toY(c.close)

              const up = c.close >= c.open
              const color = up ? 'var(--chart-up)' : 'var(--chart-down)'
              const bodyTop = Math.min(yOpen, yClose)
              const bodyBot = Math.max(yOpen, yClose)
              const bodyH = Math.max(0.7, bodyBot - bodyTop)

              const step = w / Math.max(1, slice.length - 1)
              const bodyW = clamp(step * 0.55, 0.6, 3.2)
              const bodyX = xCenter - bodyW / 2

              return (
                <g key={`${c.date}-${i}`}>
                  <line x1={wickX} y1={yHigh} x2={wickX} y2={yLow} stroke={color} strokeWidth={0.55} />
                  <rect
                    x={bodyX}
                    y={bodyTop}
                    width={bodyW}
                    height={bodyH}
                    fill={up ? color : 'transparent'}
                    stroke={color}
                    strokeWidth={0.55}
                    opacity={0.95}
                  />
                </g>
              )
            })}
          </>
        ) : (
          <polyline fill="none" stroke={stroke} strokeWidth={0.85} strokeLinejoin="round" points={linePoints} />
        )}
      </svg>
      <div className="chart-meta muted small">
        {slice[0]?.date} → {slice[slice.length - 1]?.date} ·{' '}
        {chartType === 'candles' ? 'OHLC' : chartType === 'area' ? 'area (close)' : 'line (close)'}
      </div>
    </div>
  )
}
