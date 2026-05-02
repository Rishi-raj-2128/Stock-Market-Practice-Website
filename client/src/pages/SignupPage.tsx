import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthProvider'

export function SignupPage() {
  const { signup } = useAuth()
  const nav = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setErr(null)
      if (password !== password2) {
        setErr('Passwords do not match.')
        return
      }
      setBusy(true)
      try {
        await signup(email, password)
        nav('/analyze', { replace: true })
      } catch (e2) {
        setErr(e2 instanceof Error ? e2.message : 'Signup failed.')
      } finally {
        setBusy(false)
      }
    },
    [signup, email, password, password2, nav],
  )

  return (
    <section className="card">
      <div className="section-title">
        <h2>Sign up</h2>
        <Link className="nav-link" to="/login">
          Log in
        </Link>
      </div>

      <form onSubmit={onSubmit} className="stack">
        <label className="muted small">
          Email
          <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>
        <label className="muted small">
          Password (min 6 chars)
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </label>
        <label className="muted small">
          Confirm password
          <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="••••••••" />
        </label>
        <button className="primary" type="submit" disabled={busy || !email.trim() || password.length < 6 || password2.length < 6}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        {err && <p className="error-msg">{err}</p>}
        <p className="muted small" style={{ marginBottom: 0 }}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </section>
  )
}

