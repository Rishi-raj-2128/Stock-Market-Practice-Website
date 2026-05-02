import { useMemo, useState } from 'react'
import type { Analysis, Candle, Signal } from '../analysis'
import type { PortfolioState, Watchlist } from '../portfolio'
import { PriceChart, type ChartType } from '../PriceChart'

interface AnalyzePageProps {
  tickerInput: string
  setTickerInput: (v: string) => void
  exchange: 'NSE' | 'BSE'
  setExchange: (v: 'NSE' | 'BSE') => void
  range: '1y' | '2y' | '5y' | '10y' | 'max'
  setRange: (v: '1y' | '2y' | '5y' | '10y' | 'max') => void
  interval: '1d' | '1wk'
  setInterval: (v: '1d' | '1wk') => void

  loading: boolean
  fetchErr: string | null

  symbol: string | null
  candles: Candle[]
  analysis: Analysis | null
  money: Intl.NumberFormat
  meta: { currency: string | null; exchangeName: string | null; timezone: string | null }

  qtyStr: string
  setQtyStr: (v: string) => void
  qtyOk: boolean

  tradeMsg: string | null

  onSubmit: (e: React.FormEvent) => void
  loadTicker: (ticker: string, ex?: 'NSE' | 'BSE', r?: string, i?: string) => void

  fmtNum: (v: number | null, digits?: number) => string
  fmtPct: (v: number | null, digits?: number) => string

  onBuy: () => void
  onSell: () => void

  watchlist: Watchlist
  addToWatchlist: (w: Watchlist, symbol: string) => Watchlist
  setWatchlist: (updater: (prev: Watchlist) => Watchlist) => void

  portfolio: PortfolioState
}

function signalLabel(s: Signal): string {
  if (s === 'lean_buy') return 'Practice view: leaning favorable'
  if (s === 'lean_avoid') return 'Practice view: leaning cautious'
  return 'Practice view: neutral / mixed'
}

