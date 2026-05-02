import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import {
  analyzeCandles,
  type Analysis,
  type Candle,
  type Signal,
} from './analysis'
import {
  loadPortfolio,
  savePortfolio,
  buy,
  sell,
  resetPortfolio,
  portfolioEquity,
  loadWatchlist,
  saveWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  type Watchlist,
  type PortfolioState,
} from './portfolio'
import { AnalyzePage } from './pages/AnalyzePage'
import { PortfolioPage } from './pages/PortfolioPage'
import { WatchlistPage } from './pages/WatchlistPage'
import { AboutPage } from './pages/AboutPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { RequireAuth } from './RequireAuth'
import { useAuth } from './AuthProvider'

interface HistoryResponse {
  symbol: string
  candles: Candle[]
  currency?: string | null
  exchangeName?: string | null
  timezone?: string | null
  range?: string
  interval?: string
  error?: string
}

export function App() {
  const { user, logout } = useAuth()
  const [tickerInput, setTickerInput] = useState('RELIANCE')
  const [exchange, setExchange] = useState<'NSE' | 'BSE'>('NSE')
  const [range, setRange] = useState<'1y' | '2y' | '5y' | '10y' | 'max'>('5y')
  const [interval, setInterval] = useState<'1d' | '1wk'>('1d')
  const [loading, setLoading] = useState(false)
  const [fetchErr, setFetchErr] = useState<string | null>(null)

  const [symbol, setSymbol] = useState<string | null>(null)
  const [candles, setCandles] = useState<Candle[]>([])
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [meta, setMeta] = useState<{ currency: string | null; exchangeName: string | null; timezone: string | null }>(
    { currency: 'INR', exchangeName: null, timezone: null },
  )

  const [portfolio, setPortfolio] = useState<PortfolioState>(() => loadPortfolio())
  const [marks, setMarks] = useState<Record<string, number>>({})
  const [tradeMsg, setTradeMsg] = useState<string | null>(null)
  const [qtyStr, setQtyStr] = useState('1')
  const [watchlist, setWatchlist] = useState<Watchlist>(() => loadWatchlist())
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    savePortfolio(portfolio)
  }, [portfolio])

  useEffect(() => {
    saveWatchlist(watchlist)
  }, [watchlist])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  const price = candles.length ? candles[candles.length - 1].close : null

  const qty = Number(qtyStr)
  const qtyOk = Number.isFinite(qty) && qty > 0

  const loadTicker = useCallback(async (ticker: string, ex?: 'NSE' | 'BSE', r?: string, i?: string) => {
    setFetchErr(null)
    setLoading(true)
    try {
      const raw = ticker.trim().toUpperCase()
      const hasSuffix = /\.(NS|BO)$/.test(raw) || raw.startsWith('^')
      const q = hasSuffix ? raw : `${raw}.${(ex ?? exchange) === 'BSE' ? 'BO' : 'NS'}`
      const url = `/api/history?symbol=${encodeURIComponent(q)}&range=${encodeURIComponent(r ?? range)}&interval=${encodeURIComponent(i ?? interval)}`
      const res = await fetch(url)
      const data = (await res.json()) as HistoryResponse & { error?: string }
      if (!res.ok) {
        setSymbol(null)
        setCandles([])
        setAnalysis(null)
        setMeta({ currency: 'INR', exchangeName: null, timezone: null })
        setFetchErr(data.error || `Request failed (${res.status}).`)
        return
      }
      setSymbol(data.symbol)
      setCandles(data.candles)
      setAnalysis(analyzeCandles(data.candles))
      setMeta({
        currency: data.currency ?? 'INR',
        exchangeName: data.exchangeName ?? null,
        timezone: data.timezone ?? null,
      })
      setMarks((prev) => ({
        ...prev,
        [data.symbol]:
          data.candles[data.candles.length - 1]?.close ?? prev[data.symbol],
      }))
    } catch {
      setFetchErr('Network error.')
      setSymbol(null)
      setCandles([])
      setAnalysis(null)
      setMeta({ currency: 'INR', exchangeName: null, timezone: null })
    } finally {
      setLoading(false)
    }
  }, [exchange, interval, range])

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      void loadTicker(tickerInput, exchange, range, interval)
    },
    [loadTicker, tickerInput, exchange, range, interval],
  )

  const equityHeld = portfolioEquity(portfolio.positions, marks)
  const totalValue = portfolio.cash + equityHeld

  const formatPrice = useCallback(
    (v: number) => {
      const c = meta.currency || 'INR'
      const locale = c === 'INR' ? 'en-IN' : 'en-US'
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: c,
        maximumFractionDigits: 2,
      }).format(v)
    },
    [meta.currency],
  )

  const onBuy = useCallback(() => {
    if (!symbol || price === null) {
      setToast('Look up a ticker first.')
      return
    }
    const r = buy(portfolio, symbol, qty, price)
    if (r.ok) {
      setPortfolio(r.next)
      setTradeMsg(`Bought ${qty} × ${symbol} @ ${formatPrice(price)} (simulated).`)
      setToast('Trade saved to simulation.')
    } else setToast(r.reason)
  }, [portfolio, symbol, price, qty, formatPrice])

  const onSell = useCallback(() => {
    if (!symbol || price === null) {
      setToast('Look up a ticker first.')
      return
    }
    const r = sell(portfolio, symbol, qty, price)
    if (r.ok) {
      setPortfolio(r.next)
      setTradeMsg(`Sold ${qty} × ${symbol} @ ${formatPrice(price)} (simulated).`)
      setToast('Trade saved to simulation.')
    } else setToast(r.reason)
  }, [portfolio, symbol, price, qty, formatPrice])

  const money = useMemo(() => {
    const c = meta.currency || 'INR'
    const locale = c === 'INR' ? 'en-IN' : 'en-US'
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: c,
      maximumFractionDigits: 2,
    })
  }, [meta.currency])

  const fmtPct = useCallback((v: number | null, digits = 1) => {
    if (v === null) return '—'
    return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`
  }, [])

  const fmtNum = useCallback((v: number | null, digits = 2) => {
    if (v === null) return '—'
    return v.toFixed(digits)
  }, [])

  const refreshSymbols = useCallback(
    async (symbols: string[]) => {
      const uniq = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)))
      for (const s of uniq) {
        try {
          const url = `/api/history?symbol=${encodeURIComponent(s)}&range=1mo&interval=1d`
          const res = await fetch(url)
          if (!res.ok) continue
          const data = (await res.json()) as HistoryResponse
          const last = data.candles[data.candles.length - 1]?.close
          if (typeof last === 'number' && Number.isFinite(last)) {
            setMarks((prev) => ({ ...prev, [data.symbol]: last }))
          }
        } catch {
          // ignore
        }
      }
    },
    [],
  )

  const holdingsSymbols = useMemo(() => Object.keys(portfolio.positions), [portfolio.positions])
  const unrealized = useMemo(() => {
    let pnl = 0
    for (const [sym, pos] of Object.entries(portfolio.positions)) {
      const mark = marks[sym] ?? pos.avgCost
      pnl += pos.shares * (mark - pos.avgCost)
    }
    return pnl
  }, [portfolio.positions, marks])

  return (
    <div>
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      <nav className="top-nav" aria-label="Primary navigation">
        <span className="tag">Stock Insight</span>
        <div className="nav-links">
          <NavLink to="/analyze" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Analyze
          </NavLink>
          <NavLink to="/portfolio" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Portfolio
          </NavLink>
          <NavLink to="/watchlist" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Watchlist
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            About
          </NavLink>
          {user ? (
            <button type="button" className="ghost small" onClick={() => void logout()}>
              Logout
            </button>
          ) : (
            <NavLink to="/login" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              Login
            </NavLink>
          )}
        </div>
      </nav>

      <div className="header-bar">
        <div>
          <h1>Stock Insight</h1>
          <p className="muted small" style={{ marginBottom: 0 }}>
            Historical daily charts, a transparent moving-average outlook, and a{' '}
            <strong style={{ color: 'var(--text)' }}>simulated</strong> portfolio — no real brokerage.
          </p>
        </div>
        <span className="tag">Local practice tool</span>
      </div>

      <section className="card">
        <p className="disclaimer">
          This app uses simple math on past prices — not predictions, personalized advice, or a substitute
          for your own research and risk management. Real investing involves taxes, spreads, fundamentals,
          and emotional discipline.
        </p>
      </section>

      <Routes>
        <Route index element={<Navigate to="/analyze" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/analyze"
          element={
            <AnalyzePage
              tickerInput={tickerInput}
              setTickerInput={setTickerInput}
              exchange={exchange}
              setExchange={setExchange}
              range={range}
              setRange={setRange}
              interval={interval}
              setInterval={setInterval}
              loading={loading}
              fetchErr={fetchErr}
              symbol={symbol}
              candles={candles}
              analysis={analysis}
              money={money}
              meta={meta}
              qtyStr={qtyStr}
              setQtyStr={setQtyStr}
              qtyOk={qtyOk}
              tradeMsg={tradeMsg}
              onSubmit={onSubmit}
              loadTicker={(t, ex, r, i) => loadTicker(t, ex, r, i)}
              fmtNum={fmtNum}
              fmtPct={fmtPct}
              onBuy={onBuy}
              onSell={onSell}
              watchlist={watchlist}
              addToWatchlist={addToWatchlist}
              setWatchlist={setWatchlist}
              portfolio={portfolio}
            />
          }
        />
        <Route
          path="/portfolio"
          element={
            <RequireAuth>
              <PortfolioPage
                portfolio={portfolio}
                marks={marks}
                money={money}
                equityHeld={equityHeld}
                totalValue={totalValue}
                unrealized={unrealized}
                refreshSymbols={(syms) => void refreshSymbols(syms)}
                resetPortfolio={() => setPortfolio(resetPortfolio())}
              />
            </RequireAuth>
          }
        />
        <Route
          path="/watchlist"
          element={
            <RequireAuth>
              <WatchlistPage
                watchlist={watchlist}
                marks={marks}
                money={money}
                refreshSymbols={(syms) => void refreshSymbols(syms)}
                loadTicker={(t) => void loadTicker(t, exchange, range, interval)}
                remove={(sym) => setWatchlist((x) => removeFromWatchlist(x, sym))}
              />
            </RequireAuth>
          }
        />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      <footer className="muted small" style={{ marginTop: '2rem' }}>
        Price history is aggregated from Yahoo Finance-style market data for education only; it can be incomplete or delayed. Not financial advice.
      </footer>
    </div>
  )
}
