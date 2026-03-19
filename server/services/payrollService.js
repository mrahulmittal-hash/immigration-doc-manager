/**
 * Canadian Payroll Calculation Service
 * Implements 2024 Federal + Provincial tax brackets, CPP, EI
 */

// ── Federal Tax Brackets (2024) ─────────────────────────────
const FEDERAL_BRACKETS = [
  { limit: 55867, rate: 0.15 },
  { limit: 111733, rate: 0.205 },
  { limit: 154906, rate: 0.26 },
  { limit: 220000, rate: 0.29 },
  { limit: Infinity, rate: 0.33 },
];
const FEDERAL_BPA = 15705; // Basic Personal Amount 2024

// ── Provincial Tax Brackets ─────────────────────────────────
const PROVINCIAL_BRACKETS = {
  ON: {
    brackets: [
      { limit: 51446, rate: 0.0505 },
      { limit: 102894, rate: 0.0915 },
      { limit: 150000, rate: 0.1116 },
      { limit: 220000, rate: 0.1216 },
      { limit: Infinity, rate: 0.1316 },
    ],
    bpa: 11141,
    bpaRate: 0.0505,
  },
  BC: {
    brackets: [
      { limit: 45654, rate: 0.0506 },
      { limit: 91310, rate: 0.077 },
      { limit: 104835, rate: 0.105 },
      { limit: 127299, rate: 0.1229 },
      { limit: 172602, rate: 0.147 },
      { limit: 240716, rate: 0.168 },
      { limit: Infinity, rate: 0.205 },
    ],
    bpa: 11981,
    bpaRate: 0.0506,
  },
  AB: {
    brackets: [
      { limit: 142292, rate: 0.10 },
      { limit: 170751, rate: 0.12 },
      { limit: 227668, rate: 0.13 },
      { limit: 341502, rate: 0.14 },
      { limit: Infinity, rate: 0.15 },
    ],
    bpa: 21003,
    bpaRate: 0.10,
  },
};

// ── CPP Rates (2024) ────────────────────────────────────────
const CPP = {
  rate: 0.0595,
  basicExemption: 3500,
  maxPensionableEarnings: 68500,
  maxContribution: 3867.50,
};

// ── EI Rates (2024) ─────────────────────────────────────────
const EI = {
  employeeRate: 0.0163,
  maxInsurableEarnings: 63200,
  maxPremium: 1002.45,
  employerMultiplier: 1.4,
};

// ── Pay Frequency Periods ───────────────────────────────────
const PAY_PERIODS = {
  weekly: 52,
  biweekly: 26,
  'semi-monthly': 24,
  monthly: 12,
};

/**
 * Calculate progressive tax using brackets
 */
function calculateBracketTax(income, brackets) {
  let tax = 0;
  let prev = 0;
  for (const bracket of brackets) {
    const taxable = Math.min(income, bracket.limit) - prev;
    if (taxable <= 0) break;
    tax += taxable * bracket.rate;
    prev = bracket.limit;
  }
  return Math.max(0, tax);
}

/**
 * Calculate annual federal tax
 */
function calculateFederalTax(annualIncome) {
  if (annualIncome <= 0) return 0;
  const grossTax = calculateBracketTax(annualIncome, FEDERAL_BRACKETS);
  const bpaCredit = FEDERAL_BPA * 0.15; // BPA at lowest rate
  return Math.max(0, grossTax - bpaCredit);
}

/**
 * Calculate annual provincial tax
 */
function calculateProvincialTax(annualIncome, province = 'ON') {
  if (annualIncome <= 0) return 0;
  const prov = PROVINCIAL_BRACKETS[province] || PROVINCIAL_BRACKETS.ON;
  const grossTax = calculateBracketTax(annualIncome, prov.brackets);
  const bpaCredit = prov.bpa * prov.bpaRate;
  return Math.max(0, grossTax - bpaCredit);
}

/**
 * Calculate annual CPP contributions (employee + employer)
 */
function calculateCPP(annualIncome) {
  if (annualIncome <= CPP.basicExemption) return { employee: 0, employer: 0 };
  const pensionable = Math.min(annualIncome, CPP.maxPensionableEarnings) - CPP.basicExemption;
  const employee = Math.min(pensionable * CPP.rate, CPP.maxContribution);
  const employer = employee; // 1:1 match
  return { employee, employer };
}

/**
 * Calculate annual EI premiums (employee + employer)
 */
function calculateEI(annualIncome) {
  if (annualIncome <= 0) return { employee: 0, employer: 0 };
  const insurable = Math.min(annualIncome, EI.maxInsurableEarnings);
  const employee = Math.min(insurable * EI.employeeRate, EI.maxPremium);
  const employer = employee * EI.employerMultiplier;
  return { employee, employer };
}

/**
 * Main payroll calculation
 * @param {Object} params
 * @param {number} params.hours - Hours worked this period
 * @param {number} params.hourlyRate - Hourly wage rate
 * @param {string} params.province - Province code (ON, BC, AB)
 * @param {string} params.payFrequency - weekly, biweekly, semi-monthly, monthly
 * @param {number} [params.otherDeductions=0] - Additional deductions
 * @returns {Object} Full payroll breakdown
 */
function calculatePayroll({ hours, hourlyRate, province = 'ON', payFrequency = 'biweekly', otherDeductions = 0 }) {
  const periods = PAY_PERIODS[payFrequency] || 26;
  const grossPay = parseFloat((hours * hourlyRate).toFixed(2));

  // Annualize for tax calculations
  const annualIncome = grossPay * periods;

  // Annual calculations
  const annualFedTax = calculateFederalTax(annualIncome);
  const annualProvTax = calculateProvincialTax(annualIncome, province);
  const annualCPP = calculateCPP(annualIncome);
  const annualEI = calculateEI(annualIncome);

  // Pro-rate back to pay period
  const r = (v) => parseFloat((v / periods).toFixed(2));

  const federal_tax = r(annualFedTax);
  const provincial_tax = r(annualProvTax);
  const cpp_employee = r(annualCPP.employee);
  const ei_employee = r(annualEI.employee);
  const cpp_employer = r(annualCPP.employer);
  const ei_employer = r(annualEI.employer);

  const total_deductions = parseFloat((federal_tax + provincial_tax + cpp_employee + ei_employee + otherDeductions).toFixed(2));
  const net_pay = parseFloat((grossPay - total_deductions).toFixed(2));

  // Total cost to worker = gross + employer CPP + employer EI
  const total_employer_cost = parseFloat((grossPay + cpp_employer + ei_employer).toFixed(2));

  return {
    gross_pay: grossPay,
    federal_tax,
    provincial_tax,
    cpp_employee,
    ei_employee,
    other_deductions: otherDeductions,
    total_deductions,
    net_pay,
    cpp_employer,
    ei_employer,
    total_employer_cost,
    // Breakdown metadata
    annual_income: annualIncome,
    pay_periods: periods,
  };
}

module.exports = {
  calculatePayroll,
  calculateFederalTax,
  calculateProvincialTax,
  calculateCPP,
  calculateEI,
};
