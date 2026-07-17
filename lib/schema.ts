import { z } from "zod";

const numberField = (label: string) =>
  z.coerce.number({ invalid_type_error: `${label} must be a number.` }).min(0, `${label} must be positive.`);

const splitField = (label: string) =>
  z
    .coerce.number({ invalid_type_error: `${label} must be a number.` })
    .min(0, `${label} must be between 0 and 100.`)
    .max(100, `${label} must be between 0 and 100.`);

const performanceSchema = z.object({
  rentIncome: numberField("Rent Income"),
  otherIncome: numberField("Other Income"),
  operatingExpenses: numberField("Operating Expenses"),
  debtPayment: numberField("Debt Payment"),
  assetManagementFee: numberField("Asset Management Fee")
});

export const analyzerSchema = z
  .object({
    propertyName: z.string().trim().min(1, "Property name is required."),
    assumptions: z
      .object({
        totalCapitalRaise: numberField("Amount of Total Capital Raise"),
        projectedLoanAtSale: numberField("Projected Loan Amount at Sale"),
        projectedClosingCostsAtSale: numberField("Projected Closing Costs at Sale"),
        projectedCapRateAtSalePct: numberField("Projected Cap Rate at Sale").max(100, "Cap rate must be <= 100."),
        gpSplitProfitPct: splitField("GP Split of Profit"),
        lpSplitProfitPct: splitField("LP Split of Profit")
      })
      .superRefine((value, ctx) => {
        const total = value.gpSplitProfitPct + value.lpSplitProfitPct;
        if (Math.abs(total - 100) > 0.001) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "GP Split % + LP Split % must equal 100%.",
            path: ["lpSplitProfitPct"]
          });
        }
      }),
    historicalT12: performanceSchema,
    projections: z.object({
      1: performanceSchema,
      2: performanceSchema,
      3: performanceSchema,
      4: performanceSchema,
      5: performanceSchema
    })
  })
  .strict();

export type AnalyzerFormValues = z.infer<typeof analyzerSchema>;