export function AnalyzePage(props: AnalyzePageProps) {
  const hints = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', '^NSEI']
  const [chartType, setChartType] = useState<ChartType>('line')

  const chartLabel = useMemo(() => {
    if (chartType === 'candles') return 'Candles'
    if (chartType === 'area') return 'Area'
    return 'Line'
  }, [chartType])

  return (
    <section className="card">
      <div className="section-title">
        <h2>Quote & outlook</h2>
        <span className="muted small">
          Cash: <span className="mono">{props.money.format(props.portfolio.cash)}</span>
        </span>
      </div>

      <form onSubmit={props.onSubmit} className="search-row">
        <label className="muted small">
          India ticker&nbsp;
          <input
            type="text"
            value={props.tickerInput}
            onChange={(e) => props.setTickerInput(e.target.value.toUpperCase())}
            placeholder="e.g. RELIANCE / TCS / ^NSEI"
            autoComplete="off"
            aria-label="Stock ticker symbol"
          />
        </label>

        <label className="muted small">
          Exchange&nbsp;
          <select
            value={props.exchange}
            onChange={(e) => props.setExchange(e.target.value === 'BSE' ? 'BSE' : 'NSE')}
            aria-label="Exchange"
          >
            <option value="NSE">NSE (.NS)</option>
            <option value="BSE">BSE (.BO)</option>
          </select>
        </label>

        <label className="muted small">
          Range&nbsp;
          <select
            value={props.range}
            onChange={(e) => props.setRange((e.target.value as typeof props.range) || '5y')}
            aria-label="Range"
          >
            <option value="1y">1y</option>
            <option value="2y">2y</option>
            <option value="5y">5y</option>
            <option value="10y">10y</option>
            <option value="max">max</option>
          </select>
        </label>

        <label className="muted small">
          Interval&nbsp;
          <select
            value={props.interval}
            onChange={(e) => props.setInterval(e.target.value === '1wk' ? '1wk' : '1d')}
            aria-label="Interval"
          >
            <option value="1d">1 day</option>
            <option value="1wk">1 week</option>
          </select>
        </label>

        <button type="submit" className="primary" disabled={props.loading || !props.tickerInput.trim()}>
          {props.loading ? 'Loading…' : 'Analyze'}
        </button>

        {hints.map((h) => (
          <button
            key={h}
            type="button"
            className="ghost small"
            onClick={() => props.loadTicker(h, props.exchange, props.range, props.interval)}
          >
            {h}
          </button>
        ))}
      </form>

      {props.fetchErr && <p className="error-msg">{props.fetchErr}</p>}

      {props.symbol && props.analysis && (
        <>
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <strong className="mono" style={{ fontSize: '1.25rem' }}>
              {props.symbol}
            </strong>
            <span className={`signal ${props.analysis.signal}`}>{signalLabel(props.analysis.signal)}</span>
            <span className="muted small mono">
              Last close {props.money.format(props.analysis.metrics.lastClose)}{' '}
              <span className="muted">({props.analysis.metrics.lastDate})</span>
            </span>
            <button
              type="button"
              className="ghost small"
              onClick={() => props.setWatchlist((w) => props.addToWatchlist(w, props.symbol!))}
            >
              + Watch
            </button>
          </div>

          <p style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            <strong>{props.analysis.headline}</strong> — {props.analysis.detail}
          </p>

          <div className="metric-grid">
            <div className="metric">
              <div className="label">SMA 20</div>
              <div className="value">{props.fmtNum(props.analysis.metrics.sma20)}</div>
            </div>
            <div className="metric">
              <div className="label">SMA 50</div>
              <div className="value">{props.fmtNum(props.analysis.metrics.sma50)}</div>
            </div>
            <div className="metric">
              <div className="label">SMA 200</div>
              <div className="value">{props.fmtNum(props.analysis.metrics.sma200)}</div>
            </div>
            <div className="metric">
              <div className="label">≈30d Δ</div>
              <div className="value">{props.fmtPct(props.analysis.metrics.change30dPct)}</div>
            </div>
            <div className="metric">
              <div className="label">≈1y Δ</div>
              <div className="value">{props.fmtPct(props.analysis.metrics.change1yPct)}</div>
            </div>
            <div className="metric">
              <div className="label">RSI 14</div>
              <div className="value">
                {props.analysis.metrics.rsi14 !== null ? props.analysis.metrics.rsi14.toFixed(1) : '—'}
              </div>
            </div>
            <div className="metric">
              <div className="label">Vol 20d</div>
              <div className="value">{props.fmtPct(props.analysis.metrics.vol20dPct, 2)}</div>
            </div>
            <div className="metric">
              <div className="label">Max DD</div>
              <div className="value">{props.fmtPct(props.analysis.metrics.maxDrawdownPct, 1)}</div>
            </div>
            <div className="metric">
              <div className="label">Score</div>
              <div className="value">{props.analysis.metrics.score}</div>
            </div>
          </div>

          <div className="trade-row" style={{ marginTop: '0.85rem' }}>
            <span className="muted small">
              Chart: <span className="mono">{chartLabel}</span>
            </span>
            <button type="button" className={chartType === 'line' ? 'primary small' : 'ghost small'} onClick={() => setChartType('line')}>
              Line
            </button>
            <button type="button" className={chartType === 'area' ? 'primary small' : 'ghost small'} onClick={() => setChartType('area')}>
              Area
            </button>
            <button
              type="button"
              className={chartType === 'candles' ? 'primary small' : 'ghost small'}
              onClick={() => setChartType('candles')}
            >
              Candles
            </button>
          </div>

          <PriceChart candles={props.candles} maxDays={150} chartType={chartType} />

          <div className="trade-row">
            <label className="muted small">
              Shares&nbsp;
              <input
                type="number"
                min={1}
                step={1}
                value={props.qtyStr}
                onChange={(e) => props.setQtyStr(e.target.value)}
              />
            </label>
            <button type="button" className="primary" onClick={props.onBuy} disabled={!props.qtyOk}>
              Simulate buy @ last close
            </button>
            <button type="button" className="ghost" onClick={props.onSell} disabled={!props.qtyOk}>
              Simulate sell @ last close
            </button>
          </div>

          {props.tradeMsg && (
            <p className="muted small" style={{ marginTop: '0.5rem' }}>
              {props.tradeMsg}
            </p>
          )}
        </>
      )}
    </section>
  )
}

