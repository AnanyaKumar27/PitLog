import { lazy, Suspense, useMemo, useState } from 'react'
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  ChevronDown,
  CircleAlert,
  Clock3,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useLogbook } from './context/LogbookContext'
import Brand from './components/Brand'
import ThemeToggle from './components/ThemeToggle'
import { useSearchShortcut } from './hooks/useSearchShortcut'
import { resolveCircuit } from './data/circuits'
import './App.css'

const AuthPage = lazy(() => import('./pages/AuthPage'))

const dateLabel = (value) => value
  ? new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T12:00:00`))
  : '—'

const initials = (name = 'Driver') => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

function getTrackCondition(weather = '') {
  if (typeof weather !== 'string') return null
  const condition = weather.match(/\b(wet|dry)\b/i)?.[1]
  return condition ? condition[0].toUpperCase() + condition.slice(1).toLowerCase() : null
}

function getTyreCompounds(setupChanges = '') {
  if (typeof setupChanges !== 'string') return []
  return ['Soft', 'Hard', 'Medium'].filter((compound) => new RegExp(`\\b${compound}\\b`, 'i').test(setupChanges))
}

function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><span className="loader" />Checking your garage...</div>
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

function AppLayout() {
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const pageName = location.pathname.startsWith('/faults') ? 'Fault & maintenance log'
    : location.pathname.startsWith('/testing') ? 'Testing logbook' : 'Your garage'

  const nav = [
    { to: '/', label: 'Your Garage', icon: LayoutDashboard, end: true },
    { to: '/faults', label: 'Faults & maintenance', icon: Wrench, countKey: 'faults' },
    { to: '/testing', label: 'Track Sessions', icon: Activity },
  ]

  return <div className="app-shell">
    {sidebarOpen && <button className="mobile-backdrop" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-top"><Brand /><button className="icon-button mobile-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}><X size={19} /></button></div>
      <div className="garage-chip"><span className="garage-pulse" /><div><span className="eyebrow">ACTIVE GARAGE</span><strong>My race program</strong></div><ChevronDown size={15} /></div>
      <span className="side-label">WORKSPACE</span>
      <nav className="main-nav">{nav.map(({ to, label, icon: Icon, end }) =>
        <NavLink key={to} to={to} end={end} onClick={() => setSidebarOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'nav-active' : ''}`}>
          <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label.startsWith('Faults') && <span className="nav-count">LOG</span>}
        </NavLink>,
      )}</nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-tip">
        <div className="tip-icon"><ShieldCheck size={18} /></div>
        <strong>Good data, better laps.</strong>
        <p>Every note brings you closer to a more reliable setup.</p>
        <div className="tip-track"><span /></div>
        <small>YOUR NEXT PB STARTS HERE</small>
      </div>
      <div className="sidebar-bottom"><span className="eyebrow">PITLOG VERSION 1.0</span><span className="system-status"><i /> SYSTEM OPERATIONAL</span></div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
        <div className="breadcrumb"><span>WORKSPACE</span><span className="crumb-slash">/</span><strong>{pageName}</strong></div>
        <div className="topbar-right">
          <ThemeToggle />
          <div className="live-indicator"><i /> LIVE LOGBOOK</div>
          <div className="topbar-divider" />
          <div className="user-chip"><span className="avatar">{initials(user.name)}</span><span className="user-name">{user.name}</span></div>
          <button className="icon-button logout-button" title="Sign out" aria-label="Sign out" onClick={logout}><LogOut size={17} /></button>
        </div>
      </header>
      <div className="page-wrap"><Outlet /></div>
    </main>
  </div>
}

function PageTitle({ eyebrow, title, description, actions }) {
  return <div className="page-title-row">
    <div><div className="eyebrow title-eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>
    {actions && <div className="title-actions">{actions}</div>}
  </div>
}

function SeverityBadge({ value }) {
  return <span className={`badge severity-${(value || 'low').toLowerCase()}`}><i />{value || 'Low'}</span>
}

