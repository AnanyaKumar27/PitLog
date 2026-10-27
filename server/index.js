import 'dotenv/config'
import process from 'node:process'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { MongoClient, ObjectId } from 'mongodb'

const required = ['MONGODB_URI', 'JWT_SECRET']
const missing = required.filter((name) => !process.env[name])
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`)
  process.exit(1)
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters. Generate a random secret and keep it private.')
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI)
const app = express()
const port = Number(process.env.PORT) || 3001

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }))
app.use(express.json({ limit: '32kb' }))
app.use((req, _res, next) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) req.body = {}
  next()
})

let db
const users = () => db.collection('users')
const faults = () => db.collection('faults')
const sessions = () => db.collection('sessions')

const safeUser = (user) => ({ id: user._id.toString(), name: user.name, email: user.email })
const issueToken = (user) => jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' })

function isValidString(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Please sign in to continue.' })
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (typeof payload === 'string' || typeof payload.sub !== 'string' || !ObjectId.isValid(payload.sub)) {
      return res.status(401).json({ error: 'Your session is invalid. Please sign in again.' })
    }
    req.userId = new ObjectId(payload.sub)
    return next()
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
  }
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.post('/api/auth/signup', async (req, res, next) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const password = req.body.password
    if (!isValidString(name, 80) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ error: 'Enter a name, valid email, and password between 8 and 72 characters.' })
    }
    const existing = await users().findOne({ email })
    if (existing) return res.status(409).json({ error: 'An account with that email already exists.' })
    const user = { name, email, passwordHash: await bcrypt.hash(password, 12), createdAt: new Date() }
    const { insertedId } = await users().insertOne(user)
    user._id = insertedId
    return res.status(201).json({ user: safeUser(user), token: issueToken(user) })
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'An account with that email already exists.' })
    return next(error)
  }
})

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const password = req.body.password
    if (!email || typeof password !== 'string') return res.status(400).json({ error: 'Email and password are required.' })
    const user = await users().findOne({ email })
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect.' })
    return res.json({ user: safeUser(user), token: issueToken(user) })
  } catch (error) { return next(error) }
})

app.get('/api/auth/me', requireAuth, async (req, res, next) => {
  try {
    const user = await users().findOne({ _id: req.userId }, { projection: { name: 1, email: 1 } })
    if (!user) return res.status(401).json({ error: 'Account no longer exists.' })
    return res.json({ user: safeUser(user) })
  } catch (error) { return next(error) }
})

const allowedSeverity = ['Low', 'Medium', 'High', 'Critical']
const allowedStatus = ['Open', 'In progress', 'Resolved']
const allowedFaultType = ['Fault', 'Maintenance']

function validateFault(body) {
  if (!isValidString(body.component, 80) || !isValidString(body.description, 1000)) return 'Component and issue description are required.'
  if (!allowedSeverity.includes(body.severity) || !allowedStatus.includes(body.status) || !allowedFaultType.includes(body.type)) return 'Choose a valid type, severity, and status.'
  if (!isValidDate(body.date)) return 'Enter a valid issue date.'
  if (body.repairNotes !== undefined && body.repairNotes !== '' && !isValidString(body.repairNotes, 1000)) return 'Repair notes must be 1,000 characters or fewer.'
  return null
}

app.get('/api/faults', requireAuth, async (req, res, next) => {
  try { return res.json({ faults: await faults().find({ userId: req.userId }).sort({ date: -1, createdAt: -1 }).toArray() }) } catch (error) { return next(error) }
})

app.post('/api/faults', requireAuth, async (req, res, next) => {
  try {
    const validationError = validateFault(req.body)
    if (validationError) return res.status(400).json({ error: validationError })
    const record = {
      userId: req.userId,
      component: req.body.component.trim(),
      description: req.body.description.trim(),
      repairNotes: typeof req.body.repairNotes === 'string' ? req.body.repairNotes.trim() : '',
      type: req.body.type,
      severity: req.body.severity,
      status: req.body.status,
      date: req.body.date,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const { insertedId } = await faults().insertOne(record)
    return res.status(201).json({ fault: { ...record, _id: insertedId } })
  } catch (error) { return next(error) }
})

app.patch('/api/faults/:id', requireAuth, async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid record ID.' })
    const validationError = validateFault(req.body)
    if (validationError) return res.status(400).json({ error: validationError })
    const fields = {
      component: req.body.component.trim(),
      description: req.body.description.trim(),
      repairNotes: typeof req.body.repairNotes === 'string' ? req.body.repairNotes.trim() : '',
      type: req.body.type,
      severity: req.body.severity,
      status: req.body.status,
      date: req.body.date,
      updatedAt: new Date(),
    }
    const result = await faults().findOneAndUpdate(
      { _id: new ObjectId(req.params.id), userId: req.userId },
      { $set: fields },
      { returnDocument: 'after' },
    )
    if (!result) return res.status(404).json({ error: 'Record not found.' })
    return res.json({ fault: result })
  } catch (error) { return next(error) }
})

app.delete('/api/faults/:id', requireAuth, async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid record ID.' })
    const result = await faults().deleteOne({ _id: new ObjectId(req.params.id), userId: req.userId })
    if (!result.deletedCount) return res.status(404).json({ error: 'Record not found.' })
    return res.json({ success: true })
  } catch (error) { return next(error) }
})

const allowedSessionTypes = ['Practice', 'Testing', 'Qualifying', 'Race', 'Shakedown']
function validateSession(body) {
  if (!isValidString(body.track, 100) || !isValidString(body.observations, 1500)) return 'Track and observations are required.'
  if (!allowedSessionTypes.includes(body.type)) return 'Choose a valid session type.'
  if (!isValidDate(body.date)) return 'Enter a valid session date.'
  for (const field of ['weather', 'setupChanges']) {
    if (body[field] !== undefined && body[field] !== '' && !isValidString(body[field], 1000)) return `${field === 'weather' ? 'Track conditions' : 'Setup changes'} must be 1,000 characters or fewer.`
  }
  return null
}

app.get('/api/sessions', requireAuth, async (req, res, next) => {
  try { return res.json({ sessions: await sessions().find({ userId: req.userId }).sort({ date: -1, createdAt: -1 }).toArray() }) } catch (error) { return next(error) }
})

app.post('/api/sessions', requireAuth, async (req, res, next) => {
  try {
    const validationError = validateSession(req.body)
    if (validationError) return res.status(400).json({ error: validationError })
    const record = {
      userId: req.userId,
      date: req.body.date,
      track: req.body.track.trim(),
      type: req.body.type,
      weather: typeof req.body.weather === 'string' ? req.body.weather.trim() : '',
      setupChanges: typeof req.body.setupChanges === 'string' ? req.body.setupChanges.trim() : '',
      observations: req.body.observations.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const { insertedId } = await sessions().insertOne(record)
    return res.status(201).json({ session: { ...record, _id: insertedId } })
  } catch (error) { return next(error) }
})

app.patch('/api/sessions/:id', requireAuth, async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid session ID.' })
    const validationError = validateSession(req.body)
    if (validationError) return res.status(400).json({ error: validationError })
    const fields = {
      date: req.body.date,
      track: req.body.track.trim(),
      type: req.body.type,
      weather: typeof req.body.weather === 'string' ? req.body.weather.trim() : '',
      setupChanges: typeof req.body.setupChanges === 'string' ? req.body.setupChanges.trim() : '',
      observations: req.body.observations.trim(),
      updatedAt: new Date(),
    }
    const result = await sessions().findOneAndUpdate(
      { _id: new ObjectId(req.params.id), userId: req.userId },
      { $set: fields },
      { returnDocument: 'after' },
    )
    if (!result) return res.status(404).json({ error: 'Session not found.' })
    return res.json({ session: result })
  } catch (error) { return next(error) }
})

app.delete('/api/sessions/:id', requireAuth, async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid session ID.' })
    const result = await sessions().deleteOne({ _id: new ObjectId(req.params.id), userId: req.userId })
    if (!result.deletedCount) return res.status(404).json({ error: 'Session not found.' })
    return res.json({ success: true })
  } catch (error) { return next(error) }
})

app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error)
  console.error('API request failed:', error.message)
  return res.status(500).json({ error: 'The server could not complete that request. Check the API logs for details.' })
})

async function start() {
  await client.connect()
  db = client.db(process.env.MONGODB_DB || 'pitlog')
  await users().createIndex({ email: 1 }, { unique: true })
  app.listen(port, () => console.log(`PitLog API ready on http://localhost:${port}`))
}

start().catch(async (error) => {
  console.error('Could not start PitLog API:', error.message)
  await client.close().catch((closeError) => console.error('Could not close MongoDB client:', closeError.message))
  process.exit(1)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await client.close()
    process.exit(0)
  })
}
