const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

function defaultJsonHeaders() {
  return { 'Content-Type': 'application/json' }
}

async function request(path, { method = 'GET', body = null, headers = {}, credentials = 'include', json = true } = {}) {
  const url = path.startsWith('/') ? `${API}${path}` : `${API}/${path}`
  const h = { ...(json ? defaultJsonHeaders() : {}), ...headers }

  const opts = { method, headers: h, credentials }
  if (body !== null && body !== undefined) {
    opts.body = json && typeof body !== 'string' ? JSON.stringify(body) : body
  }

  const res = await fetch(url, opts)

  const contentType = res.headers.get('content-type') || ''
  let data
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null)
  } else {
    data = await res.text().catch(() => null)
  }

  if (!res.ok) {
    const message = (data && (data.message || data.error)) || data || res.statusText || 'Request failed'
    const err = new Error(message)
    err.status = res.status
    err.body = data
    throw err
  }

  return data
}

export const apiClient = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, opts) => request(path, { ...opts, method: 'POST' }),
  put: (path, opts) => request(path, { ...opts, method: 'PUT' }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' })
}

export default apiClient