function StatusBadge({ value }) {
  const status = (value || 'open').toLowerCase()
  return <span className={`badge status-${status.replace(/\s+/g, '-')}`}>{status === 'resolved' || status === 'completed' ? <Check size={12} /> : <span className="status-dot" />}{status}</span>
}

function EmptyState({ icon: Icon = Wrench, title, detail, action }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={22} /></span><strong>{title}</strong><p>{detail}</p>{action}</div>
}

function CircuitSchematic({ circuit }) {
  const { route } = circuit
  return <svg className="circuit-svg" viewBox={route.viewBox} role="img" aria-label={`${circuit.name} highlighted circuit route`}>
    <g transform={route.transform}>
      <path id={route.pathId} className="circuit-highlight" d={route.path} />
      <circle className="circuit-runner" r={circuit.id === 'spa-francorchamps' ? 13 : 7}>
        <animateMotion dur="10s" repeatCount="indefinite" rotate="auto">
          <mpath href={`#${route.pathId}`} />
        </animateMotion>
      </circle>
    </g>
  </svg>
}

function Dashboard() {
  const { faults, sessions, loading, error } = useLogbook()
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [componentFilter, setComponentFilter] = useState('All components')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const metrics = useMemo(() => ({
    total: faults.length,
    unresolved: faults.filter((fault) => fault.status !== 'Resolved').length,
    maintenance: faults.filter((fault) => fault.type === 'Maintenance').length,
    tests: sessions.length,
  }), [faults, sessions])
  const recentSessions = useMemo(() => [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4), [sessions])
  const selectedSession = recentSessions.find((session) => session._id === selectedSessionId) || recentSessions[0] || null
  const selectedCircuit = resolveCircuit(selectedSession?.track)
  const componentGroups = useMemo(() => {
    const groups = new Map()
    faults.forEach((fault) => {
      const component = fault.component.trim()
      const key = component.toLocaleLowerCase()
      const group = groups.get(key) || { name: component, records: 0, unresolved: 0, maintenance: 0, severity: 'Low' }
      group.records += 1
      if (fault.status !== 'Resolved') group.unresolved += 1
      if (fault.type === 'Maintenance') group.maintenance += 1
      if (({ Critical: 4, High: 3, Medium: 2, Low: 1 }[fault.severity] || 0) > ({ Critical: 4, High: 3, Medium: 2, Low: 1 }[group.severity] || 0)) group.severity = fault.severity
      groups.set(key, group)
    })
    return [...groups.values()].sort((a, b) => b.unresolved - a.unresolved || b.records - a.records || a.name.localeCompare(b.name))
  }, [faults])
  const filteredComponents = componentGroups.filter((group) => {
    const matchesType = componentFilter === 'All components'
      || (componentFilter === 'Faults' && faults.some((fault) => fault.component.toLocaleLowerCase() === group.name.toLocaleLowerCase() && fault.type === 'Fault'))
      || (componentFilter === 'Maintenance' && group.maintenance > 0)
    const matchesStatus = statusFilter === 'All statuses'
      || (statusFilter === 'Needs attention' && group.unresolved > 0)
      || (statusFilter === 'Resolved' && group.unresolved === 0)
    return matchesType && matchesStatus
  })

  return <>
    <div className="garage-page">
    <PageTitle eyebrow="PERSONAL MOTORSPORT ENGINEERING" title="Your Garage" description="Every fault, repair and track session in one place." actions={<Link className="button button-primary" to="/faults?new=1"><Plus size={16} /> Add data</Link>} />
    {error && <div className="inline-error">{error}</div>}
    <div className="garage-layout">
      <div className="garage-overview-column">
        <section className="vehicle-card">
          <div className="garage-section-heading"><div><span className="panel-kicker">GARAGE PROFILE</span><h2>Test vehicle</h2></div><span className="profile-tag">REFERENCE IMAGE</span></div>
          <div className="vehicle-photo-wrap"><img className="vehicle-photo" src="/garage-car.jpg" alt="Illustrative performance car in a dark garage; not a record of the user's specific vehicle" /><span className="photo-caption">ILLUSTRATIVE PHOTO</span></div>
          <div className="vehicle-identity"><strong>Vehicle details not set</strong><span>Use your logbook records to build this profile.</span></div>
          <div className="vehicle-metrics">
            <div><span>FAULT RECORDS</span><strong>{loading ? '—' : metrics.total}</strong></div>
            <div><span>OPEN ITEMS</span><strong className={metrics.unresolved ? 'metric-warning' : ''}>{loading ? '—' : metrics.unresolved}</strong></div>
            <div><span>MAINTENANCE</span><strong>{loading ? '—' : metrics.maintenance}</strong></div>
            <div><span>TEST SESSIONS</span><strong>{loading ? '—' : metrics.tests}</strong></div>
          </div>
          <Link className="profile-action" to="/faults"><Wrench size={14} /> Open fault & maintenance log <ChevronRight size={14} /></Link>
        </section>

        <section className="session-map-card">
          <div className="garage-section-heading"><div><span className="panel-kicker">TRACK REFERENCE · NOT LIVE DATA</span><h2>{selectedSession?.track || 'Track session'}</h2></div><Link className="panel-link" to="/testing">SESSION LOG <ArrowRight size={13} /></Link></div>
          {recentSessions.length ? <>
            <div className="session-selector" aria-label="Select a session to view its circuit">
              {recentSessions.map((session) => <button type="button" key={session._id} className={`session-select ${selectedSession?._id === session._id ? 'session-select-active' : ''}`} aria-label={`Show ${session.track} map`} aria-pressed={selectedSession?._id === session._id} onClick={() => setSelectedSessionId(session._id)}>{session.track}<small>{dateLabel(session.date)}</small></button>)}
            </div>
            <div className={`circuit-canvas ${selectedCircuit ? '' : 'circuit-canvas-unavailable'}`}>
              {selectedCircuit
                ? <><img className={`circuit-map circuit-map-${selectedCircuit.id}`} src={selectedCircuit.image} alt={selectedCircuit.imageAlt} /><CircuitSchematic circuit={selectedCircuit} /><span className="map-note">{selectedCircuit.id === 'yas-marina' ? 'HIGHLIGHTED SEGMENT' : 'CIRCUIT ROUTE'}</span></>
                : <div className="map-unavailable"><Gauge size={20} /><strong>No verified map for this venue</strong><span>“{selectedSession?.track}” stays selected; another circuit is not substituted.</span></div>}
            </div>
            <div className="session-map-meta"><span>{selectedSession?.type || 'Session'} · {dateLabel(selectedSession?.date)}</span><span>{selectedSession?.weather || 'Conditions not noted'}</span></div>
            {selectedCircuit && <a className="map-attribution" href={selectedCircuit.attribution.href} target="_blank" rel="noreferrer">Map: {selectedCircuit.attribution.label}</a>}
          </> : <EmptyState icon={Gauge} title="No sessions logged" detail="Add a test session to see its track reference here." action={<Link className="button button-secondary button-small" to="/testing?new=1"><Plus size={14} /> Add session</Link>} />}
        </section>
      </div>

      <section className="component-panel">
        <div className="component-panel-heading"><div><span className="panel-kicker">ENGINEERING RECORDS</span><h2>Component log</h2><p>Components shown here come from your saved fault and maintenance records.</p></div><Link className="button button-secondary button-small" to="/faults?new=1"><Plus size={14} /> Add data</Link></div>
        <div className="component-filters">
          <label><span className="sr-only">Filter component record type</span><select value={componentFilter} onChange={(event) => setComponentFilter(event.target.value)}><option>All components</option><option>Faults</option><option>Maintenance</option></select><ChevronDown size={13} /></label>
          <label><span className="sr-only">Filter component status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option><option>Needs attention</option><option>Resolved</option></select><ChevronDown size={13} /></label>
          <span className="component-total">{loading ? '—' : `${filteredComponents.length} COMPONENT${filteredComponents.length === 1 ? '' : 'S'}`}</span>
        </div>
        {filteredComponents.length ? <div className="component-list">{filteredComponents.map((group) =>
          <Link className="component-row" to="/faults" key={group.name}>
            <span className={`component-status-dot ${group.unresolved ? 'component-status-open' : 'component-status-clear'}`} />
            <span className="component-row-main"><strong>{group.name}</strong><small>{group.records} record{group.records === 1 ? '' : 's'}{group.maintenance ? ` · ${group.maintenance} maintenance` : ''}</small></span>
            <span className="component-row-state">{group.unresolved ? <><i className={`severity-edge-${group.severity.toLowerCase()}`} />{group.unresolved} open</> : 'Up to date'}</span>
            <ChevronRight size={16} />
          </Link>,
        )}</div> : <div className="component-empty"><div className="component-empty-mark"><Wrench size={18} /></div><strong>{componentGroups.length ? 'No components match these filters' : 'No component records yet'}</strong><p>{componentGroups.length ? 'Change the filters to see more entries.' : 'Log a fault or maintenance record and its component will appear here.'}</p>{!componentGroups.length && <Link className="button button-primary button-small" to="/faults?new=1"><Plus size={13} /> Log first record</Link>}</div>}
        <div className="component-panel-foot"><span>FAULTS & MAINTENANCE · ACCOUNT RECORDS</span><Link to="/faults">View full log <ArrowRight size={13} /></Link></div>
      </section>
    </div>
    <div className="garage-footer"><span>PITLOG ENGINEERING LOGBOOK</span><span>VEHICLE DATA FROM YOUR RECORDS · REFERENCE IMAGE ONLY</span></div>
    </div>
  </>
}

