import type { ReactNode } from "react";
import styles from "./Card.module.css";

export function Card({
  padding = "md",
  children,
  className,
}: {
  padding?: "sm" | "md" | "lg";
  children: ReactNode;
  className?: string;
}) {
  return <div className={[styles.card, styles[padding], className].filter(Boolean).join(" ")}>{children}</div>;
}
