import React, { useState, useEffect } from 'react';

interface NumInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Number input that allows clearing the field to type a new number.
 * Standard `type="number"` with `value={n}` gets stuck because converting
 * "" → 0 → clamped-to-min re-renders before the user can type.
 */
export function NumInput({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  className = '',
  placeholder = '',
  disabled = false,
}: NumInputProps) {
  const [display, setDisplay] = useState(value.toString());

  useEffect(() => {
    setDisplay(value.toString());
  }, [value]);

  const commit = (raw: string) => {
    const n = parseFloat(raw);
    if (isNaN(n)) {
      setDisplay(value.toString());
      return;
    }
    const clamped = Math.max(min, Math.min(max, n));
    onChange(clamped);
    setDisplay(clamped.toString());
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={display}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      onChange={e => setDisplay(e.target.value)}
      onBlur={e => commit(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
      }}
    />
  );
}
