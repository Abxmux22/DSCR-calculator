const MIN_PROJECTED_YEARS = 3;
const MAX_PROJECTED_YEARS = 10;
let YEARS = Array.from({ length: MIN_PROJECTED_YEARS }, (_, index) => index + 1);

const statusEl = document.getElementById("status");
const yearsWrap = document.getElementById("yearsWrap");
function num(id) {
  const value = document.getElementById(id).value;
  const n = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatCurrencyInput(input, keepEmpty = true) {
  const cleaned = String(input.value || "")
    .replace(/[$,\s]/g, "")
    .replace(/[^\d.]/g, "");
  const dotIndex = cleaned.indexOf(".");

  if (!cleaned) {
    input.value = keepEmpty ? "" : "$0";
    return;
  }

  let whole = dotIndex >= 0 ? cleaned.slice(0, dotIndex) : cleaned;
  const decimal = dotIndex >= 0 ? cleaned.slice(dotIndex + 1).replace(/\./g, "").slice(0, 2) : "";
  whole = (whole || "0").replace(/^0+(?=\d)/, "");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  input.value = `$${grouped}${dotIndex >= 0 ? `.${decimal}` : ""}`;
}

function clampPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

function setStatus(message, error = false) {
  statusEl.textContent = message;
  statusEl.className = error ? "muted error" : "muted";
}

function fmtCurrency(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function fmtNumber(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "N/A";
  return Number(v).toFixed(2);
}

function fmtPercentFromRatio(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "N/A";
  return `${(v * 100).toFixed(2)}%`;
}

function safeDiv(a, b) {
  if (!Number.isFinite(b) || b === 0) return null;
  return a / b;
}

function irr(cashFlows) {
  const hasPos = cashFlows.some((x) => x > 0);
  const hasNeg = cashFlows.some((x) => x < 0);
  if (!hasPos || !hasNeg) return null;

  const npv = (rate) => cashFlows.reduce((acc, cf, i) => acc + (cf / ((1 + rate) ** i)), 0);
  let low = -0.9999;
  let high = 5;
  let fLow = npv(low);
  let fHigh = npv(high);

  for (let i = 0; i < 20 && fLow * fHigh > 0; i += 1) {
    high *= 2;
    fHigh = npv(high);
  }

  if (fLow * fHigh > 0) return null;

  for (let i = 0; i < 200; i += 1) {
    const mid = (low + high) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7) return mid;

    if (fLow * fMid < 0) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }

  return (low + high) / 2;
}

function calcPeriod(p, capital) {
  const lp = clampPct(p.cashFlowToLPPct) / 100;
  const gp = clampPct(p.cashFlowToGPPct) / 100;
  const netIncome = p.rentIncome + p.otherIncome;
  const noi = netIncome - p.operatingExpenses;
  const otherIncomeRatio = safeDiv(p.otherIncome, netIncome);
  const expenseRatio = safeDiv(p.operatingExpenses, netIncome);
  const dscr = safeDiv(noi, p.debtPayment);
  const cashFlow = noi - p.debtPayment;
  const netCashFlow = cashFlow - p.assetManagementFee;
  const cashFlowToLP = netCashFlow * lp;
  const cashFlowToGP = netCashFlow * gp;
  const coc = safeDiv(cashFlowToLP, capital);

  return {
    ...p,
    netIncome,
    noi,
    otherIncomeRatio,
    expenseRatio,
    dscr,
    cashFlow,
    netCashFlow,
    cashFlowToLP,
    cashFlowToGP,
    cashOnCashReturn: coc
  };
}

function collectInputs() {
  const propertyName = document.getElementById("propertyName").value.trim();
  const fullName = document.getElementById("fullName").value.trim();
  const email = document.getElementById("email").value.trim();

  const assumptions = {
    totalCapitalRaise: num("totalCapitalRaise"),
    projectedLoanAtSale: num("projectedLoanAtSale"),
    projectedClosingCostsAtSale: num("projectedClosingCostsAtSale"),
    projectedCapRateAtSalePct: num("projectedCapRateAtSalePct"),
    gpSplitProfitPct: num("gpSplitProfitPct"),
    lpSplitProfitPct: num("lpSplitProfitPct")
  };

  const historical = {
    rentIncome: num("h_rentIncome"),
    otherIncome: num("h_otherIncome"),
    operatingExpenses: num("h_operatingExpenses"),
    debtPayment: num("h_debtPayment"),
    assetManagementFee: num("h_assetManagementFee")
  };

  const projections = {};
  YEARS.forEach((y) => {
    const lpPct = clampPct(num(`y${y}_cashFlowToLPPct`));
    projections[y] = {
      rentIncome: num(`y${y}_rentIncome`),
      otherIncome: num(`y${y}_otherIncome`),
      operatingExpenses: num(`y${y}_operatingExpenses`),
      debtPayment: num(`y${y}_debtPayment`),
      assetManagementFee: num(`y${y}_assetManagementFee`),
      cashFlowToLPPct: lpPct,
      cashFlowToGPPct: 100 - lpPct
    };
  });

  return { propertyName, fullName, email, assumptions, historical, projections };
}

function validateInput(input) {
  const s = input.assumptions;
  const error = (section, field, fieldId, reason = "is required") => ({
    section,
    field,
    fieldId,
    message: `${section}: ${field} ${reason}.`
  });

  if (!input.propertyName) return error("Client & Property Details", "Property Name", "propertyName");
  if (!input.fullName) return error("Client & Property Details", "Full Name", "fullName");
  if (!input.email) return error("Client & Property Details", "Email", "email");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return error("Client & Property Details", "Email", "email", "must be a valid email address");
  }

  const requiredNumbers = [
    ["Capital Raise", "Total Capital Raise", "totalCapitalRaise", s.totalCapitalRaise],
    ["Historical Performance (T12)", "Annual Rent Income", "h_rentIncome", input.historical.rentIncome],
    ["Historical Performance (T12)", "Annual Other Income", "h_otherIncome", input.historical.otherIncome],
    ["Historical Performance (T12)", "Annual Operating Expenses", "h_operatingExpenses", input.historical.operatingExpenses],
    ["Historical Performance (T12)", "Annual Debt Payment", "h_debtPayment", input.historical.debtPayment],
    ["Historical Performance (T12)", "Asset Management Fee", "h_assetManagementFee", input.historical.assetManagementFee, true]
  ];

  YEARS.forEach((year) => {
    const projection = input.projections[year];
    requiredNumbers.push(
      [`Projected Year ${year}`, "Rent Income", `y${year}_rentIncome`, projection.rentIncome],
      [`Projected Year ${year}`, "Other Income", `y${year}_otherIncome`, projection.otherIncome],
      [`Projected Year ${year}`, "Operating Expenses", `y${year}_operatingExpenses`, projection.operatingExpenses],
      [`Projected Year ${year}`, "Debt Payment", `y${year}_debtPayment`, projection.debtPayment],
      [`Projected Year ${year}`, "Asset Management Fee", `y${year}_assetManagementFee`, projection.assetManagementFee, true],
      [`Projected Year ${year}`, "Cash Flow to LP (%)", `y${year}_cashFlowToLPPct`, projection.cashFlowToLPPct]
    );
  });

  requiredNumbers.push(
    ["Projected Sale Costs", "Projected Loan at Sale", "projectedLoanAtSale", s.projectedLoanAtSale],
    ["Projected Sale Costs", "Projected Closing Costs at Sale", "projectedClosingCostsAtSale", s.projectedClosingCostsAtSale],
    ["Sale", "Projected Cap Rate at Sale (%)", "projectedCapRateAtSalePct", s.projectedCapRateAtSalePct],
    ["Sale", "GP Split of Profit (%)", "gpSplitProfitPct", s.gpSplitProfitPct],
    ["Sale", "LP Split of Profit (%)", "lpSplitProfitPct", s.lpSplitProfitPct]
  );

  for (const [section, field, fieldId, value, allowZero = false] of requiredNumbers) {
    if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
      return error(section, field, fieldId, allowZero ? "must be 0 or greater" : "must be greater than 0");
    }
  }

  if (Math.abs((s.gpSplitProfitPct + s.lpSplitProfitPct) - 100) > 0.001) {
    return error("Sale", "GP and LP Split of Profit (%)", "lpSplitProfitPct", "must total 100%");
  }

  return "";
}

