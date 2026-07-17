import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

interface MetricCardProps {
  label: string;
  value: number | null;
  kind: "currency" | "percent" | "number";
}

export function MetricCard({ label, value, kind }: MetricCardProps) {
  const rendered =
    kind === "currency" ? formatCurrency(value) : kind === "percent" ? formatPercent(value) : formatNumber(value);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{rendered}</p>
    </article>
  );
}