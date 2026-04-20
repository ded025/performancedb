import { useEffect, useState } from "react";

type Props = {
  value: string; // YYYY-MM
  onChange: (v: string) => void;
  className?: string;
};

// Simple month input that returns YYYY-MM
export function MonthPicker({ value, onChange, className }: Props) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      type="month"
      value={v}
      onChange={(e) => {
        setV(e.target.value);
        onChange(e.target.value);
      }}
      className={
        "h-9 px-3 rounded-md border border-input bg-background text-sm " + (className ?? "")
      }
    />
  );
}
