import { useState, useEffect } from 'react'
import styles from './UpdateBanner.module.css'

export default function UpdateBanner() {
  const [state, setState] = useState('idle') // idle | available | downloading | ready | error
  const [version, setVersion]   = useState('')
  const [percent, setPercent]   = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!window.api?.updater) return

    const offAvail = window.api.updater.onAvailable(({ version: v }) => {
      setVersion(v)
      setState('available')
      setDismissed(false)
    })
    const offProg = window.api.updater.onProgress(({ percent: p }) => {
      setState('downloading')
      setPercent(p)
    })
    const offDone = window.api.updater.onDownloaded(({ version: v }) => {
      setVersion(v)
      setState('ready')
    })
    const offErr = window.api.updater.onError(() => {
      setState('error')
    })

    return () => { offAvail?.(); offProg?.(); offDone?.(); offErr?.() }
  }, [])

  if (state === 'idle' || dismissed) return null

  return (
    <div className={`${styles.banner} ${styles[state]}`}>
      <span className={styles.icon}>
        {state === 'available'   && '🔔'}
        {state === 'downloading' && '⬇'}
        {state === 'ready'       && '✅'}
        {state === 'error'       && '⚠'}
      </span>

      <span className={styles.text}>
        {state === 'available'   && <>Update <b>v{version}</b> available — downloading…</>}
        {state === 'downloading' && <>Downloading update… <b>{percent}%</b></>}
        {state === 'ready'       && <>Update <b>v{version}</b> ready — restart to install</>}
        {state === 'error'       && <>Update check failed</>}
      </span>

      {state === 'downloading' && (
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${percent}%` }} />
        </div>
      )}

      {state === 'ready' && (
        <button className={styles.installBtn} onClick={() => window.api.updater.install()}>
          Restart &amp; Install
        </button>
      )}

      <button
        className={styles.dismiss}
        title="Dismiss"
        onClick={() => setDismissed(true)}
      >✕</button>
    </div>
  )
}
