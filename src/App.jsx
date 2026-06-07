import { useState, useEffect } from 'react'
import TitleBar from './components/TitleBar'
import UpdateBanner from './components/UpdateBanner'
import Accounts from './components/Accounts'
import Settings from './components/Settings'
import { mockApi } from './mockData'
import styles from './App.module.css'

const DEFAULT_SETTINGS = {
  theme: 'dark',
  accent: 'indigo',
  cardSize: 'comfortable',
  viewMode: 'grid',
  showName: true,
  showGender: true,
  showSpecies: true,
  showGrowth: true,
  mockMode: false,
}

// Resolve the active API — real or mock
function getApi(isMock) {
  return isMock ? mockApi : window.api
}

export default function App() {
  const [tab,      setTab]      = useState('accounts')
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [apiReady, setApiReady] = useState(false)

  useEffect(() => {
    // Try loading real settings first; fall back gracefully if no api
    const load = window.api?.settings.load() || Promise.resolve({})
    load.then(s => {
      if (s && Object.keys(s).length > 0) {
        const merged = { ...DEFAULT_SETTINGS, ...s }
        setSettings(merged)
        applyTheme(merged)
      }
      setApiReady(true)
    })
  }, [])

  function applyTheme(s) {
    const root = document.documentElement
    root.setAttribute('data-theme', s.theme || 'dark')
    if (s.accent && s.accent !== 'indigo') {
      root.setAttribute('data-accent', s.accent)
    } else {
      root.removeAttribute('data-accent')
    }
  }

  function saveSettings(patch) {
    const next = { ...settings, ...patch }
    setSettings(next)
    applyTheme(next)
    // Always save to real settings if available (persists mock mode preference too)
    window.api?.settings.save(next)
  }

  if (!apiReady) return null

  const isMock = !!settings.mockMode
  const api    = getApi(isMock)

  return (
    <div className={styles.app}>
      <TitleBar />
      <UpdateBanner />
      {isMock && (
        <div className={styles.mockBanner}>
          <span className={styles.mockDot} />
          Mock mode — fake accounts &amp; dragons
        </div>
      )}
      <div className={styles.layout}>
        <nav className={styles.sidebar}>
          <button
            className={`${styles.navBtn} ${tab === 'accounts' ? styles.navActive : ''}`}
            onClick={() => setTab('accounts')}
            title="Accounts"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="7" r="4"/>
              <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              <path d="M21 21v-2a4 4 0 0 0-3-3.85"/>
            </svg>
            <span className={styles.navLabel}>Accounts</span>
          </button>
          <button
            className={`${styles.navBtn} ${tab === 'settings' ? styles.navActive : ''}`}
            onClick={() => setTab('settings')}
            title="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14M12 2v2M12 20v2M2 12h2M20 12h2"/>
            </svg>
            <span className={styles.navLabel}>Settings</span>
          </button>
        </nav>

        <main className={styles.main}>
          {tab === 'accounts' && (
            <Accounts settings={settings} onSettingChange={saveSettings} api={api} />
          )}
          {tab === 'settings' && (
            <Settings settings={settings} onSave={saveSettings} />
          )}
        </main>
      </div>
    </div>
  )
}
