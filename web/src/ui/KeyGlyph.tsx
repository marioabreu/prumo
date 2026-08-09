import styles from "./KeyGlyph.module.css";

export function KeyGlyph({ keyLabel, onLight = false }: { keyLabel: string; onLight?: boolean }) {
  return <kbd className={[styles.glyph, onLight ? styles.onLight : ""].filter(Boolean).join(" ")}>{keyLabel}</kbd>;
}
