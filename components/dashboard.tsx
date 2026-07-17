"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  LineChart
} from "recharts";
import { AnalyzerResult, YearIndex } from "@/types/dscr";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { MetricCard } from "@/components/metric-card";
import { SectionCard } from "@/components/section-card";

const YEARS: YearIndex[] = [1, 2, 3, 4, 5];

export function Dashboard({ result }: { result: AnalyzerResult }) {
  const noiChart = YEARS.map((year) => ({ year: `Y${year}`, noi: result.projected[year].noi }));
  const dscrChart = YEARS.map((year) => ({ year: `Y${year}`, dscr: result.projected[year].dscr ?? 0 }));
  const cashChart = YEARS.map((year) => ({
    year: `Y${year}`,
    lp: result.projected[year].cashFlowToLP,
    gp: result.projected[year].cashFlowToGP
  }));
  const pieData = [
    { name: "LP Profit", value: Math.max(0, result.sale.lpProfitShare ?? 0) },
    { name: "GP Profit", value: Math.max(0, result.sale.gpProfitShare ?? 0) }
  ];

  return (
    <div className="space-y-6">
      <SectionCard title="Key Metrics" subtitle="Investor-grade summary">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="Average DSCR" value={result.metrics.averageDscr} kind="number" />
          <MetricCard label="Year 5 NOI" value={result.metrics.year5Noi} kind="currency" />
          <MetricCard label="Estimated Sale Price" value={result.metrics.estimatedSalePrice} kind="currency" />
          <MetricCard label="Total Investor Profit" value={result.metrics.totalInvestorProfit} kind="currency" />
          <MetricCard label="Average Cash-on-Cash" value={result.metrics.averageCashOnCashReturn} kind="percent" />
          <MetricCard label="Investor IRR" value={result.metrics.investorIrr} kind="percent" />
        </div>
      </SectionCard>

      <SectionCard title="Charts" subtitle="NOI, DSCR, cash flow, and return allocation">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-64 rounded-xl border border-slate-200 p-2 dark:border-slate-800">
            <h3 className="mb-2 text-sm font-semibold">NOI Growth</h3>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={noiChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Line type="monotone" dataKey="noi" stroke="#3f7a8b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="h-64 rounded-xl border border-slate-200 p-2 dark:border-slate-800">
            <h3 className="mb-2 text-sm font-semibold">DSCR Trend</h3>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={dscrChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip formatter={(v) => formatNumber(Number(v))} />
                <Bar dataKey="dscr" fill="#264653" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="h-64 rounded-xl border border-slate-200 p-2 dark:border-slate-800">
            <h3 className="mb-2 text-sm font-semibold">Cash Flow Trend</h3>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={cashChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend />
                <Bar dataKey="lp" fill="#2a9d8f" name="LP" />
                <Bar dataKey="gp" fill="#e76f51" name="GP" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="h-64 rounded-xl border border-slate-200 p-2 dark:border-slate-800">
            <h3 className="mb-2 text-sm font-semibold">Investor Return Breakdown</h3>
            <ResponsiveContainer width="100%" height="90%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} fill="#3f7a8b" label />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Historical Performance">
        <SimpleTable
          headers={["Metric", "T12"]}
          rows={[
            ["Rent Income", formatCurrency(result.historical.rentIncome)],
            ["Other Income", formatCurrency(result.historical.otherIncome)],
            ["NOI", formatCurrency(result.historical.noi)],
            ["Debt Payment", formatCurrency(result.historical.debtPayment)],
            ["DSCR", formatNumber(result.historical.dscr)],
            ["Net Cash Flow", formatCurrency(result.historical.netCashFlow)]
          ]}
        />
      </SectionCard>

      <SectionCard title="Year 1-5 Projections">
        <SimpleTable
          headers={["Metric", "Y1", "Y2", "Y3", "Y4", "Y5"]}
          rows={[
            ["NOI", ...YEARS.map((y) => formatCurrency(result.projected[y].noi))],
            ["DSCR", ...YEARS.map((y) => formatNumber(result.projected[y].dscr))],
            ["Net Cash Flow", ...YEARS.map((y) => formatCurrency(result.projected[y].netCashFlow))],
            ["Cash Flow to LP", ...YEARS.map((y) => formatCurrency(result.projected[y].cashFlowToLP))],
            ["Cash on Cash", ...YEARS.map((y) => formatPercent(result.projected[y].cashOnCashReturn))]
          ]}
        />
      </SectionCard>

      <SectionCard title="Sale Analysis">
        <SimpleTable
          headers={["Metric", "Value"]}
          rows={[
            ["Projected Property Value", formatCurrency(result.sale.projectedPropertyValue)],
            ["Net Sale Proceeds", formatCurrency(result.sale.netSaleProceeds)],
            ["Profit After Return of Capital", formatCurrency(result.sale.profitAfterReturnOfCapital)],
            ["LP Profit Share", formatCurrency(result.sale.lpProfitShare)],
            ["GP Profit Share", formatCurrency(result.sale.gpProfitShare)]
          ]}
        />
      </SectionCard>

      <SectionCard title="IRR Analysis">
        <SimpleTable
          headers={["Period", "Cash Flow"]}
          rows={[
            ["Initial Investment", formatCurrency(result.irr.cashFlows[0])],
            ["Year 1", formatCurrency(result.irr.cashFlows[1])],
            ["Year 2", formatCurrency(result.irr.cashFlows[2])],
            ["Year 3", formatCurrency(result.irr.cashFlows[3])],
            ["Year 4", formatCurrency(result.irr.cashFlows[4])],
            ["Year 5", formatCurrency(result.irr.cashFlows[5])],
            ["Investor IRR", formatPercent(result.irr.irr)]
          ]}
        />
      </SectionCard>
    </div>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800">
          <tr>
            {headers.map((head) => (
              <th key={head} className="px-3 py-2 text-left font-semibold">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row[0]}-${idx}`} className="border-t border-slate-200 dark:border-slate-800">
              {row.map((cell) => (
                <td key={`${cell}-${idx}`} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}