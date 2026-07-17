import { AnalyzerInput, AnalyzerResult, PeriodResult, SaleAnalysis, YearIndex } from "@/types/dscr";

export function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function safeDivide(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

function periodResult(
  label: string,
  rentIncome: number,
  otherIncome: number,
  operatingExpenses: number,
  debtPayment: number,
  assetManagementFee: number,
  lpSplit: number,
  gpSplit: number,
  capitalRaise: number
): PeriodResult {
  const netIncome = rentIncome + otherIncome;
  const noi = netIncome - operatingExpenses;
  const dscr = safeDivide(noi, debtPayment);
  const cashFlow = noi - debtPayment;
  const netCashFlow = cashFlow - assetManagementFee;
  const cashFlowToLP = netCashFlow * lpSplit;
  const cashFlowToGP = netCashFlow * gpSplit;
  const cashOnCashReturn = safeDivide(cashFlowToLP, capitalRaise);

  return {
    label,
    rentIncome,
    otherIncome,
    netIncome,
    operatingExpenses,
    noi,
    debtPayment,
    dscr,
    cashFlow,
    assetManagementFee,
    netCashFlow,
    cashFlowToLP,
    cashFlowToGP,
    cashOnCashReturn
  };
}

function npv(rate: number, cashFlows: number[]): number {
  return cashFlows.reduce((acc, cf, idx) => acc + cf / Math.pow(1 + rate, idx), 0);
}

export function calculateIRR(cashFlows: number[]): number | null {
  if (cashFlows.length < 2) return null;
  const hasPositive = cashFlows.some((v) => v > 0);
  const hasNegative = cashFlows.some((v) => v < 0);
  if (!hasPositive || !hasNegative) return null;

  let low = -0.9999;
  let high = 5;
  let npvLow = npv(low, cashFlows);
  let npvHigh = npv(high, cashFlows);

  let attempts = 0;
  while (npvLow * npvHigh > 0 && attempts < 20) {
    high *= 2;
    npvHigh = npv(high, cashFlows);
    attempts += 1;
  }

  if (npvLow * npvHigh > 0) {
    return null;
  }

  for (let i = 0; i < 200; i += 1) {
    const mid = (low + high) / 2;
    const val = npv(mid, cashFlows);
    if (Math.abs(val) < 1e-7) return mid;

    if (npvLow * val < 0) {
      high = mid;
      npvHigh = val;
    } else {
      low = mid;
      npvLow = val;
    }
  }

  return (low + high) / 2;
}

function average(values: Array<number | null>): number | null {
  const clean = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (!clean.length) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

export function runAnalyzer(input: AnalyzerInput): AnalyzerResult {
  const capitalRaise = safeNumber(input.assumptions.totalCapitalRaise);
  const loanAtSale = safeNumber(input.assumptions.projectedLoanAtSale);
  const closingCostsAtSale = safeNumber(input.assumptions.projectedClosingCostsAtSale);
  const exitCapRate = safeNumber(input.assumptions.projectedCapRateAtSalePct) / 100;
  const gpSplit = safeNumber(input.assumptions.gpSplitProfitPct) / 100;
  const lpSplit = safeNumber(input.assumptions.lpSplitProfitPct) / 100;

  const historical = periodResult(
    "Historical T12",
    safeNumber(input.historicalT12.rentIncome),
    safeNumber(input.historicalT12.otherIncome),
    safeNumber(input.historicalT12.operatingExpenses),
    safeNumber(input.historicalT12.debtPayment),
    safeNumber(input.historicalT12.assetManagementFee ?? 0),
    lpSplit,
    gpSplit,
    capitalRaise
  );

  const years: YearIndex[] = [1, 2, 3, 4, 5];
  const projected = years.reduce((acc, year) => {
    const y = input.projections[year];
    acc[year] = periodResult(
      `Year ${year}`,
      safeNumber(y.rentIncome),
      safeNumber(y.otherIncome),
      safeNumber(y.operatingExpenses),
      safeNumber(y.debtPayment),
      safeNumber(y.assetManagementFee),
      lpSplit,
      gpSplit,
      capitalRaise
    );
    return acc;
  }, {} as Record<YearIndex, PeriodResult>);

  const year5Noi = projected[5].noi;
  const projectedPropertyValue = safeDivide(year5Noi, exitCapRate);
  const saleProceeds = projectedPropertyValue;
  const netSaleProceeds = saleProceeds === null ? null : saleProceeds - loanAtSale - closingCostsAtSale;
  const profitAfterReturnOfCapital = netSaleProceeds === null ? null : netSaleProceeds - capitalRaise;
  const gpProfitShare = profitAfterReturnOfCapital === null ? null : profitAfterReturnOfCapital * gpSplit;
  const lpProfitShare = profitAfterReturnOfCapital === null ? null : profitAfterReturnOfCapital * lpSplit;

  const sale: SaleAnalysis = {
    year5Noi,
    projectedPropertyValue,
    saleProceeds,
    netSaleProceeds,
    profitAfterReturnOfCapital,
    gpProfitShare,
    lpProfitShare
  };

  const irrCashFlows = [
    -capitalRaise,
    projected[1].cashFlowToLP,
    projected[2].cashFlowToLP,
    projected[3].cashFlowToLP,
    projected[4].cashFlowToLP,
    projected[5].cashFlowToLP + (lpProfitShare ?? 0)
  ];

  const irrValue = calculateIRR(irrCashFlows);

  const metrics = {
    averageDscr: average(years.map((y) => projected[y].dscr)),
    year5Noi,
    estimatedSalePrice: projectedPropertyValue,
    totalInvestorProfit: lpProfitShare,
    averageCashOnCashReturn: average(years.map((y) => projected[y].cashOnCashReturn)),
    investorIrr: irrValue
  };

  return {
    historical,
    projected,
    sale,
    irr: {
      cashFlows: irrCashFlows,
      irr: irrValue
    },
    metrics
  };
}