"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Printer, Save, Upload } from "lucide-react";
import { Dashboard } from "@/components/dashboard";
import { NumberInput } from "@/components/number-input";
import { SectionCard } from "@/components/section-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { runAnalyzer } from "@/lib/calculator";
import { defaultInput, STORAGE_KEY } from "@/lib/defaults";
import { exportAnalyzerPdf } from "@/lib/pdf";
import { analyzerSchema, AnalyzerFormValues } from "@/lib/schema";
import { PersistedAnalysis, YearIndex } from "@/types/dscr";

const YEAR_LABELS: Record<YearIndex, string> = {
  1: "Projected Year 1",
  2: "Projected Year 2",
  3: "Projected Year 3",
  4: "Projected Year 4",
  5: "Projected Year 5"
};

export default function HomePage() {
  const [isDark, setIsDark] = useState(false);
  const [result, setResult] = useState(() => runAnalyzer(defaultInput));
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isSubmitting }
  } = useForm<AnalyzerFormValues>({
    resolver: zodResolver(analyzerSchema),
    defaultValues: defaultInput,
    mode: "onBlur"
  });

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("dscr-theme");
    const nextDark = storedTheme === "dark";
    setIsDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("dscr-theme", next ? "dark" : "light");
  };

  const onSubmit = (values: AnalyzerFormValues) => {
    const computed = runAnalyzer(values);
    setResult(computed);
    setStatus("Analysis updated.");
  };

  const saveAnalysis = () => {
    try {
      const values = analyzerSchema.parse(getValues());
      const payload: PersistedAnalysis = {
        input: values,
        savedAt: new Date().toISOString()
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setStatus("Analysis saved as JSON in local storage.");
    } catch {
      setStatus("Cannot save until form data is valid.");
    }
  };

  const loadAnalysis = () => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setStatus("No saved analysis found.");
      return;
    }

    try {
      const parsed = JSON.parse(raw) as PersistedAnalysis;
      const validated = analyzerSchema.parse(parsed.input);
      reset(validated);
      setResult(runAnalyzer(validated));
      setStatus(`Loaded saved analysis from ${new Date(parsed.savedAt).toLocaleString()}.`);
    } catch {
      setStatus("Saved analysis is invalid and could not be loaded.");
    }
  };

  const yearSections = useMemo(() => [1, 2, 3, 4, 5] as YearIndex[], []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 p-4 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">DSCR Real Estate Investment Analyzer</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Enter only input assumptions. All calculations, ratios, and investor metrics are computed automatically.
              </p>
            </div>
            <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
          </div>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <SectionCard title="Property Information">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Property Name</span>
              <input
                type="text"
                placeholder="Example: 123 Main St Apartments"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-300 focus:ring-2 dark:border-slate-700 dark:bg-slate-900"
                {...register("propertyName")}
              />
              {errors.propertyName?.message ? (
                <span className="text-xs text-rose-600">{errors.propertyName.message}</span>
              ) : null}
            </label>
          </SectionCard>

          <SectionCard title="Section A: Capital & Sale Assumptions">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <NumberInput label="Amount of Total Capital Raise" inputProps={register("assumptions.totalCapitalRaise")} error={errors.assumptions?.totalCapitalRaise?.message} />
              <NumberInput label="Projected Loan Amount at Sale" inputProps={register("assumptions.projectedLoanAtSale")} error={errors.assumptions?.projectedLoanAtSale?.message} />
              <NumberInput label="Projected Closing Costs at Sale" inputProps={register("assumptions.projectedClosingCostsAtSale")} error={errors.assumptions?.projectedClosingCostsAtSale?.message} />
              <NumberInput label="Projected Cap Rate at Sale (%)" inputProps={register("assumptions.projectedCapRateAtSalePct")} error={errors.assumptions?.projectedCapRateAtSalePct?.message} />
              <NumberInput label="GP Split of Profit (%)" inputProps={register("assumptions.gpSplitProfitPct")} error={errors.assumptions?.gpSplitProfitPct?.message} />
              <NumberInput label="LP Split of Profit (%)" inputProps={register("assumptions.lpSplitProfitPct")} error={errors.assumptions?.lpSplitProfitPct?.message} />
            </div>
          </SectionCard>

          <SectionCard title="Section B: Historical Performance (T12)">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <NumberInput label="Annual Rent Income" inputProps={register("historicalT12.rentIncome")} error={errors.historicalT12?.rentIncome?.message} />
              <NumberInput label="Annual Other Income" inputProps={register("historicalT12.otherIncome")} error={errors.historicalT12?.otherIncome?.message} />
              <NumberInput label="Annual Operating Expenses" inputProps={register("historicalT12.operatingExpenses")} error={errors.historicalT12?.operatingExpenses?.message} />
              <NumberInput label="Annual Debt Payment" inputProps={register("historicalT12.debtPayment")} error={errors.historicalT12?.debtPayment?.message} />
              <NumberInput label="Asset Management Fee" inputProps={register("historicalT12.assetManagementFee")} error={errors.historicalT12?.assetManagementFee?.message} />
            </div>
          </SectionCard>

          {yearSections.map((year) => (
            <SectionCard key={year} title={`Section ${String.fromCharCode(66 + year)}: ${YEAR_LABELS[year]}`}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <NumberInput label="Rent Income" inputProps={register(`projections.${year}.rentIncome` as const)} error={errors.projections?.[year]?.rentIncome?.message} />
                <NumberInput label="Other Income" inputProps={register(`projections.${year}.otherIncome` as const)} error={errors.projections?.[year]?.otherIncome?.message} />
                <NumberInput label="Operating Expenses" inputProps={register(`projections.${year}.operatingExpenses` as const)} error={errors.projections?.[year]?.operatingExpenses?.message} />
                <NumberInput label="Debt Payment" inputProps={register(`projections.${year}.debtPayment` as const)} error={errors.projections?.[year]?.debtPayment?.message} />
                <NumberInput label="Asset Management Fee" inputProps={register(`projections.${year}.assetManagementFee` as const)} error={errors.projections?.[year]?.assetManagementFee?.message} />
              </div>
            </SectionCard>
          ))}

          <div className="no-print sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-800 disabled:opacity-70"
            >
              {isSubmitting ? "Calculating..." : "Run Analysis"}
            </button>
            <button
              type="button"
              onClick={saveAnalysis}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm dark:border-slate-700"
            >
              <Save className="h-4 w-4" /> Save JSON
            </button>
            <button
              type="button"
              onClick={loadAnalysis}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm dark:border-slate-700"
            >
              <Upload className="h-4 w-4" /> Load Previous
            </button>
            <button
              type="button"
              onClick={async () => {
                setIsPdfLoading(true);
                try {
                  const values = analyzerSchema.parse(getValues());
                  const computed = runAnalyzer(values);
                  exportAnalyzerPdf({ input: values, result: computed });
                  setStatus("PDF exported.");
                } catch {
                  setStatus("Cannot export PDF until form data is valid.");
                } finally {
                  setIsPdfLoading(false);
                }
              }}
              disabled={isPdfLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm dark:border-slate-700 disabled:opacity-70"
            >
              <Download className="h-4 w-4" /> {isPdfLoading ? "Exporting..." : "Export PDF"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm dark:border-slate-700"
            >
              <Printer className="h-4 w-4" /> Print
            </button>
            {status ? <p className="text-sm text-slate-500 dark:text-slate-400">{status}</p> : null}
          </div>
        </form>

        <Dashboard result={result} />
      </div>
    </main>
  );
}