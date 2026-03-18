import { useEffect, useState } from 'react'
import { SettingsState } from '../types'

export function useSettingsState(initialSettings: SettingsState) {
  const [settings, setSettings] = useState(initialSettings)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
    document.documentElement.setAttribute('data-panel-hue', settings.panelHue)
    document.documentElement.style.setProperty('--panel-hue-strength', `${Math.max(settings.panelHueIntensity, 0) / 100}`)
  }, [settings.theme, settings.panelHue, settings.panelHueIntensity])

  const hydrate = (next: SettingsState) => {
    setSettings(next)
  }

  return {
    settings,
    setSettings,
    hydrate,
  }
}