function runAnalysis(input) {
  const s = input.assumptions;
  const lp = s.lpSplitProfitPct / 100;
  const gp = s.gpSplitProfitPct / 100;

  const historical = calcPeriod({
    ...input.historical,
    cashFlowToLPPct: input.projections[1].cashFlowToLPPct,
    cashFlowToGPPct: input.projections[1].cashFlowToGPPct
  }, s.totalCapitalRaise);
  const projected = {};
  YEARS.forEach((y) => {
    projected[y] = calcPeriod(input.projections[y], s.totalCapitalRaise);
  });

  const finalYear = YEARS[YEARS.length - 1];
  const finalYearNoi = projected[finalYear].noi;
  const saleValue = safeDiv(finalYearNoi, s.projectedCapRateAtSalePct / 100);
  const netSaleProceeds = saleValue === null ? null : saleValue - s.projectedLoanAtSale - s.projectedClosingCostsAtSale;
  const profitAfterCapital = netSaleProceeds === null ? null : netSaleProceeds - s.totalCapitalRaise;
  const gpProfitShare = profitAfterCapital === null ? null : profitAfterCapital * gp;
  const lpProfitShare = profitAfterCapital === null ? null : profitAfterCapital * lp;

  const cocList = YEARS.map((y) => projected[y].cashOnCashReturn).filter((v) => v !== null);
  const dscrList = YEARS.map((y) => projected[y].dscr).filter((v) => v !== null);

  const irrCashFlows = [
    -s.totalCapitalRaise,
    ...YEARS.map((year) => projected[year].cashFlowToLP + (year === finalYear ? (lpProfitShare || 0) : 0))
  ];

  return {
    input,
    historical,
    projected,
    sale: {
      finalYearNoi,
      finalYear,
      saleValue,
      netSaleProceeds,
      profitAfterCapital,
      gpProfitShare,
      lpProfitShare
    },
    irr: {
      cashFlows: irrCashFlows,
      value: irr(irrCashFlows)
    },
    metrics: {
      averageDscr: dscrList.length ? dscrList.reduce((a, b) => a + b, 0) / dscrList.length : null,
      finalYearNoi,
      finalYear,
      estimatedSalePrice: saleValue,
      totalInvestorProfit: lpProfitShare,
      averageCashOnCashReturn: cocList.length ? cocList.reduce((a, b) => a + b, 0) / cocList.length : null,
      investorIrr: irr(irrCashFlows)
    }
  };
}

