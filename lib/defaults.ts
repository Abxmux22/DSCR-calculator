import { AnalyzerInput } from "@/types/dscr";

const yearDefaults = {
  rentIncome: 0,
  otherIncome: 0,
  operatingExpenses: 0,
  debtPayment: 0,
  assetManagementFee: 0
};

export const defaultInput: AnalyzerInput = {
  propertyName: "",
  assumptions: {
    totalCapitalRaise: 0,
    projectedLoanAtSale: 0,
    projectedClosingCostsAtSale: 0,
    projectedCapRateAtSalePct: 6.5,
    gpSplitProfitPct: 25,
    lpSplitProfitPct: 75
  },
  historicalT12: { ...yearDefaults },
  projections: {
    1: { ...yearDefaults },
    2: { ...yearDefaults },
    3: { ...yearDefaults },
    4: { ...yearDefaults },
    5: { ...yearDefaults }
  }
};

export const STORAGE_KEY = "dscr_analyzer_saved_analysis_v1";