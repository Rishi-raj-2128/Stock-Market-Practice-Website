import { useCallback, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthProvider'

export function LoginPage() {
  const { login } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from || '/analyze'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setErr(null)
      setBusy(true)
      try {
        await login(email, password)
        nav(from, { replace: true })
      } catch (e2) {
        setErr(e2 instanceof Error ? e2.message : 'Login failed.')
      } finally {
        setBusy(false)
      }
    },
    [login, email, password, nav, from],
  )

  return (
    <section className="card">
      <div className="section-title">
        <h2>Log in</h2>
        <Link className="nav-link" to="/signup">
          Create account
        </Link>
      </div>

      <form onSubmit={onSubmit} className="stack">
        <label className="muted small">
          Email
          <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>
        <label className="muted small">
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </label>
        <button className="primary" type="submit" disabled={busy || !email.trim() || password.length < 1}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {err && <p className="error-msg">{err}</p>}
        <p className="muted small" style={{ marginBottom: 0 }}>
          Don’t have an account? <Link to="/signup">Sign up</Link>
        </p>
      </form>
    </section>
  )
}

