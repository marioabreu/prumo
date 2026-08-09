import styles from "./StatusDot.module.css";

export type StatusDotTone = "pending" | "confirmed" | "deferred" | "active" | "inactive";

export function StatusDot({ tone }: { tone: StatusDotTone }) {
  return <span className={[styles.dot, styles[tone]].join(" ")} aria-hidden="true" />;
}