function Modal({ title, eyebrow, onClose, children }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-heading"><div><span className="eyebrow">{eyebrow}</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>
      {children}
    </section>
  </div>
}

function Field({ label, children, className = '' }) {
  return <label className={`form-field ${className}`}><span>{label}</span>{children}</label>
}

function FaultForm({ item, onSave, onClose }) {
  const [form, setForm] = useState({ component: item?.component || '', type: item?.type || 'Fault', severity: item?.severity || 'Medium', status: item?.status || 'Open', description: item?.description || '', repairNotes: item?.repairNotes || '', date: item?.date?.slice(0, 10) || new Date().toISOString().slice(0, 10) })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  const submit = async (event) => {
    event.preventDefault()
    setSaving(true); setError('')
    try { await onSave(form); onClose() } catch (err) { setError(err.message) } finally { setSaving(false) }
  }
  return <Modal eyebrow={item ? 'UPDATE LOG ENTRY' : 'NEW LOG ENTRY'} title={item ? 'Edit record' : 'Log an issue'} onClose={onClose}>
    <form className="modal-form" onSubmit={submit}>
      <div className="form-grid">
        <Field label="Component"><input autoFocus required maxLength="80" name="component" placeholder="e.g. Front-left brake" value={form.component} onChange={update} /></Field>
        <Field label="Record type"><select name="type" value={form.type} onChange={update}><option>Fault</option><option>Maintenance</option></select></Field>
        <Field label="Severity"><select name="severity" value={form.severity} onChange={update}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></Field>
        <Field label="Status"><select name="status" value={form.status} onChange={update}><option>Open</option><option>In progress</option><option>Resolved</option></select></Field>
        <Field label="Date reported"><input required type="date" name="date" value={form.date} onChange={update} /></Field>
        <Field label="Issue description" className="field-full"><textarea required maxLength="1000" rows="3" name="description" placeholder="What did you notice? Include when it happens." value={form.description} onChange={update} /></Field>
        <Field label="Repair notes" className="field-full"><textarea maxLength="1000" rows="2" name="repairNotes" placeholder="Diagnosis, parts replaced, or next steps..." value={form.repairNotes} onChange={update} /></Field>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Saving...' : <><Check size={15} /> Save record</>}</button></div>
    </form>
  </Modal>
}

