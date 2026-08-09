import { KeyGlyph } from "./KeyGlyph.js";
import styles from "./KeyboardShortcutBar.module.css";

export interface ShortcutHint {
  keys: string;
  action: string;
}

export function KeyboardShortcutBar({ shortcuts }: { shortcuts: ShortcutHint[] }) {
  if (shortcuts.length === 0) return null;
  return (
    <div className={styles.bar}>
      {shortcuts.map((s) => (
        <span key={s.keys} className={styles.item}>
          <KeyGlyph keyLabel={s.keys} onLight />
          {s.action}
        </span>
      ))}
    </div>
  );
}
