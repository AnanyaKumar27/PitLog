import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../services/api'

const AuthContext = createContext(null)
const TOKEN_KEY = 'pitlog_token'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))

  useEffect(() => {
    let active = true
    if (!token) {
      setLoading(false)
      return () => { active = false }
    }

    apiRequest('/auth/me', { token })
      .then(({ user: currentUser }) => { if (active) setUser(currentUser) })
      .catch((error) => {
        if (!active) return
        if (error.status === 401) {
          localStorage.removeItem(TOKEN_KEY)
          setToken(null)
          setUser(null)
          setAuthError(error.message)
          return
        }
        setAuthError(`Could not restore your session: ${error.message}`)
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [token])

  const authenticate = useCallback(async (endpoint, body) => {
    const result = await apiRequest(`/auth/${endpoint}`, { method: 'POST', body: JSON.stringify(body) })
    localStorage.setItem(TOKEN_KEY, result.token)
    setAuthError('')
    setToken(result.token)
    setUser(result.user)
    setLoading(false)
    return result.user
  }, [])

  const login = useCallback((email, password) => authenticate('login', { email, password }), [authenticate])
  const signup = useCallback((name, email, password) => authenticate('signup', { name, email, password }), [authenticate])
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
    setAuthError('')
  }, [])

  const value = useMemo(() => ({ user, token, loading, authError, login, signup, logout }), [user, token, loading, authError, login, signup, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
