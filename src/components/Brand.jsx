import { Gauge } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Brand() {
  return <Link className="brand" to="/">
    <span className="brand-mark"><Gauge size={19} strokeWidth={2.2} /></span>
    <span className="brand-word">pit<span>log</span><small>ENGINEERING LOGBOOK</small></span>
  </Link>
}
