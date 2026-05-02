import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, 'dist', 'client')
const distIndex = path.join(distDir, 'index.html')
const forceDev = process.argv.includes('--dev')
const useStatic =
  fs.existsSync(distIndex) && !forceDev && process.env.NODE_ENV === 'production'
const PORT = Number(process.env.PORT) || 5173

const app = express()
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
)
app.use(express.json())
app.use(cookieParser())

const AUTH_COOKIE = 'stock_insight_token'
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me'
const USERS_DIR = path.join(__dirname, 'data')
const USERS_FILE = path.join(USERS_DIR, 'users.json')

function ensureUsersFile() {
  if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true })
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2), 'utf8')
}

function readUsers() {
  ensureUsersFile()
  const raw = fs.readFileSync(USERS_FILE, 'utf8')
  const parsed = JSON.parse(raw)
  if (!parsed || !Array.isArray(parsed.users)) return { users: [] }
  return parsed
}

function writeUsers(next) {
  ensureUsersFile()
  fs.writeFileSync(USERS_FILE, JSON.stringify(next, null, 2), 'utf8')
}

function safeUser(u) {
  return { id: u.id, email: u.email, createdAt: u.createdAt }
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' })
}

function getTokenFromReq(req) {
  const token = req.cookies?.[AUTH_COOKIE]
  if (typeof token === 'string' && token.length > 10) return token
  return null
}

function requireAuth(req, res, next) {
  const token = getTokenFromReq(req)
  if (!token) return res.status(401).json({ error: 'Not authenticated.' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = payload
    return next()
  } catch {
    return res.status(401).json({ error: 'Session expired. Please log in again.' })
  }
}

function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production'
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE, { path: '/' })
}

app.post('/api/auth/signup', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email.' })
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' })

  const db = readUsers()
  const exists = db.users.find((u) => u.email === email)
  if (exists) return res.status(409).json({ error: 'Account already exists. Try logging in.' })

  const hash = await bcrypt.hash(password, 10)
  const user = { id: crypto.randomUUID(), email, passwordHash: hash, createdAt: new Date().toISOString() }
  db.users.push(user)
  writeUsers(db)

  const token = signToken(user)
  setAuthCookie(res, token)
  res.json({ user: safeUser(user) })
})

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' })

  const db = readUsers()
  const user = db.users.find((u) => u.email === email)
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' })

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'Invalid email or password.' })

  const token = signToken(user)
  setAuthCookie(res, token)
  res.json({ user: safeUser(user) })
})

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res)
  res.json({ ok: true })
})

app.get('/api/auth/me', (req, res) => {
  const token = getTokenFromReq(req)
  if (!token) return res.json({ user: null })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const db = readUsers()
    const user = db.users.find((u) => u.id === payload.sub)
    if (!user) return res.json({ user: null })
    return res.json({ user: safeUser(user) })
  } catch {
    return res.json({ user: null })
  }
})

