import type { ReactNode } from "react";
import styles from "./Label.module.css";

export function Label({ children }: { children: ReactNode }) {
  return <span className={styles.label}>{children}</span>;
}
