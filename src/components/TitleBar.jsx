import styles from './TitleBar.module.css'

export default function TitleBar() {
  return (
    <div className={styles.bar}>
      <div className={styles.drag}>
        <img src="./icon.png" className={styles.logo} alt="" />
        <span className={styles.title}>Night Switcher</span>
        <span className={styles.version}>1.1.0</span>
      </div>
      <div className={styles.controls}>
        <button className={styles.btn} onClick={() => window.api?.window.minimize()} title="Minimize">
          <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1.5" rx="0.75" fill="currentColor"/></svg>
        </button>
        <button className={styles.btn} onClick={() => window.api?.window.maximize()} title="Maximize">
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.75" y="0.75" width="8.5" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
        </button>
        <button className={`${styles.btn} ${styles.close}`} onClick={() => window.api?.window.close()} title="Close">
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>
    </div>
  )
}
