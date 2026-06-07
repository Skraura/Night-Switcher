import { useRef, useEffect, useState } from 'react'
import styles from './DragonTooltip.module.css'

// Species: FS=Orange, IR=Red, SS=Purple, ASD=Green, BW=Brown, BS=Yellow, BIO=LightBlue
const SPECIES_COLOR = {
  FS:  '#f97316',
  IR:  '#ef4444',
  SS:  '#a855f7',
  ASD: '#22c55e',
  BW:  '#a16207',
  BS:  '#eab308',
  BIO: '#67e8f9',
}

// Growth: Hatchling=gray, Juvenile=blue, Adult=yellow, Elder=red, Bio=lightblue
const GROWTH_COLOR = {
  Hatchling: '#6b7280',
  Juvenile:  '#3b82f6',
  Adult:     '#eab308',
  Elder:     '#ef4444',
  Bio:       '#67e8f9',
}

// Gender: Male=blue, Female=pinkish-red
const GENDER_COLOR = {
  Male:   '#60a5fa',
  Female: '#f472b6',
}

const TICK_COOLDOWN_MS = 6 * 60 * 60 * 1000 // 6 hours

/** Returns true if 6 hours have passed since lastTickTime (or if never ticked) */
function isTickReady(dragonId, tickTimes) {
  const last = tickTimes?.[dragonId]
  if (!last) return true
  return Date.now() - last >= TICK_COOLDOWN_MS
}

/** Only Adults can earn elder ticks */
function canTick(dragon) {
  if (!dragon || dragon.is_dead || dragon.is_egg) return false
  return dragon.growth === 'Adult'
}

export default function DragonTooltip({ dragons, settings, onAction, side, tickTimes = {} }) {
  // Re-render every minute so dot status stays fresh
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  if (!dragons?.length) return null

  return (
    <div
      className={`${styles.panel} ${side === 'left' ? styles.anchorLeft : side === 'right' ? styles.anchorRight : styles.anchorCenter}`}
      onClick={e => e.stopPropagation()}
      onMouseEnter={e => e.stopPropagation()}
    >
      <div className={styles.header}>
        <span>🐉</span>
        <span>Dragons</span>
        <span className={styles.count}>{dragons.length}</span>
      </div>
      <div className={styles.list}>
        {dragons.map((d, i) => {
          const ready = isTickReady(d.dragon_id, tickTimes)
          return (
            <div key={d.dragon_id || i} className={`${styles.row} ${d.is_dead ? styles.dead : ''}`}>
              {/* Primary line: species code + growth */}
              <div className={styles.info}>
                <div className={styles.primaryLine}>
                  <span
                    className={styles.speciesCode}
                    style={{ color: SPECIES_COLOR[d.species] || 'var(--muted)', borderColor: (SPECIES_COLOR[d.species] || 'var(--muted)') + '40' }}
                  >
                    {d.species || '?'}
                  </span>
                  <span
                    className={styles.growthBadge}
                    style={{ color: GROWTH_COLOR[d.growth] || 'var(--muted)', borderColor: (GROWTH_COLOR[d.growth] || 'var(--muted)') + '35' }}
                  >
                    {d.growth || '?'}
                  </span>
                  {d.gender && (
                    <span className={styles.genderDot} style={{ color: GENDER_COLOR[d.gender] || 'var(--hint)' }}>
                      {d.gender === 'Male' ? '♂' : '♀'}
                    </span>
                  )}
                  {d.is_dead   && <span className={styles.statusDead}>☠</span>}
                  {d.is_hungry && <span className={styles.statusHungry}>🍖</span>}
                  {/* Red dot: tick ready, Adults only */}
                  {canTick(d) && ready && (
                    <span className={styles.tickReadyDot} title="Ready for a new tick!" />
                  )}
                </div>
                {/* Secondary line: name */}
                {settings.showName && d.name && (
                  <div className={styles.dragonName}>{d.name}</div>
                )}
              </div>

              {/* Action buttons */}
              {d.dragon_id && !d.is_dead && (
                <div className={styles.actions}>
                  {/* Tick button: Adults only */}
                  {canTick(d) && (
                    <button
                      className={`${styles.btn} ${styles.btnTick} ${ready ? styles.btnTickReady : ''}`}
                      title={ready ? 'Add 1 Tick (ready!)' : 'Add 1 Tick (on cooldown)'}
                      onClick={e => { e.stopPropagation(); onAction(d.dragon_id, 'tick') }}
                    >＋</button>
                  )}
                  <button className={styles.btn} title="Kill (reset to Hatchling)" onClick={e => { e.stopPropagation(); onAction(d.dragon_id, 'kill') }}>⚔</button>
                  <button className={`${styles.btn} ${styles.btnDead}`} title="Mark as Dead" onClick={e => { e.stopPropagation(); onAction(d.dragon_id, 'dead') }}>☠</button>
                  <button
                    className={`${styles.btn} ${d.is_hungry ? styles.btnHungryOn : styles.btnHungry}`}
                    title={d.is_hungry ? 'Mark Not Hungry' : 'Mark Hungry'}
                    onClick={e => { e.stopPropagation(); onAction(d.dragon_id, 'hungry') }}
                  >🍖</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
