// ============================================================================
// @lifeos/utils — German tax calculation (Germany, year 2024/2025 values)
// ----------------------------------------------------------------------------
// Implements §32a EStG (income tax formula), Pauschbeträge, and a simplified
// refund estimator. These are estimates — not tax advice. They're accurate
// enough for "should I file a tax return" decisions but not for paying to
// the Finanzamt.
//
// References:
//   * §32a EStG (Einkommensteuertarif)
//   * §33b EStG (Behinderten-Pauschbetrag)
//   * BMF-Schreiben: Fahrtkosten-Pauschbetrag (since 2021)
// ============================================================================

// --- Tax class ---------------------------------------------------------------

export type TaxClass =
  | "CLASS_1"
  | "CLASS_2"
  | "CLASS_3"
  | "CLASS_4"
  | "CLASS_5"
  | "CLASS_6";

// --- Pauschbeträge (flat annual allowances) ---------------------------------

/** §9a Nr. 1 EStG — Arbeitnehmer-Pauschbetrag (Werbungskosten). 2023+: 1.230 €. */
export const WERBUNGSKOSTEN_PAUSCHBETRAG_EUR = 1230;

/** §10c EStG — Sonderausgaben-Pauschbetrag. */
export const SONDERAUSGABEN_PAUSCHBETRAG_EUR = 36;

/** §32a EStG — Grundfreibetrag 2024. Raised to 11.784 €. */
export const GRUNDFREIBETRAG_2024_EUR = 11_784;

// --- Disability Pauschbetrag (§33b EStG, since 2021) ------------------------

const DISABILITY_PAUSCHBETRAG_EUR: Record<number, number> = {
  20: 384,
  30: 620,
  40: 860,
  50: 1_140,
  60: 1_440,
  70: 1_780,
  80: 2_120,
  90: 2_460,
  100: 2_840,
};

/** If one of these Merkzeichen is present, the Pauschbetrag is 7.400 € flat. */
const HELPLESS_PAUSCHBETRAG_EUR = 7_400;

export interface DisabilityInput {
  /** Grad der Behinderung (GdB), e.g. 50, 80, 100. */
  degree: number | null;
  merkzeichenAG: boolean;
  merkzeichenG: boolean;
  merkzeichenH: boolean;
  merkzeichenBl: boolean;
  merkzeichenGl: boolean;
  merkzeichenTBl: boolean;
}

/** Returns the annual disability Pauschbetrag in euros. */
export const disabilityPauschbetrag = (input: DisabilityInput): number => {
  if (input.merkzeichenH || input.merkzeichenBl || input.merkzeichenTBl) {
    return HELPLESS_PAUSCHBETRAG_EUR;
  }
  if (!input.degree) return 0;
  const rounded = Math.floor(input.degree / 10) * 10;
  return DISABILITY_PAUSCHBETRAG_EUR[rounded] ?? 0;
};

/**
 * Behinderten-Fahrtkosten-Pauschbetrag (since 2021, §33 Abs. 2a EStG).
 *   - 900 € for GdB ≥ 80, or GdB ≥ 70 with Merkzeichen G
 *   - 4.500 € for aG, Bl, or H
 */
export const mobilityPauschbetrag = (input: DisabilityInput): number => {
  if (input.merkzeichenAG || input.merkzeichenBl || input.merkzeichenH) {
    return 4_500;
  }
  const degree = input.degree ?? 0;
  if (degree >= 80) return 900;
  if (degree >= 70 && input.merkzeichenG) return 900;
  return 0;
};

// --- §32a EStG — Einkommensteuer 2024 (Grundtarif) --------------------------

/**
 * §32a Abs. 1 EStG 2024 — berechnet die tarifliche Einkommensteuer
 * (Grundtarif) auf das zu versteuernde Einkommen in Euro.
 *
 * 2024 Tarif:
 *   1. bis 11.784 € → 0
 *   2. 11.785 – 17.005 € → (922,98 · y + 1.400) · y,  y = (zvE − 11.784) / 10.000
 *   3. 17.006 – 66.760 € → (181,19 · z + 2.397) · z + 1.025,38,  z = (zvE − 17.005) / 10.000
 *   4. 66.761 – 277.825 € → 0,42 · zvE − 10.602,13
 *   5. ab 277.826 € → 0,45 · zvE − 18.936,88
 */
export const incomeTaxGrundtarif2024 = (zvE: number): number => {
  const income = Math.max(0, Math.floor(zvE));
  if (income <= 11_784) return 0;
  if (income <= 17_005) {
    const y = (income - 11_784) / 10_000;
    return Math.floor((922.98 * y + 1_400) * y);
  }
  if (income <= 66_760) {
    const z = (income - 17_005) / 10_000;
    return Math.floor((181.19 * z + 2_397) * z + 1_025.38);
  }
  if (income <= 277_825) {
    return Math.floor(0.42 * income - 10_602.13);
  }
  return Math.floor(0.45 * income - 18_936.88);
};

/**
 * Splittingtarif (§32a Abs. 5) — for married couples filing jointly
 * (Steuerklasse III + spouse in V, or both in IV with splitting).
 * Formula: 2 × Grundtarif(zvE / 2).
 */
export const incomeTaxSplittingtarif2024 = (zvE: number): number =>
  2 * incomeTaxGrundtarif2024(Math.floor(zvE / 2));

