const API_BASE = process.env.NEXT_PUBLIC_BKEND_API_URL || 'https://api.bkend.ai/v1'
const PROJECT_ID = process.env.NEXT_PUBLIC_BKEND_PROJECT_ID || ''
const ENVIRONMENT = process.env.NEXT_PUBLIC_BKEND_ENV || 'dev'

async function bkendFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('bkend_access_token') : null
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-project-id': PROJECT_ID,
      'x-environment': ENVIRONMENT,
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const error = await res.text()
    throw new Error(error)
  }
  return res.json()
}

export const bkend = {
  auth: {
    signup: (body: { email: string; password: string; name?: string }) =>
      bkendFetch('/auth/email/signup', { method: 'POST', body: JSON.stringify(body) }),
    signin: (body: { email: string; password: string }) =>
      bkendFetch('/auth/email/signin', { method: 'POST', body: JSON.stringify(body) }),
    me: () => bkendFetch('/auth/me'),
    signout: () => bkendFetch('/auth/signout', { method: 'POST' }),
  },
  data: {
    list: (table: string, params?: Record<string, string>) =>
      bkendFetch(`/data/${table}?${new URLSearchParams(params)}`),
    get: (table: string, id: string) =>
      bkendFetch(`/data/${table}/${id}`),
    create: (table: string, body: unknown) =>
      bkendFetch(`/data/${table}`, { method: 'POST', body: JSON.stringify(body) }),
    update: (table: string, id: string, body: unknown) =>
      bkendFetch(`/data/${table}/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (table: string, id: string) =>
      bkendFetch(`/data/${table}/${id}`, { method: 'DELETE' }),
  },
}
