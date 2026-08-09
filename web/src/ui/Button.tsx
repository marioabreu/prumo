import type { ButtonHTMLAttributes } from "react";
import { KeyGlyph } from "./KeyGlyph.js";
import styles from "./Button.module.css";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  shortcut?: string;
}

export function Button({ variant = "secondary", shortcut, children, className, ...rest }: ButtonProps) {
  return (
    <button className={[styles.button, styles[variant], className].filter(Boolean).join(" ")} {...rest}>
      <span>{children}</span>
      {shortcut && <KeyGlyph keyLabel={shortcut} onLight={variant !== "primary"} />}
    </button>
  );
}