function FaultsPage() {
  const { faults, loading, createFault, updateFault, deleteFault, error } = useLogbook()
  const [query, setQuery] = useState('')
  const [severity, setSeverity] = useState('All severities')
  const [status, setStatus] = useState('All statuses')
  const [editing, setEditing] = useState(null)
  const searchRef = useSearchShortcut()
  const location = useLocation()
  const navigate = useNavigate()
  const isNew = new URLSearchParams(location.search).has('new')

  const visible = useMemo(() => faults.filter((fault) => {
    const text = `${fault.component} ${fault.description} ${fault.repairNotes || ''}`.toLowerCase()
    return text.includes(query.toLowerCase()) && (severity === 'All severities' || fault.severity === severity) && (status === 'All statuses' || fault.status === status)
  }).sort((a, b) => b.date.localeCompare(a.date)), [faults, query, severity, status])
  const closeNew = () => navigate('/faults', { replace: true })
  const save = async (data) => editing?._id ? updateFault(editing._id, data) : createFault(data)

  return <>
    <PageTitle eyebrow="ENGINEERING RECORDS" title="Faults & maintenance" description="Capture the details. Close the loop. Keep the car moving." actions={<button className="button button-primary" onClick={() => setEditing({})}><Plus size={16} /> New record</button>} />
    <div className="log-summary-strip"><div className="summary-unit"><span className="summary-mark mark-orange" /><span>OPEN ISSUES</span><strong>{faults.filter((fault) => fault.status !== 'Resolved').length.toString().padStart(2, '0')}</strong></div><div className="summary-divider" /><div className="summary-unit"><span className="summary-mark mark-lime" /><span>RESOLVED</span><strong>{faults.filter((fault) => fault.status === 'Resolved').length.toString().padStart(2, '0')}</strong></div><div className="summary-divider" /><div className="summary-unit"><span className="summary-mark mark-blue" /><span>MAINTENANCE</span><strong>{faults.filter((fault) => fault.type === 'Maintenance').length.toString().padStart(2, '0')}</strong></div><div className="summary-aside"><SlidersHorizontal size={15} /> YOUR ENGINEERING HISTORY</div></div>
    <section className="panel table-panel">
      <div className="table-toolbar"><div><h2>Issue register</h2><span>{visible.length} {visible.length === 1 ? 'record' : 'records'}</span></div>
        <div className="filter-controls"><label className="search-box"><Search size={16} /><input ref={searchRef} aria-keyshortcuts="Control+K Meta+K" placeholder="Search records..." aria-label="Search records" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button aria-label="Clear search" onClick={() => setQuery('')}><X size={13} /></button>}</label>
          <select aria-label="Filter by severity" value={severity} onChange={(event) => setSeverity(event.target.value)}><option>All severities</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select>
          <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}><option>All statuses</option><option>Open</option><option>In progress</option><option>Resolved</option></select>
        </div>
      </div>
      {error && <div className="inline-error">{error}</div>}
      <div className="table-scroll"><table className="records-table"><thead><tr><th>COMPONENT / ISSUE</th><th>TYPE</th><th>SEVERITY</th><th>STATUS</th><th>DATE</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
        {visible.map((fault) => <tr key={fault._id}><td><div className="component-cell"><span className="component-icon">{fault.type === 'Maintenance' ? <Settings2 size={16} /> : <CircleAlert size={16} />}</span><div><strong>{fault.component}</strong><span>{fault.description}</span>{fault.repairNotes && <small>NOTE · {fault.repairNotes}</small>}</div></div></td><td><span className={`type-label ${fault.type === 'Maintenance' ? 'type-maintenance' : ''}`}>{fault.type}</span></td><td><SeverityBadge value={fault.severity} /></td><td><button className="status-button" title="Click to update status" onClick={() => updateFault(fault._id, { ...fault, status: fault.status === 'Open' ? 'In progress' : fault.status === 'In progress' ? 'Resolved' : 'Open' }).catch(() => undefined)}><StatusBadge value={fault.status} /><ChevronDown size={12} /></button></td><td className="date-cell">{dateLabel(fault.date)}</td><td><div className="row-actions"><button aria-label={`Edit ${fault.component}`} title="Edit record" onClick={() => setEditing(fault)}><Settings2 size={15} /></button><button aria-label={`Delete ${fault.component}`} title="Delete record" onClick={() => { if (window.confirm(`Delete the record for ${fault.component}? This cannot be undone.`)) deleteFault(fault._id).catch(() => undefined) }}><Trash2 size={15} /></button></div></td></tr>)}
      </tbody></table></div>
      {!visible.length && <EmptyState icon={loading ? Clock3 : Wrench} title={loading ? 'Loading your records...' : 'No records found'} detail={loading ? 'Connecting to your engineering logbook.' : faults.length ? 'Try adjusting your search or filters.' : 'Add your first fault or maintenance record to get started.'} action={!loading && !faults.length && <button className="button button-secondary button-small" onClick={() => setEditing({})}><Plus size={14} /> Create first record</button>} />}
      <div className="table-foot"><span>Showing <strong>{visible.length}</strong> of <strong>{faults.length}</strong> records</span><span>PRIVATE TO YOUR GARAGE <ShieldCheck size={13} /></span></div>
    </section>
    <div className="footer-note"><span>RECORD IT. RESOLVE IT. RACE ON.</span><span>FAULT & MAINTENANCE LOG</span></div>
    {(isNew || editing) && <FaultForm item={editing?._id ? editing : null} onSave={save} onClose={() => { setEditing(null); if (isNew) closeNew() }} />}
  </>
}

