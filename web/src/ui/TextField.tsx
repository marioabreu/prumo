import type { InputHTMLAttributes } from "react";
import { Label } from "./Label.js";
import styles from "./TextField.module.css";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function TextField({ label, id, className, ...rest }: TextFieldProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>
        <Label>{label}</Label>
      </label>
      <input id={inputId} className={[styles.input, className].filter(Boolean).join(" ")} {...rest} />
    </div>
  );
}
