import styles from "./SearchInput.module.css";

export function SearchInput({
  value,
  onChange,
  placeholder = "/ procurar",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="search"
      className={styles.input}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