function renderAll(data) {
  renderHistoricalCalculations(data);
  renderYearCalculations(data);
  renderSaleCalculations(data);
  renderIrrCalculations(data);
  const stickyAverageDscr = document.getElementById("stickyAverageDscr");
  if (stickyAverageDscr) stickyAverageDscr.textContent = fmtNumber(data.metrics.averageDscr);
}

function renderHistoricalCalculations(data) {
  const p = data.historical;
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  set("h_netIncome", fmtCurrency(p.netIncome));
  set("h_noi", fmtCurrency(p.noi));
  set("h_dscr", fmtNumber(p.dscr));
  set("h_cashFlow", fmtCurrency(p.cashFlow));
  set("h_netCashFlow", fmtCurrency(p.netCashFlow));
  set("h_cashFlowToLP", fmtCurrency(p.cashFlowToLP));
  set("h_cashFlowToGP", fmtCurrency(p.cashFlowToGP));
  set("h_otherIncomeRatio", fmtPercentFromRatio(p.otherIncomeRatio));
  set("h_expenseRatio", fmtPercentFromRatio(p.expenseRatio));
}

function renderYearCalculations(data) {
  YEARS.forEach((year) => {
    const p = data.projected[year];
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    set(`y${year}_netIncome`, fmtCurrency(p.netIncome));
    set(`y${year}_noi`, fmtCurrency(p.noi));
    set(`y${year}_dscr`, fmtNumber(p.dscr));
    set(`y${year}_cashFlow`, fmtCurrency(p.cashFlow));
    set(`y${year}_netCashFlow`, fmtCurrency(p.netCashFlow));
    set(`y${year}_cashFlowToLP`, fmtCurrency(p.cashFlowToLP));
    set(`y${year}_cashFlowToGP`, fmtCurrency(p.cashFlowToGP));
    set(`y${year}_annualCashOnCash`, fmtPercentFromRatio(p.cashOnCashReturn));
    set(`y${year}_otherIncomeRatio`, fmtPercentFromRatio(p.otherIncomeRatio));
    set(`y${year}_expenseRatio`, fmtPercentFromRatio(p.expenseRatio));
  });
}

