import React from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  name: string;
  disabled?: boolean;
  ariaLabel?: string;
}

// A modern segmented control: a pill track where the active option reads as a
// raised "thumb". Backed by real radio inputs so keyboard/AT behaviour matches
// a native radio group. Drop-in replacement for the ButtonGroup/ToggleButton
// pattern used across the tool pages.
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  name,
  disabled = false,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <label
            key={opt.value}
            className={`segmented__option${active ? ' segmented__option--active' : ''}`}
          >
            <input
              type="radio"
              className="visually-hidden"
              name={name}
              value={opt.value}
              checked={active}
              disabled={disabled}
              onChange={() => onChange(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}
