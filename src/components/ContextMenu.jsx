import { useRef, useEffect, useState } from 'react'
import styles from './ContextMenu.module.css'

export default function ContextMenu({ x, y, account, isActive, onSwitch, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ x, y })

  useEffect(() => {
    if (!ref.current) return
    const rect   = ref.current.getBoundingClientRect()
    const parent = ref.current.parentElement?.getBoundingClientRect() || { width: window.innerWidth, height: window.innerHeight }
    let nx = x, ny = y
    if (x + rect.width  > parent.width)  nx = parent.width  - rect.width  - 6
    if (y + rect.height > parent.height) ny = parent.height - rect.height - 6
    if (nx !== x || ny !== y) setPos({ x: nx, y: ny })
  }, [x, y])

  return (
    <div
      ref={ref}
      className={styles.menu}
      style={{ left: pos.x, top: pos.y }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <span className={styles.headerName}>{account.name}</span>
          {account.accountName && account.accountName !== account.name && (
            <span className={styles.headerSub}>@{account.accountName}</span>
          )}
        </div>
        {isActive && <span className={styles.activePill}>Active</span>}
      </div>

      <div className={styles.divider} />

      {/* Switch action */}
      {!isActive ? (
        <button className={styles.item} onClick={() => { onSwitch(); onClose() }}>
          <span className={styles.itemIcon}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </span>
          Switch to this account
        </button>
      ) : (
        <div className={`${styles.item} ${styles.itemDisabled}`}>
          <span className={styles.itemIcon}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </span>
          Currently active
        </div>
      )}
    </div>
  )
}