function renderSaleCalculations(data) {
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  const saleOfProperty = data.sale.saleValue;
  const lessDebt = data.input.assumptions.projectedLoanAtSale;
  const lessClosingCosts = data.input.assumptions.projectedClosingCostsAtSale;
  const investorCapital = data.input.assumptions.totalCapitalRaise;
  const proceeds = data.sale.profitAfterCapital;
  const cashflowToLP = data.sale.lpProfitShare;
  const cashflowToGP = data.sale.gpProfitShare;

  set("sale_saleOfProperty", fmtCurrency(saleOfProperty));
  set("sale_lessDebt", fmtCurrency(-lessDebt));
  set("sale_lessClosingCosts", fmtCurrency(-lessClosingCosts));
  set("sale_investorCapital", fmtCurrency(-investorCapital));
  set("sale_proceeds", fmtCurrency(proceeds));
  set("sale_cashflowToLP", fmtCurrency(cashflowToLP));
  set("sale_cashflowToGP", fmtCurrency(cashflowToGP));
}

function renderIrrCalculations(data) {
  const irrLiveGrid = document.getElementById("irrLiveGrid");
  if (!irrLiveGrid) return;

  const yearRows = YEARS.map((year, index) => `
    <article class="year-live-item"><p class="k">Yr ${year}</p><p class="v">${fmtCurrency(data.irr.cashFlows[index + 1])}</p></article>
  `).join("");

  irrLiveGrid.innerHTML = `
    <article class="year-live-item"><p class="k">Initial Capital Investment</p><p class="v">${fmtCurrency(data.irr.cashFlows[0])}</p></article>
    ${yearRows}
    <article class="year-live-item"><p class="k">IRR Calculation</p><p class="v">${fmtPercentFromRatio(data.irr.value)}</p></article>
  `;
}

function yearSectionMarkup(y) {
  return `
    <section class="card year-section" data-year-section="${y}">
      ${y > MIN_PROJECTED_YEARS ? `<button class="year-remove-btn no-print" type="button" data-remove-year="${y}" aria-label="Remove Projected Year ${y}">&times;</button>` : ""}
      <h2>Projected Year ${y}</h2>
      <div class="grid cols-4">
        <label>Rent Income<input id="y${y}_rentIncome" class="currency-input" type="text" inputmode="decimal" value="$0" /></label>
        <label>Other Income<input id="y${y}_otherIncome" class="currency-input" type="text" inputmode="decimal" value="$0" /></label>
        <label>Operating Expenses<input id="y${y}_operatingExpenses" class="currency-input" type="text" inputmode="decimal" value="$0" /></label>
        <label>Debt Payment<input id="y${y}_debtPayment" class="currency-input" type="text" inputmode="decimal" value="$0" /></label>
        <label>Asset Management Fee<input id="y${y}_assetManagementFee" class="currency-input" type="text" inputmode="decimal" value="$0" /></label>
        <label>Cash Flow to LP (%)<input id="y${y}_cashFlowToLPPct" class="lp-split-input" data-year="${y}" type="number" min="0" max="100" step="0.01" value="75" /></label>
        <label>Cash Flow to GP (%)<input id="y${y}_cashFlowToGPPct" class="gp-split-input" data-year="${y}" type="number" min="0" max="100" step="0.01" value="25" readonly /></label>
      </div>
      <div class="year-live-grid">
        <article class="year-live-item"><p class="k">Net Income</p><p id="y${y}_netIncome" class="v">$0</p></article>
        <article class="year-live-item"><p class="k">NOI</p><p id="y${y}_noi" class="v">$0</p></article>
        <article class="year-live-item"><p class="k">Actual DSCR</p><p id="y${y}_dscr" class="v">N/A</p></article>
        <article class="year-live-item"><p class="k">Cash Flow</p><p id="y${y}_cashFlow" class="v">$0</p></article>
        <article class="year-live-item"><p class="k">Cashflow Net</p><p id="y${y}_netCashFlow" class="v">$0</p></article>
        <article class="year-live-item"><p class="k">Cash Flow to LP</p><p id="y${y}_cashFlowToLP" class="v">$0</p></article>
        <article class="year-live-item"><p class="k">Cash Flow to GP</p><p id="y${y}_cashFlowToGP" class="v">$0</p></article>
        <article class="year-live-item"><p class="k">Annual Cash on Cash</p><p id="y${y}_annualCashOnCash" class="v">N/A</p></article>
        <article class="year-live-item"><p class="k">Other Income Ratio</p><p id="y${y}_otherIncomeRatio" class="v">N/A</p></article>
        <article class="year-live-item"><p class="k">Expense Ratio</p><p id="y${y}_expenseRatio" class="v">N/A</p></article>
      </div>
    </section>
  `;
}

