import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const Icon = theme === 'dark' ? Sun : Moon

  return <button
    className="icon-button theme-toggle"
    type="button"
    aria-label={`Switch to ${nextTheme} mode`}
    title={`Switch to ${nextTheme} mode`}
    onClick={toggleTheme}
  >
    <Icon size={17} aria-hidden="true" />
    <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
  </button>
}