// --- Refund estimator -------------------------------------------------------

export interface RefundInput {
  year: number;
  taxClass: TaxClass;
  churchTax: boolean;
  disability: DisabilityInput;
  /** Gross yearly salary in euros (YTD or projected). */
  grossEur: number;
  /** Lohnsteuer already paid in euros (sum over the year). */
  incomeTaxPaidEur: number;
  /** AN-Anteil Sozialabgaben in euros. If omitted, ~20.5% of gross is estimated. */
  socialContributionsEur?: number;
  /** User-entered Werbungskosten in euros (overrides Pauschbetrag if higher). */
  workExpensesEur: number;
  /** User-entered Sonderausgaben in euros. */
  specialExpensesEur: number;
  /** Außergewöhnliche Belastungen (§33 EStG) in euros. */
  extraordinaryBurdensEur: number;
  /** Donations (§10b EStG) in euros. */
  donationsEur: number;
}

export interface RefundResult {
  /** Taxable income after all deductions. */
  taxableIncomeEur: number;
  /** Tax owed according to §32a EStG. */
  taxOwedEur: number;
  /** Church tax (8-9% of Lohnsteuer) if applicable. */
  churchTaxEur: number;
  /** Solidaritätszuschlag (usually 0 for normal incomes since 2021). */
  solidarityTaxEur: number;
  /** Estimated refund (positive = get money back). */
  refundEur: number;
  /** Breakdown of all allowances that reduced taxable income. */
  deductions: {
    workExpensesEur: number;
    specialExpensesEur: number;
    disabilityPauschbetragEur: number;
    mobilityPauschbetragEur: number;
    extraordinaryBurdensEur: number;
    donationsEur: number;
    total: number;
  };
}

/**
 * Estimate the German tax refund for a single filer. This is intentionally
 * simplified: it assumes Grundtarif for classes I/II/IV/V/VI and
 * Splittingtarif for class III (assumes spouse has no own income).
 *
 * For class V, the Lohnsteuer withholding is already high — if the user hits
 * this path they typically owe instead of getting a refund. We still show
 * the arithmetic honestly.
 */
export const estimateRefund = (input: RefundInput): RefundResult => {
  // 0. Vorsorgepauschale — Sozialabgaben (AN-Anteil) as deduction from gross.
  //    For employed workers the employer already withholds these, and they
  //    reduce the zu versteuerndes Einkommen. We estimate ~20% of gross for
  //    the combined employee share (pension ~9.3%, health ~8.15%, unemployment
  //    ~1.3%, care ~1.7%). If the caller provides actual social contributions,
  //    we use those; otherwise we estimate.
  const socialContributionsEur =
    input.socialContributionsEur ?? input.grossEur * 0.205;

  // 1. Werbungskosten (take the higher of user-entered vs. pauschbetrag)
  const werbungskosten = Math.max(
    WERBUNGSKOSTEN_PAUSCHBETRAG_EUR,
    input.workExpensesEur,
  );

  // 2. Sonderausgaben-Pauschbetrag (§10c) — does NOT include donations.
  //    Donations (§10b) are a separate deduction.
  const sonderausgaben = Math.max(
    SONDERAUSGABEN_PAUSCHBETRAG_EUR,
    input.specialExpensesEur,
  );

  // 3. Spenden (§10b EStG) — separate deduction
  const donations = input.donationsEur;

  // 4. Behinderten-Pauschbetrag (§33b)
  const disabilityP = disabilityPauschbetrag(input.disability);

  // 5. Fahrtkosten-Pauschbetrag (§33 Abs. 2a)
  const mobilityP = mobilityPauschbetrag(input.disability);

  // 6. Außergewöhnliche Belastungen (§33)
  const extraBurdens = input.extraordinaryBurdensEur + mobilityP;

  const totalDeductions =
    werbungskosten +
    sonderausgaben +
    donations +
    disabilityP +
    extraBurdens;

  // zvE = Brutto − Sozialabgaben − Abzüge
  const taxableIncome = Math.max(
    0,
    input.grossEur - socialContributionsEur - totalDeductions,
  );

  let taxOwed: number;
  if (input.taxClass === "CLASS_3") {
    taxOwed = incomeTaxSplittingtarif2024(taxableIncome);
  } else {
    taxOwed = incomeTaxGrundtarif2024(taxableIncome);
  }

  const churchTax = input.churchTax ? Math.round(taxOwed * 0.09) : 0;
  const solidarityTax = 0; // Simplified: Soli is ~0 for incomes below the Freigrenze

  const totalOwed = taxOwed + churchTax + solidarityTax;
  const refund = input.incomeTaxPaidEur - totalOwed;

  return {
    taxableIncomeEur: taxableIncome,
    taxOwedEur: taxOwed,
    churchTaxEur: churchTax,
    solidarityTaxEur: solidarityTax,
    refundEur: refund,
    deductions: {
      workExpensesEur: werbungskosten,
      specialExpensesEur: sonderausgaben,
      disabilityPauschbetragEur: disabilityP,
      mobilityPauschbetragEur: mobilityP,
      extraordinaryBurdensEur: input.extraordinaryBurdensEur,
      donationsEur: donations,
      total: totalDeductions,
    },
  };
};