function SessionForm({ item, onSave, onClose }) {
  const [form, setForm] = useState({ date: item?.date?.slice(0, 10) || new Date().toISOString().slice(0, 10), track: item?.track || '', type: item?.type || 'Practice', weather: item?.weather || '', setupChanges: item?.setupChanges || '', observations: item?.observations || '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  const submit = async (event) => { event.preventDefault(); setSaving(true); setError(''); try { await onSave(form); onClose() } catch (err) { setError(err.message) } finally { setSaving(false) } }
  return <Modal eyebrow={item ? 'UPDATE SESSION' : 'NEW TRACK ENTRY'} title={item ? 'Edit session' : 'Log test session'} onClose={onClose}>
    <form className="modal-form" onSubmit={submit}><div className="form-grid">
      <Field label="Session date"><input autoFocus required type="date" name="date" value={form.date} onChange={update} /></Field>
      <Field label="Track / circuit"><input required maxLength="100" name="track" placeholder="e.g. Whilton Mill" value={form.track} onChange={update} /></Field>
      <Field label="Session type"><select name="type" value={form.type} onChange={update}><option>Practice</option><option>Testing</option><option>Qualifying</option><option>Race</option><option>Shakedown</option></select></Field>
      <Field label="Track conditions"><input maxLength="80" name="weather" placeholder="e.g. Dry, 18°C" value={form.weather} onChange={update} /></Field>
      <Field label="Setup changes" className="field-full"><textarea rows="2" maxLength="1000" name="setupChanges" placeholder="Tyre pressures, gearing, alignment..." value={form.setupChanges} onChange={update} /></Field>
      <Field label="Observations" className="field-full"><textarea required rows="3" maxLength="1500" name="observations" placeholder="What did the car feel like? What would you change next?" value={form.observations} onChange={update} /></Field>
    </div>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Saving...' : <><Check size={15} /> Save session</>}</button></div></form>
  </Modal>
}

function TestingPage() {
  const { sessions, loading, createSession, updateSession, deleteSession, error } = useLogbook()
  const [editing, setEditing] = useState(null)
  const [query, setQuery] = useState('')
  const searchRef = useSearchShortcut()
  const location = useLocation()
  const navigate = useNavigate()
  const isNew = new URLSearchParams(location.search).has('new')
  const visible = useMemo(() => [...sessions].filter((session) => `${session.track} ${session.type} ${session.observations}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date)), [sessions, query])
  const save = async (data) => editing?._id ? updateSession(editing._id, data) : createSession(data)
  const close = () => { setEditing(null); if (isNew) navigate('/testing', { replace: true }) }

  return <>
    <PageTitle eyebrow="ON-TRACK NOTES" title="Testing logbook" description="Capture what changed, what worked, and what comes next." actions={<button className="button button-primary" onClick={() => setEditing({})}><Plus size={16} /> Log a session</button>} />
    <div className="testing-banner"><div className="testing-banner-icon"><Activity size={21} /></div><div><span className="eyebrow">DATA MAKES THE DIFFERENCE</span><strong>Test with intent. Leave with answers.</strong><p>Log your setup, conditions, and observations after every session.</p></div><div className="banner-stats"><span>SESSIONS LOGGED</span><strong>{String(sessions.length).padStart(2, '0')}</strong></div><img className="testing-art" src="/track-illustration.svg" alt="" aria-hidden="true" /></div>
    <section className="panel testing-panel">
      <div className="table-toolbar"><div><h2>Session history</h2><span>Sorted newest first</span></div><label className="search-box"><Search size={16} /><input ref={searchRef} aria-keyshortcuts="Control+K Meta+K" placeholder="Search track or notes..." aria-label="Search sessions" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
      {error && <div className="inline-error">{error}</div>}
      {visible.length ? <div className="testing-list">{visible.map((session) => <article className="test-card" key={session._id}>
        <div className="test-date"><span>{new Date(`${session.date.slice(0, 10)}T12:00:00`).toLocaleDateString('en', { month: 'short' }).toUpperCase()}</span><strong>{new Date(`${session.date.slice(0, 10)}T12:00:00`).getDate().toString().padStart(2, '0')}</strong><small>{new Date(`${session.date.slice(0, 10)}T12:00:00`).getFullYear()}</small></div>
        <div className="test-content">        <div className="test-title-row"><div><span className="test-type"><span />{session.type}</span><h3>{session.track}</h3></div><div className="test-actions"><button title="Edit session" aria-label={`Edit ${session.track} session`} onClick={() => setEditing(session)}><Settings2 size={15} /></button><button title="Delete session" aria-label={`Delete ${session.track} session`} onClick={() => { if (window.confirm(`Delete this session at ${session.track}? This cannot be undone.`)) deleteSession(session._id).catch(() => undefined) }}><Trash2 size={15} /></button></div></div>
          <div className="test-meta"><span><CalendarDays size={13} />{dateLabel(session.date)}</span><span className={getTrackCondition(session.weather) ? `track-condition condition-${getTrackCondition(session.weather).toLowerCase()}` : ''}><Activity size={13} />{session.weather || 'Conditions not logged'}</span>{getTyreCompounds(session.setupChanges).map((compound) => <span className={`tyre-compound tyre-${compound.toLowerCase()}`} key={compound}>{compound} tyre</span>)}</div>
          {session.setupChanges && <div className="test-notes"><span className="note-label"><Settings2 size={13} /> SETUP</span><p>{session.setupChanges}</p></div>}
          <div className="test-notes"><span className="note-label"><Gauge size={13} /> OBSERVATIONS</span><p>{session.observations}</p></div>
        </div>
      </article>)}</div> : <EmptyState icon={Gauge} title={loading ? 'Loading your sessions...' : 'No sessions found'} detail={loading ? 'Fetching your test history.' : sessions.length ? 'Try a different search term.' : 'Your first entry is the start of a useful testing history.'} action={!loading && !sessions.length && <button className="button button-secondary button-small" onClick={() => setEditing({})}><Plus size={14} /> Log first session</button>} />}
    </section>
    <div className="footer-note"><span>THE DATA BEHIND THE LAP TIME.</span><span>TESTING LOGBOOK</span></div>
    {(isNew || editing) && <SessionForm item={editing?._id ? editing : null} onSave={save} onClose={close} />}
  </>
}

function App() {
  return <Routes>
    <Route path="/login" element={<Suspense fallback={<div className="loading-screen">Loading sign-in...</div>}><AuthPage /></Suspense>} />
    <Route path="/signup" element={<Suspense fallback={<div className="loading-screen">Loading sign-up...</div>}><AuthPage signup /></Suspense>} />
    <Route element={<ProtectedRoute />}><Route element={<AppLayout />}>
      <Route index element={<Dashboard />} />
      <Route path="faults" element={<FaultsPage />} />
      <Route path="testing" element={<TestingPage />} />
    </Route></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}

export default App
