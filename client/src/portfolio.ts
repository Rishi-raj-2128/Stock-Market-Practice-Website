const KEY = 'stock-insight-portfolio-v1'
const START_CASH = 1_00_000
const WATCH_KEY = 'stock-insight-watchlist-v1'

export interface Position {
  shares: number
  avgCost: number
}

export interface PortfolioState {
  cash: number
  positions: Record<string, Position>
}

export type Watchlist = string[]

function empty(): PortfolioState {
  return { cash: START_CASH, positions: {} }
}

export function loadPortfolio(): PortfolioState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const data = JSON.parse(raw) as PortfolioState
    if (typeof data.cash !== 'number' || typeof data.positions !== 'object')
      return empty()
    return data
  } catch {
    return empty()
  }
}

export function savePortfolio(p: PortfolioState): void {
  localStorage.setItem(KEY, JSON.stringify(p))
}

export function resetPortfolio(): PortfolioState {
  const p = empty()
  savePortfolio(p)
  return p
}

export function loadWatchlist(): Watchlist {
  try {
    const raw = localStorage.getItem(WATCH_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    return data
      .map((s) => String(s || '').trim().toUpperCase())
      .filter((s) => s.length > 0)
      .slice(0, 50)
  } catch {
    return []
  }
}

export function saveWatchlist(w: Watchlist): void {
  localStorage.setItem(WATCH_KEY, JSON.stringify(w))
}

export function addToWatchlist(w: Watchlist, symbol: string): Watchlist {
  const s = symbol.trim().toUpperCase()
  if (!s) return w
  const next = [s, ...w.filter((x) => x !== s)]
  return next.slice(0, 50)
}

export function removeFromWatchlist(w: Watchlist, symbol: string): Watchlist {
  const s = symbol.trim().toUpperCase()
  return w.filter((x) => x !== s)
}

export function buy(
  p: PortfolioState,
  symbol: string,
  shares: number,
  price: number,
): { ok: true; next: PortfolioState } | { ok: false; reason: string } {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return { ok: false, reason: 'Ticker required.' }
  if (shares <= 0 || !Number.isFinite(shares)) return { ok: false, reason: 'Invalid quantity.' }
  if (price <= 0 || !Number.isFinite(price))
    return { ok: false, reason: 'Load a quote first (invalid price).' }
  const total = shares * price
  if (total > p.cash + 1e-6)
    return { ok: false, reason: 'Not enough simulated cash.' }
  const next: PortfolioState = {
    cash: p.cash - total,
    positions: { ...p.positions },
  }
  const existing = next.positions[sym]
  if (existing) {
    const qty = existing.shares + shares
    const avg =
      qty > 0
        ? (existing.shares * existing.avgCost + shares * price) / qty
        : price
    next.positions[sym] = { shares: qty, avgCost: avg }
  } else {
    next.positions[sym] = { shares, avgCost: price }
  }
  return { ok: true, next }
}

export function sell(
  p: PortfolioState,
  symbol: string,
  shares: number,
  price: number,
): { ok: true; next: PortfolioState } | { ok: false; reason: string } {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return { ok: false, reason: 'Ticker required.' }
  if (shares <= 0 || !Number.isFinite(shares)) return { ok: false, reason: 'Invalid quantity.' }
  const pos = p.positions[sym]
  if (!pos || pos.shares < shares)
    return { ok: false, reason: 'Not enough shares.' }
  const proceeds = shares * price
  const next: PortfolioState = {
    cash: p.cash + proceeds,
    positions: { ...p.positions },
  }
  const left = pos.shares - shares
  if (left <= 0) delete next.positions[sym]
  else next.positions[sym] = { shares: left, avgCost: pos.avgCost }
  return { ok: true, next }
}

export function portfolioEquity(positions: Record<string, Position>, marks: Record<string, number>): number {
  let eq = 0
  for (const [sym, pos] of Object.entries(positions)) {
    const m = marks[sym] ?? pos.avgCost
    eq += pos.shares * m
  }
  return eq
}
