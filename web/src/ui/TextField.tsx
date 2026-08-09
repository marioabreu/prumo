import { useId, type InputHTMLAttributes } from "react";
import { Label } from "./Label.js";
import styles from "./TextField.module.css";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function TextField({ label, id, className, ...rest }: TextFieldProps) {
  const idGerado = useId();
  const inputId = id ?? idGerado;
  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>
        <Label>{label}</Label>
      </label>
      <input id={inputId} className={[styles.input, className].filter(Boolean).join(" ")} {...rest} />
    </div>
  );
}
