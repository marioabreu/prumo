import { Label } from "./Label.js";
import styles from "./StatRow.module.css";

export function StatRow({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div className={styles.row}>
      <Label>{label}</Label>
      <span className={[styles.value, emphasized ? styles.emphasized : ""].filter(Boolean).join(" ")}>
        {value}
      </span>
    </div>
  );
}