function normalizeTicker(symbol) {
  const s = String(symbol || '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '.')
    .replace(/[^A-Z0-9.^]/g, '')
  if (!s) return null

  // Indian market convenience:
  // - If user types RELIANCE / TCS / INFY, default to NSE (.NS)
  // - Allow explicit suffixes: .NS (NSE), .BO (BSE)
  // - Allow index symbols like ^NSEI and ^BSESN as-is
  if (s.startsWith('^')) return s
  if (s.endsWith('.NS') || s.endsWith('.BO')) return s
  return `${s}.NS`
}

function normalizeRange(range) {
  const r = String(range || '')
    .trim()
    .toLowerCase()
  // Yahoo accepts: 1d,5d,1mo,3mo,6mo,1y,2y,5y,10y,ytd,max
  const allowed = new Set(['1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max'])
  if (allowed.has(r)) return r
  return '5y'
}

function normalizeInterval(interval) {
  const i = String(interval || '')
    .trim()
    .toLowerCase()
  // We only expose a safe subset.
  const allowed = new Set(['1d', '1wk', '1mo'])
  if (allowed.has(i)) return i
  return '1d'
}

const YAHOO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36'

/** Yahoo Finance v8 chart: daily OHLCV for ~last 10 years */
function candlesFromYahooChart(json, displaySymbol) {
  const chart = json?.chart
  const err = chart?.error?.description || chart?.result?.length === 0
  const result = chart?.result?.[0]
  if (err || !result) return null

  const ts = result.timestamp
  const q = result.indicators?.quote?.[0]
  if (!Array.isArray(ts) || !q) return null

  const opens = q.open || []
  const highs = q.high || []
  const lows = q.low || []
  const closes = q.close || []
  const vols = q.volume || []

  const candles = []
  for (let i = 0; i < ts.length; i++) {
    const close = closes[i]
    if (!Number.isFinite(close)) continue
    const t = ts[i]
    const date = new Date(t * 1000).toISOString().slice(0, 10)
    const o = opens[i]
    const h = highs[i]
    const l = lows[i]
    const v = vols[i]
    candles.push({
      date,
      open: Number.isFinite(o) ? o : close,
      high: Number.isFinite(h) ? h : close,
      low: Number.isFinite(l) ? l : close,
      close,
      volume: Number.isFinite(v) && v >= 0 ? Math.round(v) : 0,
    })
  }

  candles.sort((a, b) => a.date.localeCompare(b.date))
  const metaSym = typeof result.meta?.symbol === 'string' ? result.meta.symbol : displaySymbol

  const currency = typeof result.meta?.currency === 'string' ? result.meta.currency : null
  const tz = typeof result.meta?.exchangeTimezoneName === 'string' ? result.meta.exchangeTimezoneName : null
  const exchangeName = typeof result.meta?.exchangeName === 'string' ? result.meta.exchangeName : null

  return {
    candles,
    symbolResolved: metaSym.split('-')[0] || displaySymbol,
    currency,
    tz,
    exchangeName,
  }
}

app.get('/api/history', async (req, res) => {
  const raw = req.query.symbol || req.query.ticker || ''
  const sym = normalizeTicker(raw)
  if (!sym)
    return res.status(400).json({ error: 'Enter a valid ticker (e.g. AAPL).' })

  const range = normalizeRange(req.query.range)
  const interval = normalizeInterval(req.query.interval)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`
  try {
    const r = await fetch(url, { headers: { 'User-Agent': YAHOO_UA } })
    const json = await r.json()

    const parsed = candlesFromYahooChart(json, sym)
    if (!parsed?.candles?.length) {
      return res.status(404).json({
        error: `No data for "${raw}". Try another ticker or spelling (Yahoo may not cover this symbol).`,
      })
    }

    res.json({
      symbol: sym,
      candles: parsed.candles,
      vendorSymbol: parsed.symbolResolved,
      currency: parsed.currency,
      exchangeName: parsed.exchangeName,
      timezone: parsed.tz,
      range,
      interval,
    })
  } catch (e) {
    console.error(e)
    res.status(502).json({ error: 'Could not fetch market data.' })
  }
})

if (useStatic) {
  app.use(express.static(distDir))
  app.get('*', (_req, res) => {
    res.sendFile(distIndex)
  })
}

async function attachVite() {
  const { createServer } = await import('vite')
  const server = await createServer({
    configFile: path.join(__dirname, 'vite.config.ts'),
    server: {
      middlewareMode: true,
      strictPort: false,
      hmr: { overlay: true },
    },
    appType: 'spa',
    root: path.join(__dirname, 'client'),
  })
  app.use(server.middlewares)
}

function bindPort(doneLabel) {
  const srv = app.listen(PORT, () => {
    console.log(`${doneLabel}: http://localhost:${PORT}`)
  })
  srv.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(
        `[stock-insight] Port ${PORT} is already in use. Stop the existing server or set PORT to a free value (PowerShell: $env:PORT=5180 ; npm run dev).`,
      )
    } else console.error(err)
    process.exit(1)
  })
}

if (!useStatic) {
  attachVite()
    .then(() => bindPort(forceDev ? 'Dev' : 'Dev (no prod build detected)'))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
} else {
  bindPort('Production')
}
