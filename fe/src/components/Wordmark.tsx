import styles from "./wordmark.module.css";

export function Wordmark() {
  return (
    <span className={styles.wordmark}>
      Voca
      <span className={styles.seal} aria-hidden="true" />
    </span>
  );
}
