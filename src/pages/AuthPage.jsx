import { useState } from 'react'
import { ArrowRight, Gauge, ShieldCheck } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Brand from '../components/Brand'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'

function Field({ label, children }) {
  return <label className="form-field"><span>{label}</span>{children}</label>
}

export default function AuthPage({ signup = false }) {
  const { user, authError, login, signup: register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  if (user) return <Navigate to="/" replace />
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await (signup ? register(form.name, form.email, form.password) : login(form.email, form.password))
      navigate('/')
    } catch (cause) {
      setError(cause.message)
    } finally {
      setSubmitting(false)
    }
  }

  return <div className="auth-page">
    <div className="auth-visual"><div className="auth-grid-lines" /><div className="speeding-cars" aria-hidden="true">{['first', 'second', 'third', 'fourth'].map((car) => <img key={car} className={`speeding-car speeding-car-${car}`} src="/racing-car-silhouette.svg" alt="" />)}</div><div className="auth-brand"><Brand /></div><div className="auth-copy"><span className="eyebrow"><i /> ENGINEERING STARTS HERE</span><h1>Better notes.<br /><span>Better laps.</span></h1><p>Your car has a story. Keep every fault, fix, and test session in one place.</p><div className="auth-dial"><div className="dial-ticks" /><Gauge size={60} strokeWidth={1} /><span>DATA / DRIVE / IMPROVE</span></div></div><div className="auth-visual-foot"><span>PITLOG ENGINEERING LOGBOOK</span><span>EST. 2025</span></div></div>
    <div className="auth-side"><div className="auth-side-top"><span>YOUR GARAGE, DIGITIZED.</span><span className="system-status"><i /> SECURE LOGBOOK</span><ThemeToggle /></div><div className="auth-card"><span className="eyebrow">{signup ? 'START YOUR PROGRAM' : 'WELCOME BACK, DRIVER'}</span><h2>{signup ? 'Create your account' : 'Sign in to PitLog'}</h2><p>{signup ? 'Set up your personal engineering logbook.' : 'Your engineering history is waiting.'}</p>
      <form className="auth-form" onSubmit={submit}>{authError && <p className="form-error">{authError}</p>}{signup && <Field label="Your name"><input autoComplete="name" required maxLength="80" name="name" placeholder="Alex Driver" value={form.name} onChange={update} /></Field>}<Field label="Email address"><input autoFocus={!signup} autoComplete="email" required type="email" name="email" placeholder="you@race.team" value={form.email} onChange={update} /></Field><Field label="Password"><input autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 8 : undefined} type="password" name="password" placeholder="At least 8 characters" value={form.password} onChange={update} /></Field>
        {error && <p className="form-error">{error}</p>}<button className="button button-primary auth-submit" disabled={submitting}>{submitting ? 'Please wait...' : signup ? <>Create your account <ArrowRight size={16} /></> : <>Sign in <ArrowRight size={16} /></>}</button></form>
      <div className="auth-switch">{signup ? 'Already have a logbook?' : 'New to PitLog?'} <Link to={signup ? '/login' : '/signup'}>{signup ? 'Sign in' : 'Create an account'} <ArrowRight size={13} /></Link></div>
      <div className="auth-private"><ShieldCheck size={16} /><span>Your engineering records are private to your account.</span></div>
    </div><div className="auth-side-foot"><span>BUILT FOR THE NEXT LAP.</span><span>© PITLOG</span></div></div></div>
}
