const API_ORIGIN = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '')
const API_BASE = `${API_ORIGIN || ''}/api`

export async function apiRequest(path, { token, ...options } = {}) {
  const headers = new Headers(options.headers || {})
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new Error('PitLog API is unreachable. Check that the API is running and can connect to MongoDB Atlas, then try again.')
  }

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : {}
  if (!response.ok) {
    const message = payload.error || (response.status >= 500
      ? 'PitLog API is unavailable. Check the API terminal for its Atlas connection error, then try again.'
      : 'Something went wrong. Please try again.')
    const error = new Error(message)
    error.status = response.status
    throw error
  }
  return payload
}
