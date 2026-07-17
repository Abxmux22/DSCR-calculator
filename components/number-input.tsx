"use client";

import { AlertCircle } from "lucide-react";

interface NumberInputProps {
  label: string;
  step?: string;
  placeholder?: string;
  error?: string;
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
}

export function NumberInput({ label, step = "0.01", placeholder = "0", error, inputProps }: NumberInputProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <input
        type="number"
        step={step}
        min="0"
        placeholder={placeholder}
        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-brand-300 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-900"
        {...inputProps}
      />
      {error ? (
        <span className="flex items-center gap-1 text-xs text-rose-600">
          <AlertCircle className="h-3 w-3" />
          {error}
        </span>
      ) : null}
    </label>
  );
}