export type Signal = 'lean_buy' | 'hold' | 'lean_avoid'

export interface Candle {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Analysis {
  signal: Signal
  headline: string
  detail: string
  metrics: {
    lastClose: number
    lastDate: string
    sma20: number | null
    sma50: number | null
    sma200: number | null
    change30dPct: number | null
    change1yPct: number | null
    rsi14: number | null
    vol20dPct: number | null
    maxDrawdownPct: number | null
    score: number
  }
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function sma(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  return average(closes.slice(-period))
}

function pctChange(current: number, past: number | null): number | null {
  if (past === null || !Number.isFinite(past) || past === 0) return null
  return ((current - past) / past) * 100
}

function rsi(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null
  let gain = 0
  let loss = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) gain += d
    else loss += -d
  }
  if (gain === 0 && loss === 0) return 50
  if (loss === 0) return 100
  const rs = gain / loss
  return 100 - 100 / (1 + rs)
}

function volOfReturnsPct(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null
  const rets: number[] = []
  for (let i = closes.length - period; i < closes.length; i++) {
    const prev = closes[i - 1]
    const cur = closes[i]
    if (!Number.isFinite(prev) || prev === 0 || !Number.isFinite(cur)) continue
    rets.push((cur - prev) / prev)
  }
  if (rets.length < Math.max(5, Math.floor(period * 0.6))) return null
  const m = average(rets)
  const v = average(rets.map((r) => (r - m) * (r - m)))
  const sd = Math.sqrt(v)
  return sd * 100
}

function maxDrawdownPct(closes: number[]): number | null {
  if (closes.length < 2) return null
  let peak = closes[0]
  let mdd = 0
  for (const c of closes) {
    if (!Number.isFinite(c)) continue
    if (c > peak) peak = c
    const dd = peak > 0 ? ((c - peak) / peak) * 100 : 0
    if (dd < mdd) mdd = dd
  }
  return mdd
}

export function analyzeCandles(candles: Candle[]): Analysis {
  const closes = candles.map((c) => c.close)
  const lastClose = closes[closes.length - 1]
  const lastDate = candles[candles.length - 1].date

  const sma20 = sma(closes, 20)
  const sma50 = sma(closes, 50)
  const sma200 = sma(closes, 200)

  const idx30 = closes.length - 1 - 30
  const close30dAgo = idx30 >= 0 ? closes[idx30] : null
  const idx252 = closes.length - 1 - 252
  const close1yAgo = idx252 >= 0 ? closes[idx252] : null

  const change30dPct = pctChange(lastClose, close30dAgo)
  const change1yPct = pctChange(lastClose, close1yAgo)
  const rsi14 = rsi(closes, 14)
  const vol20dPct = volOfReturnsPct(closes, 20)
  const maxDD = maxDrawdownPct(closes)

  const above20 = sma20 !== null && lastClose >= sma20
  const above50 = sma50 !== null && lastClose >= sma50
  const trendUp = sma20 !== null && sma50 !== null && sma20 >= sma50
  const trendDown = sma20 !== null && sma50 !== null && sma20 < sma50
  const longHealthy = sma200 === null ? null : sma50 !== null && sma50 >= sma200

  // Simple, transparent score in range [-100, +100]
  let score = 0
  if (above20) score += 15
  else score -= 15
  if (above50) score += 15
  else score -= 15
  if (trendUp) score += 15
  if (trendDown) score -= 15
  if (longHealthy === true) score += 10
  if (longHealthy === false) score -= 10
  if (change30dPct !== null) score += Math.max(-20, Math.min(20, change30dPct / 1.5))
  if (rsi14 !== null) {
    // Favor RSI in the 45-65 band; penalize very stretched.
    if (rsi14 >= 45 && rsi14 <= 65) score += 10
    else if (rsi14 > 75) score -= 10
    else if (rsi14 < 25) score -= 5 // oversold can bounce, but risk is high
  }
  score = Math.max(-100, Math.min(100, Math.round(score)))

  let signal: Signal = 'hold'
  let headline = 'Mixed signals'
  let detail =
    'The signals are blended. Consider waiting for clearer alignment or reduce position size in the simulation.'

  if (score >= 25) {
    signal = 'lean_buy'
    headline = 'Setup looks constructive'
    detail =
      'Trend + recent returns are supportive based on past prices. In real life you would still check fundamentals, valuation, and risk (and avoid over-sizing).'
  } else if (score <= -25) {
    signal = 'lean_avoid'
    headline = 'Setup looks risky'
    detail =
      'Trend + momentum are weak on this timeframe. Many investors wait for stabilization or a clear reversal before increasing risk.'
  } else if (score > 5) {
    headline = 'Slightly positive tilt'
    detail = 'Some signals point up, but not enough to be confident. In practice, smaller sizing or waiting can help.'
  } else if (score < -5) {
    headline = 'Slightly cautious tilt'
    detail = 'Some signals point down. Many traders wait for improvement before adding.'
  }

  return {
    signal,
    headline,
    detail,
    metrics: {
      lastClose,
      lastDate,
      sma20,
      sma50,
      sma200,
      change30dPct,
      change1yPct,
      rsi14,
      vol20dPct,
      maxDrawdownPct: maxDD,
      score,
    },
  }
}
