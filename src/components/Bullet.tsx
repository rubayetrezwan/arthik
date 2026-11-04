import styles from './Bullet.module.css'

/**
 * One measure's score as a short ink bar laid over the three band zones, like a bullet
 * graph. It only repeats what the text beside it says, so screen readers skip it.
 */
export function Bullet({ score }: { score: number }) {
  return (
    <div className={styles.bullet} aria-hidden="true">
      <span className={styles.vulnerable} />
      <span className={styles.coping} />
      <span className={styles.healthy} />
      <span className={styles.fill} style={{ inlineSize: `${score}%` }} />
    </div>
  )
}
