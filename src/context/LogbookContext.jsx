import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../services/api'
import { useAuth } from './AuthContext'

const LogbookContext = createContext(null)

export function LogbookProvider({ children }) {
  const { token } = useAuth()
  const [faults, setFaults] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!token) {
      setFaults([])
      setSessions([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [faultData, sessionData] = await Promise.all([
        apiRequest('/faults', { token }),
        apiRequest('/sessions', { token }),
      ])
      setFaults(faultData.faults)
      setSessions(sessionData.sessions)
    } catch (cause) {
      setError(cause.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { refresh() }, [refresh])

  const changeRecord = useCallback(async (resource, id, method, data) => {
    setError('')
    let result
    try {
      result = await apiRequest(`/${resource}${id ? `/${id}` : ''}`, {
        token,
        method,
        ...(data ? { body: JSON.stringify(data) } : {}),
      })
    } catch (cause) {
      setError(cause.message)
      throw cause
    }
    if (resource === 'faults') {
      setFaults((current) => method === 'POST'
        ? [result.fault, ...current]
        : method === 'DELETE' ? current.filter((item) => item._id !== id) : current.map((item) => item._id === id ? result.fault : item))
    } else {
      setSessions((current) => method === 'POST'
        ? [result.session, ...current]
        : method === 'DELETE' ? current.filter((item) => item._id !== id) : current.map((item) => item._id === id ? result.session : item))
    }
    return result
  }, [token])

  const createFault = useCallback((data) => changeRecord('faults', null, 'POST', data), [changeRecord])
  const updateFault = useCallback((id, data) => changeRecord('faults', id, 'PATCH', data), [changeRecord])
  const deleteFault = useCallback((id) => changeRecord('faults', id, 'DELETE'), [changeRecord])
  const createSession = useCallback((data) => changeRecord('sessions', null, 'POST', data), [changeRecord])
  const updateSession = useCallback((id, data) => changeRecord('sessions', id, 'PATCH', data), [changeRecord])
  const deleteSession = useCallback((id) => changeRecord('sessions', id, 'DELETE'), [changeRecord])

  const value = useMemo(() => ({
    faults, sessions, loading, error, refresh,
    createFault, updateFault, deleteFault,
    createSession, updateSession, deleteSession,
  }), [faults, sessions, loading, error, refresh, createFault, updateFault, deleteFault, createSession, updateSession, deleteSession])
  return <LogbookContext.Provider value={value}>{children}</LogbookContext.Provider>
}

export function useLogbook() {
  const context = useContext(LogbookContext)
  if (!context) throw new Error('useLogbook must be used within LogbookProvider')
  return context
}
