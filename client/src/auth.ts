export type AuthUser = {
  id: string
  email: string
  createdAt: string
}

type ApiOk<T> = T
type ApiErr = { error: string }

async function api<T>(path: string, init?: RequestInit): Promise<ApiOk<T>> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    credentials: 'include',
  })

  const data = (await res.json().catch(() => ({}))) as T & ApiErr
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`)
  return data as T
}

export async function authMe(): Promise<{ user: AuthUser | null }> {
  return await api<{ user: AuthUser | null }>('/api/auth/me', { method: 'GET' })
}

export async function authSignup(email: string, password: string): Promise<{ user: AuthUser }> {
  return await api<{ user: AuthUser }>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function authLogin(email: string, password: string): Promise<{ user: AuthUser }> {
  return await api<{ user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function authLogout(): Promise<{ ok: true }> {
  return await api<{ ok: true }>('/api/auth/logout', { method: 'POST' })
}

