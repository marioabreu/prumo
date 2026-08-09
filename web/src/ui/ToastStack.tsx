import type { ReactNode } from "react";
import styles from "./ToastStack.module.css";

export function ToastStack({ children }: { children: ReactNode }) {
  return <div className={styles.stack}>{children}</div>;
}
