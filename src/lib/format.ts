/** Format an integer amount of the smallest currency unit as a display string. */
export function formatPrice(cents: number, currency = "mad"): string {
  const amount = cents / 100;

  // Moroccan Dirham — displayed as "165 DH" (no forced decimals for whole values).
  if (currency.toLowerCase() === "mad") {
    const hasFraction = Math.round(amount * 100) % 100 !== 0;
    return `${amount.toLocaleString("en-US", {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    })} DH`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
}
