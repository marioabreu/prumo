import type { ReactNode } from "react";
import { StatusDot, type StatusDotTone } from "./StatusDot.js";
import styles from "./ListRow.module.css";

export function ListRow({
  primary,
  secondary,
  tone,
  active = false,
  onClick,
  trailing,
}: {
  primary: string;
  secondary?: string;
  tone?: StatusDotTone;
  active?: boolean;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  const className = [styles.row, active ? styles.active : ""].filter(Boolean).join(" ");
  const content = (
    <>
      {tone && <StatusDot tone={tone} />}
      <span className={styles.text}>
        <div className={styles.primary}>{primary}</div>
        {secondary && <div className={styles.secondary}>{secondary}</div>}
      </span>
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}
