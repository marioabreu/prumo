import styles from "./ShortcutButton.module.css";

export function ShortcutButton({
  index,
  label,
  selected = false,
  onClick,
}: {
  index: number;
  label: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[styles.button, selected ? styles.selected : ""].filter(Boolean).join(" ")}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className={styles.index}>{index}</span>
      <span>{label}</span>
    </button>
  );
}
