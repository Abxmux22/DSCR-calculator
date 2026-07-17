import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { AnalyzerInput, AnalyzerResult, YearIndex } from "@/types/dscr";
import { formatCurrency, formatNumber, formatPercent, todayLabel } from "@/lib/format";

interface PdfParams {
  input: AnalyzerInput;
  result: AnalyzerResult;
}

const YEARS: YearIndex[] = [1, 2, 3, 4, 5];

function pageTitle(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFillColor(38, 70, 83);
  doc.rect(0, 0, 210, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("DSCR Real Estate Investment Analyzer", 14, 10);
  doc.setFontSize(11);
  doc.text(title, 14, 18);
  doc.setTextColor(33, 37, 41);
  if (subtitle) {
    doc.setFontSize(10);
    doc.text(subtitle, 14, 32);
  }

  doc.setDrawColor(120, 120, 120);
  doc.rect(165, 5, 35, 14);
  doc.setFontSize(8);
  doc.text("Company Logo", 171, 13);
}

function addPageNumbers(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Page ${i} of ${pages}`, 105, 290, { align: "center" });
  }
}

export function exportAnalyzerPdf({ input, result }: PdfParams) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Page 1 - Executive Summary
  pageTitle(doc, "Executive Summary", `Prepared: ${todayLabel()}  |  Property: ${input.propertyName}`);
  autoTable(doc, {
    startY: 38,
    theme: "grid",
    head: [["Metric", "Value"]],
    body: [
      ["Average DSCR", formatNumber(result.metrics.averageDscr)],
      ["Year 5 NOI", formatCurrency(result.metrics.year5Noi)],
      ["Estimated Sale Price", formatCurrency(result.metrics.estimatedSalePrice)],
      ["Total Investor Profit (LP)", formatCurrency(result.metrics.totalInvestorProfit)],
      ["Average Cash on Cash Return", formatPercent(result.metrics.averageCashOnCashReturn)],
      ["Investor IRR", formatPercent(result.metrics.investorIrr)]
    ]
  });

  // Page 2 - Historical
  doc.addPage();
  pageTitle(doc, "Historical Performance (T12)");
  autoTable(doc, {
    startY: 34,
    head: [["Line Item", "Value"]],
    body: [
      ["Rent Income", formatCurrency(result.historical.rentIncome)],
      ["Other Income", formatCurrency(result.historical.otherIncome)],
      ["Net Income", formatCurrency(result.historical.netIncome)],
      ["Operating Expenses", formatCurrency(result.historical.operatingExpenses)],
      ["NOI", formatCurrency(result.historical.noi)],
      ["Debt Payment", formatCurrency(result.historical.debtPayment)],
      ["DSCR", formatNumber(result.historical.dscr)],
      ["Cash Flow", formatCurrency(result.historical.cashFlow)]
    ],
    theme: "striped"
  });

  // Page 3 - 5 Year Projection
  doc.addPage();
  pageTitle(doc, "5-Year Projection Table");
  autoTable(doc, {
    startY: 34,
    head: [["Line Item", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5"]],
    body: [
      ["NOI", ...YEARS.map((y) => formatCurrency(result.projected[y].noi))],
      ["DSCR", ...YEARS.map((y) => formatNumber(result.projected[y].dscr))],
      ["Net Cash Flow", ...YEARS.map((y) => formatCurrency(result.projected[y].netCashFlow))],
      ["Cash Flow to LP", ...YEARS.map((y) => formatCurrency(result.projected[y].cashFlowToLP))],
      ["Cash on Cash Return", ...YEARS.map((y) => formatPercent(result.projected[y].cashOnCashReturn))]
    ],
    theme: "grid"
  });

  // Page 4 - DSCR Analysis
  doc.addPage();
  pageTitle(doc, "DSCR Analysis");
  doc.setFontSize(10);
  doc.text("DSCR trend by projected year:", 14, 36);
  const chartX = 14;
  const chartY = 45;
  const chartW = 180;
  const chartH = 70;
  doc.rect(chartX, chartY, chartW, chartH);
  const dscrValues = YEARS.map((y) => result.projected[y].dscr ?? 0);
  const max = Math.max(1, ...dscrValues);
  YEARS.forEach((year, idx) => {
    const value = dscrValues[idx];
    const barW = 24;
    const gap = 10;
    const x = chartX + 10 + idx * (barW + gap);
    const barH = (value / max) * (chartH - 14);
    const y = chartY + chartH - 6 - barH;
    doc.setFillColor(63, 122, 139);
    doc.rect(x, y, barW, barH, "F");
    doc.setFontSize(8);
    doc.text(`Y${year}`, x + 8, chartY + chartH - 1);
    doc.text(formatNumber(value), x + 6, y - 2);
  });
  doc.setFontSize(10);
  doc.text("Interpretation: DSCR above 1.25x is generally preferred by debt providers.", 14, 125);

  // Page 5 - Sale Proceeds
  doc.addPage();
  pageTitle(doc, "Sale Proceeds Analysis");
  autoTable(doc, {
    startY: 34,
    head: [["Item", "Value"]],
    body: [
      ["Year 5 NOI", formatCurrency(result.sale.year5Noi)],
      ["Exit Cap Rate", `${input.assumptions.projectedCapRateAtSalePct.toFixed(2)}%`],
      ["Projected Property Value", formatCurrency(result.sale.projectedPropertyValue)],
      ["Projected Loan at Sale", formatCurrency(input.assumptions.projectedLoanAtSale)],
      ["Projected Closing Costs at Sale", formatCurrency(input.assumptions.projectedClosingCostsAtSale)],
      ["Net Sale Proceeds", formatCurrency(result.sale.netSaleProceeds)],
      ["Profit After Return of Capital", formatCurrency(result.sale.profitAfterReturnOfCapital)]
    ]
  });

  // Page 6 - Investor Returns
  doc.addPage();
  pageTitle(doc, "Investor Returns");
  autoTable(doc, {
    startY: 34,
    head: [["Measure", "Value"]],
    body: [
      ["LP Profit Share", formatCurrency(result.sale.lpProfitShare)],
      ["GP Profit Share", formatCurrency(result.sale.gpProfitShare)],
      ["Average Cash-on-Cash Return", formatPercent(result.metrics.averageCashOnCashReturn)],
      ["Investor IRR", formatPercent(result.metrics.investorIrr)]
    ],
    theme: "striped"
  });

  autoTable(doc, {
    startY: 95,
    head: [["IRR Schedule", "Cash Flow"]],
    body: [
      ["Initial Investment", formatCurrency(result.irr.cashFlows[0])],
      ["Year 1", formatCurrency(result.irr.cashFlows[1])],
      ["Year 2", formatCurrency(result.irr.cashFlows[2])],
      ["Year 3", formatCurrency(result.irr.cashFlows[3])],
      ["Year 4", formatCurrency(result.irr.cashFlows[4])],
      ["Year 5", formatCurrency(result.irr.cashFlows[5])]
    ]
  });

  // Page 7 - Conclusion
  doc.addPage();
  pageTitle(doc, "Conclusion and Investment Snapshot");
  doc.setFontSize(11);
  doc.text("Investment Snapshot", 14, 40);
  doc.setFontSize(10);
  doc.text(`Property: ${input.propertyName}`, 14, 48);
  doc.text(`Target Capital Raise: ${formatCurrency(input.assumptions.totalCapitalRaise)}`, 14, 55);
  doc.text(`Estimated Sale Price: ${formatCurrency(result.sale.projectedPropertyValue)}`, 14, 62);
  doc.text(`LP Distribution at Sale: ${formatCurrency(result.sale.lpProfitShare)}`, 14, 69);
  doc.text(`Expected Investor IRR: ${formatPercent(result.metrics.investorIrr)}`, 14, 76);

  doc.setFontSize(9);
  doc.text(
    "This report is generated automatically from user-provided assumptions and should be reviewed with legal, tax, and financial advisors.",
    14,
    90,
    { maxWidth: 180 }
  );

  addPageNumbers(doc);
  doc.save(`DSCR-Analyzer-${input.propertyName || "Report"}.pdf`);
}