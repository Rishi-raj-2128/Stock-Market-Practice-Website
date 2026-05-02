import type { Watchlist } from '../portfolio'

interface WatchlistPageProps {
  watchlist: Watchlist
  marks: Record<string, number>
  money: Intl.NumberFormat
  refreshSymbols: (symbols: string[]) => void
  loadTicker: (ticker: string) => void
  remove: (symbol: string) => void
}

export function WatchlistPage(props: WatchlistPageProps) {
  return (
    <section className="card">
      <div className="section-title">
        <h2>Watchlist</h2>
        <button type="button" className="ghost" onClick={() => props.refreshSymbols(props.watchlist)}>
          Refresh watchlist
        </button>
      </div>

      {props.watchlist.length === 0 ? (
        <p className="muted small" style={{ marginBottom: 0 }}>
          Add a symbol from the Analyze page using “+ Watch”.
        </p>
      ) : (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>
            Tip: use NSE by default (e.g. <span className="mono">TCS</span> → <span className="mono">TCS.NS</span>).
          </p>
          <table className="positions-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Mark</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {props.watchlist.map((w) => (
                <tr key={w}>
                  <td className="mono">{w}</td>
                  <td>{props.marks[w] !== undefined ? props.money.format(props.marks[w]!) : <span className="muted">—</span>}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="ghost small" onClick={() => props.loadTicker(w)}>
                      Analyze
                    </button>
                    <button type="button" className="ghost small" onClick={() => props.remove(w)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}

