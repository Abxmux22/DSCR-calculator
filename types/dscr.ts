export type YearIndex = 1 | 2 | 3 | 4 | 5;

export interface CapitalSaleAssumptions {
  totalCapitalRaise: number;
  projectedLoanAtSale: number;
  projectedClosingCostsAtSale: number;
  projectedCapRateAtSalePct: number;
  gpSplitProfitPct: number;
  lpSplitProfitPct: number;
}

export interface PerformanceInputs {
  rentIncome: number;
  otherIncome: number;
  operatingExpenses: number;
  debtPayment: number;
  assetManagementFee?: number;
}

export interface AnalyzerInput {
  propertyName: string;
  assumptions: CapitalSaleAssumptions;
  historicalT12: PerformanceInputs;
  projections: Record<YearIndex, Required<PerformanceInputs>>;
}

export interface PeriodResult {
  label: string;
  rentIncome: number;
  otherIncome: number;
  netIncome: number;
  operatingExpenses: number;
  noi: number;
  debtPayment: number;
  dscr: number | null;
  cashFlow: number;
  assetManagementFee: number;
  netCashFlow: number;
  cashFlowToLP: number;
  cashFlowToGP: number;
  cashOnCashReturn: number | null;
}

export interface SaleAnalysis {
  year5Noi: number;
  projectedPropertyValue: number | null;
  saleProceeds: number | null;
  netSaleProceeds: number | null;
  profitAfterReturnOfCapital: number | null;
  gpProfitShare: number | null;
  lpProfitShare: number | null;
}

export interface IrrAnalysis {
  cashFlows: number[];
  irr: number | null;
}

export interface KeyMetrics {
  averageDscr: number | null;
  year5Noi: number;
  estimatedSalePrice: number | null;
  totalInvestorProfit: number | null;
  averageCashOnCashReturn: number | null;
  investorIrr: number | null;
}

export interface AnalyzerResult {
  historical: PeriodResult;
  projected: Record<YearIndex, PeriodResult>;
  sale: SaleAnalysis;
  irr: IrrAnalysis;
  metrics: KeyMetrics;
}

export interface PersistedAnalysis {
  input: AnalyzerInput;
  savedAt: string;
}