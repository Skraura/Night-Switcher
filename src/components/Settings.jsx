import { useState, useEffect, useCallback } from 'react'
import styles from './Settings.module.css'

function CopyLogButton({ text }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }
  return (
    <button className={styles.logBtn} onClick={handleCopy}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

const THEMES = [
  { id: 'dark',     label: 'Dark',     bg: '#0b0c0f', surface: '#13141a' },
  { id: 'deep',     label: 'Deep',     bg: '#06070b', surface: '#0c0d14' },
  { id: 'slate',    label: 'Slate',    bg: '#0d1119', surface: '#141c28' },
  { id: 'midnight', label: 'Midnight', bg: '#000005', surface: '#080812' },
  { id: 'light',    label: 'Light',    bg: '#f2f3f7', surface: '#ffffff' },
]

const ACCENTS = [
  { id: 'indigo', label: 'Indigo', color: '#5c72f5' },
  { id: 'violet', label: 'Violet', color: '#8b5cf6' },
  { id: 'teal',   label: 'Teal',   color: '#14b8a6' },
  { id: 'rose',   label: 'Rose',   color: '#f43f5e' },
  { id: 'amber',  label: 'Amber',  color: '#f59e0b' },
  { id: 'green',  label: 'Green',  color: '#10b981' },
]

const CARD_SIZES = [
  { id: 'compact',    label: 'Compact'    },
  { id: 'comfortable',label: 'Comfortable'},
  { id: 'spacious',   label: 'Spacious'   },
]

const DRAGON_FIELDS = [
  { key: 'showName',    label: 'Dragon name'    },
  { key: 'showGender',  label: 'Gender'         },
  { key: 'showSpecies', label: 'Species'        },
  { key: 'showGrowth',  label: 'Growth stage'   },
]

export default function Settings({ settings, onSave }) {
  const [logText,     setLogText]     = useState('(loading…)')
  const [logExpanded, setLogExpanded] = useState(false)
  const api = window.api

  const refreshLog = useCallback(async () => {
    const text = await api?.log?.get?.()
    setLogText(text || '(no log yet)')
  }, [api])

  useEffect(() => {
    if (logExpanded) refreshLog()
  }, [logExpanded, refreshLog])

  async function clearLog() {
    await api?.log?.clear?.()
    setLogText('(cleared)')
  }
  return (
    <div className={styles.wrap}>

      {/* Appearance */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Theme</span>
        </div>
        <div className={styles.themeRow}>
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`${styles.themeBtn} ${settings.theme === t.id ? styles.themeBtnActive : ''}`}
              onClick={() => onSave({ theme: t.id })}
              title={t.label}
            >
              <div
                className={styles.themeSwatch}
                style={{ background: t.bg, borderColor: t.bg === '#f2f3f7' ? 'rgba(0,0,0,0.1)' : 'transparent' }}
              >
                <div className={styles.swatchBar} style={{ background: t.surface }} />
                <div className={styles.swatchCard} style={{ background: t.surface === '#ffffff' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)' }} />
                <div className={styles.swatchCard} style={{ background: t.surface === '#ffffff' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)', width: '70%' }} />
              </div>
              <span className={styles.themeLabel}>{t.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Accent color */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Accent color</span>
        </div>
        <div className={styles.accentRow}>
          {ACCENTS.map(a => (
            <button
              key={a.id}
              className={`${styles.accentBtn} ${(settings.accent || 'indigo') === a.id ? styles.accentActive : ''}`}
              onClick={() => onSave({ accent: a.id })}
              title={a.label}
              style={{ '--c': a.color }}
            >
              <div className={styles.accentSwatch} style={{ background: a.color }} />
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Layout */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Card density</span>
        </div>
        <div className={styles.segmented}>
          {CARD_SIZES.map(s => (
            <button
              key={s.id}
              className={`${styles.seg} ${(settings.cardSize || 'comfortable') === s.id ? styles.segActive : ''}`}
              onClick={() => onSave({ cardSize: s.id })}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      {/* Dragon fields */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Dragon details</span>
          <span className={styles.sectionSub}>Shown on hover and in context menus</span>
        </div>
        <div className={styles.toggleList}>
          {DRAGON_FIELDS.map(f => (
            <label key={f.key} className={styles.toggleRow}>
              <span className={styles.toggleLabel}>{f.label}</span>
              <div
                className={`${styles.toggle} ${settings[f.key] ? styles.toggleOn : ''}`}
                onClick={() => onSave({ [f.key]: !settings[f.key] })}
              >
                <div className={styles.toggleThumb} />
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Developer */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Developer</span>
        </div>
        <div className={styles.toggleList}>
          <label className={styles.toggleRow}>
            <div className={styles.toggleLabelGroup}>
              <span className={styles.toggleLabel}>Mock mode</span>
              <span className={styles.toggleSub}>Fake accounts &amp; dragons — no Steam needed</span>
            </div>
            <div
              className={`${styles.toggle} ${settings.mockMode ? styles.toggleOn : ''}`}
              onClick={() => onSave({ mockMode: !settings.mockMode })}
            >
              <div className={styles.toggleThumb} />
            </div>
          </label>
        </div>
      </section>

      {/* Switch log */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Switch log</span>
          <span className={styles.sectionSub}>
            Saved to %APPDATA%\NightSwitcher\switch.log
          </span>
        </div>
        <div className={styles.logActions}>
          <button className={styles.logBtn} onClick={() => { setLogExpanded(v => !v); }}>
            {logExpanded ? 'Hide log' : 'Show log'}
          </button>
          {logExpanded && (
            <button className={styles.logBtn} onClick={refreshLog}>Refresh</button>
          )}
          {logExpanded && (
            <CopyLogButton text={logText} />
          )}
          {logExpanded && (
            <button className={`${styles.logBtn} ${styles.logBtnDanger}`} onClick={clearLog}>Clear</button>
          )}
        </div>
        {logExpanded && (
          <pre className={styles.logBox}>{logText}</pre>
        )}
      </section>

      {/* About */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>About</span>
        </div>
        <div className={styles.aboutCard}>
          <div className={styles.aboutName}>Night Switcher <span className={styles.ver}>v1.1.0</span></div>
          <div className={styles.aboutDesc}>
            Steam account switcher with Night of Dragons integration.
            All data stays local — dragon actions are forwarded to DoD Tracker for Firebase sync.
          </div>
          <div className={styles.aboutMeta}>
            <span className={styles.metaChip}>Electron</span>
            <span className={styles.metaChip}>React 18</span>
            <span className={styles.metaChip}>Windows</span>
          </div>
        </div>
      </section>

    </div>
  )
}
