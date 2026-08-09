import type { ReactNode } from "react";
import { Card } from "./Card.js";
import styles from "./Toast.module.css";

export function Toast({
  tone = "success",
  title,
  onClose,
  children,
}: {
  tone?: "success" | "warning" | "danger";
  title: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <div className={[styles.toast, styles[tone]].join(" ")} role="status">
      <Card>
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        {children && <div className={styles.body}>{children}</div>}
      </Card>
    </div>
  );
}
