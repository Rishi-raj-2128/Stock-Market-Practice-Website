import type { PortfolioState } from '../portfolio'

interface PortfolioPageProps {
  portfolio: PortfolioState
  marks: Record<string, number>
  money: Intl.NumberFormat
  equityHeld: number
  totalValue: number
  unrealized: number
  refreshSymbols: (symbols: string[]) => void
  resetPortfolio: () => void
}

export function PortfolioPage(props: PortfolioPageProps) {
  const holdingsSymbols = Object.keys(props.portfolio.positions)

  return (
    <section className="card">
      <div className="section-title">
        <h2>Simulated portfolio</h2>
        <div className="trade-row" style={{ marginTop: 0 }}>
          <button type="button" className="ghost" onClick={() => props.refreshSymbols(holdingsSymbols)}>
            Refresh prices
          </button>
          <button type="button" className="danger-outline" onClick={props.resetPortfolio}>
            Reset simulation
          </button>
        </div>
      </div>

      <div className="positions-summary">
        <div>
          <div className="muted small">Cash</div>
          <div className="mono" style={{ fontSize: '1.1rem' }}>
            {props.money.format(props.portfolio.cash)}
          </div>
        </div>
        <div>
          <div className="muted small">Holdings @ last marks*</div>
          <div className="mono" style={{ fontSize: '1.1rem' }}>
            {props.money.format(props.equityHeld)}
          </div>
        </div>
        <div>
          <div className="muted small">Total</div>
          <div className="mono" style={{ fontSize: '1.1rem' }}>
            {props.money.format(props.totalValue)}
          </div>
        </div>
        <div>
          <div className="muted small">Unrealized P&L</div>
          <div
            className="mono"
            style={{ fontSize: '1.1rem', color: props.unrealized >= 0 ? 'var(--ok)' : 'var(--danger)' }}
          >
            {props.money.format(props.unrealized)}
          </div>
        </div>
      </div>

      <p className="muted small" style={{ marginTop: 0 }}>
        *Mark prices update when you load that ticker in Analyze. Symbols you have never loaded use average cost until
        you refresh them.
      </p>

      {Object.keys(props.portfolio.positions).length === 0 ? (
        <p className="muted small" style={{ marginBottom: 0 }}>
          No positions yet — run an analysis and use simulate buy/sell at last close.
        </p>
      ) : (
        <table className="positions-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Shares</th>
              <th>Avg cost</th>
              <th>Mark</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(props.portfolio.positions).map(([sym, pos]) => {
              const mark = props.marks[sym] ?? pos.avgCost
              return (
                <tr key={sym}>
                  <td className="mono">{sym}</td>
                  <td>{pos.shares}</td>
                  <td>{props.money.format(pos.avgCost)}</td>
                  <td>{props.money.format(mark)}</td>
                  <td>{props.money.format(pos.shares * mark)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}

