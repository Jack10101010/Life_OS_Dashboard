import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

if (typeof window !== 'undefined') {
  try {
    const raw = window.localStorage.getItem('life-dashboard-state-v1')
    const parsed = raw ? JSON.parse(raw) : null
    const theme = parsed?.settings?.theme === 'light' ? 'light' : 'dark'
    const panelHue = typeof parsed?.settings?.panelHue === 'string' ? parsed.settings.panelHue : 'none'
    const panelHueIntensity = typeof parsed?.settings?.panelHueIntensity === 'number' ? parsed.settings.panelHueIntensity : 100
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.setAttribute('data-panel-hue', panelHue)
    document.documentElement.style.setProperty('--panel-hue-strength', `${Math.max(panelHueIntensity, 0) / 100}`)
  } catch {
    document.documentElement.setAttribute('data-theme', 'dark')
    document.documentElement.setAttribute('data-panel-hue', 'none')
    document.documentElement.style.setProperty('--panel-hue-strength', '1')
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
