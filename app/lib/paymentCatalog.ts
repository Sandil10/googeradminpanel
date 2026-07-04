const PR = "https://raw.githubusercontent.com/payrexx/payment-logos/main/assets/card-icons/";

export interface CatalogEntry {
  id: string;
  name: string;
  svgFile: string | null;
  domain: string | null;
  color: string;
}

export const PAYMENT_CATALOG: CatalogEntry[] = [
  { id: "paypal",        name: "PayPal",            svgFile: "card_paypal.svg",              domain: "paypal.com",          color: "#0070ba" },
  { id: "skrill",        name: "Skrill",             svgFile: "card_skrill_sofort.svg",       domain: "skrill.com",          color: "#862165" },
  { id: "neteller",      name: "Neteller",           svgFile: "card_neteller.svg",            domain: "neteller.com",        color: "#8b0000" },
  { id: "payoneer",      name: "Payoneer",           svgFile: null,                           domain: "payoneer.com",        color: "#ff4800" },
  { id: "wise",          name: "Wise",               svgFile: null,                           domain: "wise.com",            color: "#9fe870" },
  { id: "amazon_pay",    name: "Amazon Pay",         svgFile: "card_amazon_pay.svg",          domain: "pay.amazon.com",      color: "#ff9900" },
  { id: "paysafecard",   name: "PaySafeCard",        svgFile: "card_paysafecard.svg",         domain: "paysafecard.com",     color: "#003c96" },
  { id: "qiwi",          name: "QIWI",               svgFile: "card_qiwi.svg",                domain: "qiwi.com",            color: "#ff8c00" },
  { id: "bank_transfer", name: "Bank Transfer",      svgFile: "card_bank-transfer.svg",       domain: "swift.com",           color: "#1a73e8" },
  { id: "sepa",          name: "SEPA Direct Debit",  svgFile: "card_sepa-direct-debit.svg",   domain: null,                  color: "#003399" },
  { id: "direct_debit",  name: "Direct Debit",       svgFile: "card_direct_debit.svg",        domain: null,                  color: "#2c5f8a" },
  { id: "trustly",       name: "Trustly",            svgFile: "card_trustly.svg",             domain: "trustly.com",         color: "#0ee06e" },
  { id: "binance",       name: "Binance",            svgFile: null,                           domain: "binance.com",         color: "#f0b90b" },
  { id: "bitcoin",       name: "Bitcoin",            svgFile: "card_bitcoin.svg",             domain: "bitcoin.org",         color: "#f7931a" },
  { id: "ethereum",      name: "Ethereum",           svgFile: "card_ethereum.svg",            domain: "ethereum.org",        color: "#627eea" },
  { id: "usdt",          name: "USDT (Tether)",      svgFile: null,                           domain: "tether.to",           color: "#26a17b" },
  { id: "litecoin",      name: "Litecoin",           svgFile: "card_litecoin.svg",            domain: "litecoin.org",        color: "#a6a9aa" },
  { id: "ripple",        name: "Ripple (XRP)",        svgFile: "card_ripple.svg",              domain: "ripple.com",          color: "#00aae4" },
  { id: "coinbase",      name: "Coinbase",           svgFile: "card_coinbase.svg",            domain: "coinbase.com",        color: "#0052ff" },
  { id: "trust_wallet",  name: "Trust Wallet",       svgFile: null,                           domain: "trustwallet.com",     color: "#3375bb" },
  { id: "visa",          name: "Visa",               svgFile: "card_visa.svg",                domain: "visa.com",            color: "#1a1f71" },
  { id: "mastercard",    name: "Mastercard",         svgFile: "card_mastercard.svg",          domain: "mastercard.com",      color: "#eb001b" },
  { id: "amex",          name: "American Express",   svgFile: "card_american-express.svg",    domain: "americanexpress.com", color: "#007bc1" },
];

/** Resolve a catalog entry by its icon ID. Returns a fallback entry if not found. */
export function getCatalogEntry(iconId: string): CatalogEntry {
  return (
    PAYMENT_CATALOG.find(c => c.id === iconId) ||
    PAYMENT_CATALOG.find(c => c.name.toLowerCase() === iconId.toLowerCase()) || {
      id: iconId, name: iconId, svgFile: null, domain: null, color: "#6b7280",
    }
  );
}

/** Build the logo URL from a catalog entry (PayRexx SVG first). */
export function logoUrl(entry: CatalogEntry, tried?: "svgFailed"): string | null {
  if (!tried && entry.svgFile) return `${PR}${entry.svgFile}`;
  if (entry.domain) return `https://logo.clearbit.com/${entry.domain}`;
  return null;
}
