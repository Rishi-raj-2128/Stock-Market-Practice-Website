import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="card">
      <div className="section-title">
        <h2>Page not found</h2>
      </div>
      <p className="muted small">
        That route doesn’t exist. Go back to <Link to="/analyze">Analyze</Link>.
      </p>
    </section>
  )
}

