// Manual-prepayment instructions shown to customers on /checkout/prepay.
// Set the values in .env.local so account numbers are never hard-coded:
//
//   PREPAY_NAME="Mohamed Hamouchi"
//   PREPAY_ATTIJARI_SIMPLE_RIB="007 ..."   # Attijari "Simple" account RIB
//   PREPAY_ATTIJARI_RIB="007 ..."          # Attijariwafa Bank RIB
//   PREPAY_POPULAIRE_RIB="190 ..."         # Banque Populaire RIB
//   PREPAY_POPULAIRE_IBAN="MA64 ..."       # (optional) Banque Populaire IBAN
//   PREPAY_CASHPLUS_PHONE="06 ..."         # CashPlus / Wafacash phone
//   PREPAY_CASHPLUS_ACCOUNT="8357 ..."     # (optional) CashPlus account number
//
// Any value left blank is simply not shown on the payment page.

export type PrepayMethodType = "bank" | "cash";

export interface PrepayMethod {
  key: string;
  type: PrepayMethodType;
  label: string;
  // Which bank's branding to use for the logo/badge (a file at
  // public/banks/<brand>.{svg,png,webp,jpg} overrides the colored badge).
  brand: string;
  lines: { k: string; v: string; mono?: boolean }[];
  note?: string;
}

export interface PrepayInfo {
  name: string;
  methods: PrepayMethod[];
  configured: boolean;
}

export function getPrepayInfo(): PrepayInfo {
  const name = process.env.PREPAY_NAME?.trim() || "";
  const attijariSimple = process.env.PREPAY_ATTIJARI_SIMPLE_RIB?.trim() || "";
  const attijari = process.env.PREPAY_ATTIJARI_RIB?.trim() || "";
  const bpRib = process.env.PREPAY_POPULAIRE_RIB?.trim() || "";
  const bpIban = process.env.PREPAY_POPULAIRE_IBAN?.trim() || "";
  const cashPhone = process.env.PREPAY_CASHPLUS_PHONE?.trim() || "";
  const cashAccount = process.env.PREPAY_CASHPLUS_ACCOUNT?.trim() || "";

  const beneficiary = name ? [{ k: "Beneficiary", v: name }] : [];
  const methods: PrepayMethod[] = [];

  if (attijariSimple) {
    methods.push({
      key: "attijari-simple",
      type: "bank",
      label: "Simple",
      brand: "simple",
      lines: [{ k: "RIB", v: attijariSimple, mono: true }, ...beneficiary],
    });
  }
  if (attijari) {
    methods.push({
      key: "attijari",
      type: "bank",
      label: "Attijariwafa Bank",
      brand: "attijari",
      lines: [{ k: "RIB", v: attijari, mono: true }, ...beneficiary],
    });
  }
  if (bpRib) {
    methods.push({
      key: "populaire",
      type: "bank",
      label: "Banque Populaire — TISSIR",
      brand: "popular",
      lines: [
        { k: "RIB", v: bpRib, mono: true },
        ...(bpIban ? [{ k: "IBAN", v: bpIban, mono: true }] : []),
        ...beneficiary,
      ],
    });
  }
  if (cashPhone || cashAccount) {
    methods.push({
      key: "cashplus",
      type: "cash",
      label: "CashPlus",
      brand: "cashplus",
      lines: [
        ...(cashPhone ? [{ k: "Send to phone", v: `${cashPhone}${name ? ` (${name})` : ""}` }] : []),
        ...(cashAccount ? [{ k: "Account", v: cashAccount, mono: true }] : []),
      ],
    });
  }

  return { name, methods, configured: methods.length > 0 };
}
