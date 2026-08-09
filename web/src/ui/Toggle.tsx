import styles from "./Toggle.module.css";

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.label}>
      <input
        type="checkbox"
        className={styles.input}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={[styles.track, checked ? styles.checked : ""].filter(Boolean).join(" ")}>
        <span className={styles.thumb} />
      </span>
      {label}
    </label>
  );
}