function makeYearInputs() {
  yearsWrap.innerHTML = YEARS.map((year) => yearSectionMarkup(year)).join("");
}

async function downloadPdf(data) {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const currencyRow = (label, value, bold = false) => ({ label, value, display: fmtCurrency(value), bold });
  const percentRow = (label, value, bold = false) => ({ label, value, display: fmtPercentFromRatio(value), bold });
  const rawPercentRow = (label, value, bold = false) => ({ label, value, display: `${Number(value).toFixed(2)}%`, bold });
  const numberRow = (label, value, bold = false) => ({ label, value, display: fmtNumber(value), bold });

  const reportSections = [
    {
      title: "EXECUTIVE SUMMARY",
      rows: [
        currencyRow("Total Capital Raise", data.input.assumptions.totalCapitalRaise),
        numberRow("Average DSCR", data.metrics.averageDscr),
        currencyRow(`Year ${data.metrics.finalYear} NOI`, data.metrics.finalYearNoi),
        currencyRow("Estimated Sale Price", data.metrics.estimatedSalePrice),
        currencyRow("LP Investor Profit", data.metrics.totalInvestorProfit),
        percentRow("Average Annual Cash on Cash", data.metrics.averageCashOnCashReturn),
        percentRow("Investor IRR", data.metrics.investorIrr, true)
      ]
    },
    {
      title: "SALE ANALYSIS",
      rows: [
        rawPercentRow("Projected Cap Rate at Sale", data.input.assumptions.projectedCapRateAtSalePct),
        currencyRow("Sale Of Property", data.sale.saleValue),
        currencyRow("Less Debt", -data.input.assumptions.projectedLoanAtSale),
        currencyRow("Less Closing Costs", -data.input.assumptions.projectedClosingCostsAtSale),
        currencyRow("Investor Capital", -data.input.assumptions.totalCapitalRaise),
        currencyRow("Proceeds", data.sale.profitAfterCapital, true),
        rawPercentRow("GP Split of Profit", data.input.assumptions.gpSplitProfitPct),
        rawPercentRow("LP Split of Profit", data.input.assumptions.lpSplitProfitPct),
        currencyRow("Cashflow to LP", data.sale.lpProfitShare),
        currencyRow("Cashflow to GP", data.sale.gpProfitShare)
      ]
    },
    {
      title: "IRR CALCULATION",
      rows: [
        currencyRow("Initial Capital Investment", data.irr.cashFlows[0]),
        ...YEARS.map((year, index) => currencyRow(`Yr ${year}`, data.irr.cashFlows[index + 1])),
        percentRow("IRR Calculation", data.irr.value, true)
      ]
    }
  ];

  const comparisonPeriods = [data.historical, ...YEARS.map((year) => data.projected[year])];
  const comparisonTable = {
    title: "DEBT SERVICE COVERAGE RATIO ANALYSIS (DSCR)",
    headers: ["Historical T12", ...YEARS.map((year) => `Projected Yr ${year}`)],
    rows: [
      { label: "Rents", values: comparisonPeriods.map((p) => fmtCurrency(p.rentIncome)) },
      { label: "Other Income", values: comparisonPeriods.map((p) => fmtCurrency(p.otherIncome)) },
      { label: "Other Income Ratio", values: comparisonPeriods.map((p) => fmtPercentFromRatio(p.otherIncomeRatio)) },
      { label: "Net Income", values: comparisonPeriods.map((p) => fmtCurrency(p.netIncome)) },
      { label: "Expenses", values: comparisonPeriods.map((p) => fmtCurrency(p.operatingExpenses)) },
      { label: "Expense Ratio", values: comparisonPeriods.map((p) => fmtPercentFromRatio(p.expenseRatio)) },
      { label: "NOI", values: comparisonPeriods.map((p) => fmtCurrency(p.noi)), bold: true },
      { label: "Debt Payment", values: comparisonPeriods.map((p) => fmtCurrency(p.debtPayment)) },
      { label: "Actual DSCR", values: comparisonPeriods.map((p) => fmtNumber(p.dscr)), bold: true },
      { label: "Cash Flow", values: comparisonPeriods.map((p) => fmtCurrency(p.cashFlow)) },
      { label: "Asset Management Fee", values: comparisonPeriods.map((p) => fmtCurrency(p.assetManagementFee)) },
      { label: "Net Cash Flow", values: comparisonPeriods.map((p) => fmtCurrency(p.netCashFlow)) },
      {
        label: "Cash Flow to LP",
        values: comparisonPeriods.map((p) => `${fmtCurrency(p.cashFlowToLP)} | ${Number(p.cashFlowToLPPct || 0).toFixed(0)}%`)
      },
      {
        label: "Cash Flow to GP",
        values: comparisonPeriods.map((p) => `${fmtCurrency(p.cashFlowToGP)} | ${Number(p.cashFlowToGPPct || 0).toFixed(0)}%`)
      },
      { label: "Annual Cash on Cash", values: comparisonPeriods.map((p) => fmtPercentFromRatio(p.cashOnCashReturn)) }
    ]
  };

  const payload = {
    file_name: `DSCR Report - ${data.input.propertyName}.pdf`,
    meta: {
      client_name: data.input.fullName,
      client_email: data.input.email,
      net_worth: data.metrics.totalInvestorProfit || 0
    },
    payload: {
      details: {
        date: today,
        property_name: data.input.propertyName,
        client_name: data.input.fullName,
        name: data.input.fullName,
        email: data.input.email
      },
      comparison_table: comparisonTable,
      report_sections: reportSections,
      chart_series: [
        {
          title: "NOI Growth",
          values: YEARS.map((year) => ({ label: `Yr ${year}`, value: data.projected[year].noi, display: fmtCurrency(data.projected[year].noi) }))
        },
        {
          title: "DSCR Trend",
          values: YEARS.map((year) => ({ label: `Yr ${year}`, value: data.projected[year].dscr || 0, display: fmtNumber(data.projected[year].dscr) }))
        },
        {
          title: "Cash Flow to LP",
          values: YEARS.map((year) => ({ label: `Yr ${year}`, value: data.projected[year].cashFlowToLP, display: fmtCurrency(data.projected[year].cashFlowToLP) }))
        }
      ]
    }
  };

  const res = await fetch("/api/reports/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error("PDF failed");

  const blob = await res.blob();
  const fileName = res.headers.get("X-Report-File") || "DSCR Report.pdf";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function attachEvents() {
  const pdfValidationError = document.getElementById("pdfValidationError");

  const clearPdfValidation = () => {
    document.querySelectorAll("input.input-error").forEach((input) => {
      input.classList.remove("input-error");
      input.removeAttribute("aria-invalid");
    });
    pdfValidationError.hidden = true;
    pdfValidationError.textContent = "";
    delete pdfValidationError.dataset.fieldId;
  };

  const showPdfValidation = (validation) => {
    clearPdfValidation();
    pdfValidationError.textContent = `PDF cannot be downloaded. ${validation.message}`;
    pdfValidationError.dataset.fieldId = validation.fieldId;
    pdfValidationError.hidden = false;

    const input = document.getElementById(validation.fieldId);
    if (input) {
      input.classList.add("input-error");
      input.setAttribute("aria-invalid", "true");
      input.focus({ preventScroll: true });
    }
  };

  const recalculate = (showReadyMessage = false) => {
    const input = collectInputs();
    const data = runAnalysis(input);
    renderAll(data);
    const error = validateInput(input);
    if (error) {
      setStatus(error.message, true);
    } else if (showReadyMessage) {
      setStatus("Analysis updated.");
    } else {
      setStatus("");
    }
  };

  const syncYearSplit = (lpInput) => {
    const year = lpInput.dataset.year;
    const gpInput = document.getElementById(`y${year}_cashFlowToGPPct`);
    const lp = clampPct(lpInput.value);
    const gp = 100 - lp;
    lpInput.value = lp.toString();
    if (gpInput) gpInput.value = gp.toString();
  };

  const syncSaleSplit = (changedInput) => {
    const gpInput = document.getElementById("gpSplitProfitPct");
    const lpInput = document.getElementById("lpSplitProfitPct");
    const value = clampPct(changedInput.value);
    const complement = Number((100 - value).toFixed(2));
    changedInput.value = value.toString();

    if (changedInput === gpInput) {
      lpInput.value = complement.toString();
    } else {
      gpInput.value = complement.toString();
    }
  };

  const bindSaleSplits = () => {
    const gpInput = document.getElementById("gpSplitProfitPct");
    const lpInput = document.getElementById("lpSplitProfitPct");

    [gpInput, lpInput].forEach((input) => {
      input.dataset.liveBound = "true";
      input.addEventListener("input", () => {
        syncSaleSplit(input);
        recalculate(false);
      });
    });

    syncSaleSplit(lpInput);
  };

  const bindCurrencyInput = (input) => {
    if (input.dataset.currencyBound === "true") return;
    input.dataset.currencyBound = "true";
    formatCurrencyInput(input, false);

    input.addEventListener("focus", () => {
      if (num(input.id) === 0) input.value = "";
    });

    input.addEventListener("input", () => {
      formatCurrencyInput(input, true);
      input.setSelectionRange(input.value.length, input.value.length);
      recalculate(false);
    });

    input.addEventListener("blur", () => {
      formatCurrencyInput(input, false);
      recalculate(false);
    });
  };

  const bindInputScope = (scope) => {
    scope.querySelectorAll(".lp-split-input").forEach((lpInput) => {
      if (lpInput.dataset.splitBound !== "true") {
        lpInput.dataset.splitBound = "true";
        lpInput.addEventListener("input", () => {
          syncYearSplit(lpInput);
          recalculate(false);
        });
      }
      syncYearSplit(lpInput);
    });

    scope.querySelectorAll(".currency-input").forEach((input) => bindCurrencyInput(input));

    scope.querySelectorAll("input").forEach((input) => {
      if (input.dataset.liveBound === "true") return;
      if (input.id.includes("_cashFlowToLPPct")) return;
      if (input.id.includes("_cashFlowToGPPct")) return;
      if (input.classList.contains("currency-input")) return;
      input.dataset.liveBound = "true";
      input.addEventListener("input", () => recalculate(false));
    });
  };

  const updateYearControls = () => {
    const finalYear = YEARS[YEARS.length - 1];
    const addButton = document.getElementById("addProjectedYear");
    const yearCount = document.getElementById("projectedYearCount");
    addButton.disabled = YEARS.length >= MAX_PROJECTED_YEARS;
    addButton.textContent = addButton.disabled ? "Maximum 10 Years Added" : "+ Add Projected Year";
    yearCount.textContent = `${YEARS.length} of ${MAX_PROJECTED_YEARS} years`;
    document.querySelectorAll(".year-remove-btn").forEach((button) => {
      button.hidden = Number(button.dataset.removeYear) !== finalYear;
    });
  };

  bindSaleSplits();
  bindInputScope(document);
  updateYearControls();

  document.getElementById("addProjectedYear").addEventListener("click", () => {
    if (YEARS.length >= MAX_PROJECTED_YEARS) return;
    const nextYear = YEARS.length + 1;
    YEARS.push(nextYear);
    yearsWrap.insertAdjacentHTML("beforeend", yearSectionMarkup(nextYear));
    const section = yearsWrap.querySelector(`[data-year-section="${nextYear}"]`);
    bindInputScope(section);
    updateYearControls();
    recalculate(true);
  });

  yearsWrap.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".year-remove-btn");
    if (!removeButton) return;
    const year = Number(removeButton.dataset.removeYear);
    if (year !== YEARS[YEARS.length - 1] || YEARS.length <= MIN_PROJECTED_YEARS) return;
    yearsWrap.querySelector(`[data-year-section="${year}"]`).remove();
    YEARS.pop();
    updateYearControls();
    recalculate(true);
  });

  document.getElementById("downloadPdf").addEventListener("click", async () => {
    const input = collectInputs();
    const error = validateInput(input);
    if (error) {
      setStatus(error.message, true);
      showPdfValidation(error);
      return;
    }

    try {
      clearPdfValidation();
      setStatus("Generating PDF...");
      const data = runAnalysis(input);
      await downloadPdf(data);
      setStatus("PDF downloaded.");
    } catch {
      setStatus("Could not generate PDF.", true);
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.id === pdfValidationError.dataset.fieldId) clearPdfValidation();
  });

  recalculate(true);
}

makeYearInputs();
attachEvents();



