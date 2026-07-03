"use client";

import { useEffect, useState } from "react";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";
import { toManagedMediaUrl } from "../../../utils/mediaUrl";

// ─── PayRexx logos base URL ───────────────────────────────────────────────────
const PR = "https://raw.githubusercontent.com/payrexx/payment-logos/main/assets/card-icons/";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WalletTransaction {
  id: number;
  type: "withdrawal_hold" | "withdrawal_refund";
  amount: string;
  note: string | null;
  status: string;
  created_at: string;
  sender_db_id: number | null;
  sender_username: string | null;
  sender_name: string | null;
  sender_readable_id: string | null;
  sender_pic: string | null;
  receiver_db_id: number | null;
  receiver_username: string | null;
  receiver_name: string | null;
  receiver_readable_id: string | null;
  receiver_pic: string | null;
}

interface WithdrawalRequest {
  id: number;
  user_id: number;
  readable_user_id: string;
  username: string;
  full_name: string;
  email: string;
  user_type: string;
  profile_picture: string | null;
  wallet_balance: string;
  amount: string;
  payment_method_name: string | null;
  payment_details: Record<string, string>;
  status: "Pending" | "Approved" | "Rejected";
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface PaymentMethod {
  id: number;
  name: string;
  icon: string;
  fields: FormField[];
  is_active: boolean;
}

interface FormField {
  key: string;
  label: string;
  type: "text" | "email" | "number";
  required: boolean;
  placeholder: string;
}

interface Settings {
  id: number;
  min_amount: string;
  max_amount: string;
}

interface CatalogItem {
  id: string;
  name: string;
  svgFile: string | null;   // payrexx filename, e.g. "card_paypal.svg"
  domain: string | null;    // clearbit fallback
  category: string;
  color: string;
  defaultFields: FormField[];
}

// ─── Payment Method Catalog (payrexx SVGs) ────────────────────────────────────

const PAYMENT_CATALOG: CatalogItem[] = [
  // ── Wallets ──
  {
    id: "paypal", name: "PayPal", svgFile: "card_paypal.svg", domain: "paypal.com",
    category: "Wallet", color: "#0070ba",
    defaultFields: [
      { key: "paypal_email", label: "PayPal Email", type: "email", required: true,  placeholder: "your@paypal.com" },
      { key: "full_name",    label: "Full Name",    type: "text",  required: true,  placeholder: "Name on PayPal" },
    ],
  },
  {
    id: "skrill", name: "Skrill", svgFile: "card_skrill_sofort.svg", domain: "skrill.com",
    category: "Wallet", color: "#862165",
    defaultFields: [
      { key: "skrill_email", label: "Skrill Email",  type: "email", required: true,  placeholder: "your@skrill.com" },
      { key: "full_name",    label: "Full Name",     type: "text",  required: true,  placeholder: "Full legal name" },
      { key: "country",      label: "Country",       type: "text",  required: true,  placeholder: "e.g. Sri Lanka" },
      { key: "phone",        label: "Phone Number",  type: "text",  required: false, placeholder: "Optional" },
    ],
  },
  {
    id: "neteller", name: "Neteller", svgFile: "card_neteller.svg", domain: "neteller.com",
    category: "Wallet", color: "#8b0000",
    defaultFields: [
      { key: "neteller_email", label: "Neteller Email / ID", type: "email", required: true,  placeholder: "your@neteller.com" },
      { key: "full_name",      label: "Full Name",           type: "text",  required: true,  placeholder: "Full name" },
      { key: "country",        label: "Country",             type: "text",  required: true,  placeholder: "Country" },
    ],
  },
  {
    id: "payoneer", name: "Payoneer", svgFile: null, domain: "payoneer.com",
    category: "Wallet", color: "#ff4800",
    defaultFields: [
      { key: "payoneer_email",      label: "Payoneer Email",      type: "email", required: true,  placeholder: "your@payoneer.com" },
      { key: "account_holder_name", label: "Account Holder Name", type: "text",  required: true,  placeholder: "Full name" },
      { key: "recipient_id",        label: "Recipient ID",        type: "text",  required: false, placeholder: "Optional" },
      { key: "country",             label: "Country",             type: "text",  required: true,  placeholder: "e.g. Sri Lanka" },
      { key: "currency",            label: "Currency",            type: "text",  required: true,  placeholder: "e.g. USD" },
    ],
  },
  {
    id: "wise", name: "Wise", svgFile: null, domain: "wise.com",
    category: "Wallet", color: "#9fe870",
    defaultFields: [
      { key: "wise_email",          label: "Wise Email",           type: "email", required: true,  placeholder: "your@wise.com" },
      { key: "account_holder_name", label: "Account Holder Name",  type: "text",  required: true,  placeholder: "Full name" },
      { key: "bank_country",        label: "Bank Country",         type: "text",  required: true,  placeholder: "e.g. United Kingdom" },
      { key: "currency",            label: "Currency",             type: "text",  required: true,  placeholder: "e.g. GBP" },
      { key: "iban",                label: "IBAN / Account Number",type: "text",  required: true,  placeholder: "GB29NWBK..." },
      { key: "swift_bic",           label: "SWIFT / BIC",         type: "text",  required: false, placeholder: "Optional" },
    ],
  },
  {
    id: "amazon_pay", name: "Amazon Pay", svgFile: "card_amazon_pay.svg", domain: "pay.amazon.com",
    category: "Wallet", color: "#ff9900",
    defaultFields: [
      { key: "email",     label: "Amazon Email", type: "email", required: true, placeholder: "your@amazon.com" },
      { key: "full_name", label: "Full Name",    type: "text",  required: true, placeholder: "Full name" },
    ],
  },
  {
    id: "paysafecard", name: "PaySafeCard", svgFile: "card_paysafecard.svg", domain: "paysafecard.com",
    category: "Wallet", color: "#003c96",
    defaultFields: [
      { key: "card_code", label: "Card Code / PIN", type: "text",  required: true, placeholder: "16-digit code" },
      { key: "email",     label: "Email",           type: "email", required: true, placeholder: "Account email" },
    ],
  },
  {
    id: "qiwi", name: "QIWI", svgFile: "card_qiwi.svg", domain: "qiwi.com",
    category: "Wallet", color: "#ff8c00",
    defaultFields: [
      { key: "phone",     label: "QIWI Phone Number", type: "text", required: true,  placeholder: "+7XXXXXXXXXX" },
      { key: "full_name", label: "Full Name",          type: "text", required: true,  placeholder: "Full name" },
      { key: "country",   label: "Country",            type: "text", required: true,  placeholder: "Country" },
    ],
  },
  // ── Bank ──
  {
    id: "bank_transfer", name: "Bank Transfer", svgFile: "card_bank-transfer.svg", domain: "swift.com",
    category: "Bank", color: "#1a73e8",
    defaultFields: [
      { key: "account_holder_name", label: "Account Holder Name",  type: "text", required: true,  placeholder: "Full name" },
      { key: "bank_name",           label: "Bank Name",            type: "text", required: true,  placeholder: "e.g. Standard Bank" },
      { key: "account_number",      label: "Account Number / IBAN",type: "text", required: true,  placeholder: "e.g. 1234567890" },
      { key: "swift_bic",           label: "SWIFT / BIC Code",    type: "text", required: true,  placeholder: "e.g. SBZAZAJJ" },
      { key: "branch",              label: "Bank Branch",          type: "text", required: false, placeholder: "Optional" },
      { key: "bank_address",        label: "Bank Address",         type: "text", required: false, placeholder: "Optional" },
      { key: "country",             label: "Country",              type: "text", required: true,  placeholder: "e.g. South Africa" },
      { key: "currency",            label: "Currency",             type: "text", required: true,  placeholder: "e.g. ZAR / USD" },
    ],
  },
  {
    id: "sepa", name: "SEPA Direct Debit", svgFile: "card_sepa-direct-debit.svg", domain: null,
    category: "Bank", color: "#003399",
    defaultFields: [
      { key: "account_holder_name", label: "Account Holder Name", type: "text", required: true, placeholder: "Full name" },
      { key: "iban",                label: "IBAN",                type: "text", required: true, placeholder: "DE89370400440532013000" },
      { key: "bic",                 label: "BIC / SWIFT",         type: "text", required: true, placeholder: "e.g. COBADEFFXXX" },
      { key: "country",             label: "Country",             type: "text", required: true, placeholder: "e.g. Germany" },
    ],
  },
  {
    id: "direct_debit", name: "Direct Debit", svgFile: "card_direct_debit.svg", domain: null,
    category: "Bank", color: "#2c5f8a",
    defaultFields: [
      { key: "account_holder_name", label: "Account Holder Name", type: "text", required: true, placeholder: "Full name" },
      { key: "account_number",      label: "Account Number",      type: "text", required: true, placeholder: "e.g. 12345678" },
      { key: "sort_code",           label: "Sort Code / BSB",     type: "text", required: true, placeholder: "e.g. 20-00-00" },
      { key: "bank_name",           label: "Bank Name",           type: "text", required: true, placeholder: "Bank name" },
      { key: "country",             label: "Country",             type: "text", required: true, placeholder: "Country" },
    ],
  },
  {
    id: "trustly", name: "Trustly", svgFile: "card_trustly.svg", domain: "trustly.com",
    category: "Bank", color: "#0ee06e",
    defaultFields: [
      { key: "email",     label: "Email",    type: "email", required: true, placeholder: "your@email.com" },
      { key: "full_name", label: "Full Name",type: "text",  required: true, placeholder: "Full name" },
      { key: "country",   label: "Country",  type: "text",  required: true, placeholder: "Country" },
    ],
  },
  // ── Crypto ──
  {
    id: "binance", name: "Binance", svgFile: null, domain: "binance.com",
    category: "Crypto", color: "#f0b90b",
    defaultFields: [
      { key: "network",        label: "Network",       type: "text",  required: true,  placeholder: "TRC20 / BEP20 / ERC20" },
      { key: "wallet_address", label: "Wallet Address",type: "text",  required: true,  placeholder: "Your wallet address" },
      { key: "account_email",  label: "Account Email", type: "email", required: false, placeholder: "Optional Binance email" },
      { key: "full_name",      label: "Full Name",     type: "text",  required: true,  placeholder: "Full name" },
      { key: "country",        label: "Country",       type: "text",  required: true,  placeholder: "e.g. Sri Lanka" },
    ],
  },
  {
    id: "bitcoin", name: "Bitcoin", svgFile: "card_bitcoin.svg", domain: "bitcoin.org",
    category: "Crypto", color: "#f7931a",
    defaultFields: [
      { key: "wallet_address", label: "Bitcoin Wallet Address", type: "text", required: true,  placeholder: "bc1q..." },
      { key: "full_name",      label: "Full Name",              type: "text", required: true,  placeholder: "Full name" },
      { key: "country",        label: "Country",                type: "text", required: true,  placeholder: "e.g. Sri Lanka" },
    ],
  },
  {
    id: "ethereum", name: "Ethereum", svgFile: "card_ethereum.svg", domain: "ethereum.org",
    category: "Crypto", color: "#627eea",
    defaultFields: [
      { key: "wallet_address", label: "ETH Wallet Address", type: "text", required: true,  placeholder: "0x..." },
      { key: "network",        label: "Network",            type: "text", required: true,  placeholder: "Mainnet / BSC / Polygon" },
      { key: "full_name",      label: "Full Name",          type: "text", required: true,  placeholder: "Full name" },
      { key: "country",        label: "Country",            type: "text", required: true,  placeholder: "Country" },
    ],
  },
  {
    id: "usdt", name: "USDT (Tether)", svgFile: null, domain: "tether.to",
    category: "Crypto", color: "#26a17b",
    defaultFields: [
      { key: "network",        label: "Network",       type: "text", required: true,  placeholder: "TRC20 / BEP20 / ERC20" },
      { key: "wallet_address", label: "Wallet Address",type: "text", required: true,  placeholder: "Your USDT wallet address" },
      { key: "full_name",      label: "Full Name",     type: "text", required: true,  placeholder: "Full name" },
      { key: "country",        label: "Country",       type: "text", required: true,  placeholder: "e.g. Sri Lanka" },
    ],
  },
  {
    id: "litecoin", name: "Litecoin", svgFile: "card_litecoin.svg", domain: "litecoin.org",
    category: "Crypto", color: "#a6a9aa",
    defaultFields: [
      { key: "wallet_address", label: "Litecoin Address", type: "text", required: true, placeholder: "L..." },
      { key: "full_name",      label: "Full Name",        type: "text", required: true, placeholder: "Full name" },
      { key: "country",        label: "Country",          type: "text", required: true, placeholder: "Country" },
    ],
  },
  {
    id: "ripple", name: "Ripple (XRP)", svgFile: "card_ripple.svg", domain: "ripple.com",
    category: "Crypto", color: "#346aa9",
    defaultFields: [
      { key: "wallet_address", label: "XRP Wallet Address", type: "text", required: true,  placeholder: "r..." },
      { key: "destination_tag",label: "Destination Tag",    type: "text", required: false, placeholder: "Optional tag" },
      { key: "full_name",      label: "Full Name",          type: "text", required: true,  placeholder: "Full name" },
      { key: "country",        label: "Country",            type: "text", required: true,  placeholder: "Country" },
    ],
  },
  {
    id: "coinbase", name: "Coinbase", svgFile: "card_coinbase.svg", domain: "coinbase.com",
    category: "Crypto", color: "#0052ff",
    defaultFields: [
      { key: "email",          label: "Coinbase Email",  type: "email", required: true,  placeholder: "your@coinbase.com" },
      { key: "wallet_address", label: "Wallet Address",  type: "text",  required: false, placeholder: "Optional" },
      { key: "full_name",      label: "Full Name",       type: "text",  required: true,  placeholder: "Full name" },
      { key: "country",        label: "Country",         type: "text",  required: true,  placeholder: "Country" },
    ],
  },
  {
    id: "trust_wallet", name: "Trust Wallet", svgFile: null, domain: "trustwallet.com",
    category: "Crypto", color: "#3375bb",
    defaultFields: [
      { key: "wallet_address", label: "Wallet Address", type: "text", required: true,  placeholder: "Your Trust Wallet address" },
      { key: "network",        label: "Network",        type: "text", required: true,  placeholder: "BSC / ETH / TRX" },
      { key: "full_name",      label: "Full Name",      type: "text", required: true,  placeholder: "Full name" },
    ],
  },
  {
    id: "go_crypto", name: "GoCrypto", svgFile: "card_go-crypto.svg", domain: null,
    category: "Crypto", color: "#00b5e2",
    defaultFields: [
      { key: "wallet_address", label: "Wallet Address", type: "text",  required: true, placeholder: "Wallet address" },
      { key: "email",          label: "Email",          type: "email", required: true, placeholder: "your@email.com" },
    ],
  },
  // ── Cards ──
  {
    id: "visa", name: "Visa", svgFile: "card_visa.svg", domain: "visa.com",
    category: "Card", color: "#1a1f71",
    defaultFields: [
      { key: "cardholder_name", label: "Cardholder Name", type: "text", required: true, placeholder: "Name on card" },
      { key: "account_number",  label: "Last 4 Digits",   type: "text", required: true, placeholder: "e.g. 4242" },
      { key: "country",         label: "Country",         type: "text", required: true, placeholder: "Billing country" },
    ],
  },
  {
    id: "mastercard", name: "Mastercard", svgFile: "card_mastercard.svg", domain: "mastercard.com",
    category: "Card", color: "#eb001b",
    defaultFields: [
      { key: "cardholder_name", label: "Cardholder Name", type: "text", required: true, placeholder: "Name on card" },
      { key: "account_number",  label: "Last 4 Digits",   type: "text", required: true, placeholder: "e.g. 5555" },
      { key: "country",         label: "Country",         type: "text", required: true, placeholder: "Billing country" },
    ],
  },
  {
    id: "amex", name: "Amex", svgFile: "card_american-express.svg", domain: "americanexpress.com",
    category: "Card", color: "#007bc1",
    defaultFields: [
      { key: "cardholder_name", label: "Cardholder Name", type: "text", required: true, placeholder: "Name on card" },
      { key: "account_number",  label: "Last 4 Digits",   type: "text", required: true, placeholder: "e.g. 3782" },
      { key: "country",         label: "Country",         type: "text", required: true, placeholder: "Billing country" },
    ],
  },
  {
    id: "maestro", name: "Maestro", svgFile: "card_maestro.svg", domain: null,
    category: "Card", color: "#0099df",
    defaultFields: [
      { key: "cardholder_name", label: "Cardholder Name", type: "text", required: true, placeholder: "Name on card" },
      { key: "account_number",  label: "Last 4 Digits",   type: "text", required: true, placeholder: "e.g. 6759" },
      { key: "country",         label: "Country",         type: "text", required: true, placeholder: "Country" },
    ],
  },
  {
    id: "discover", name: "Discover", svgFile: "card_discover.svg", domain: "discover.com",
    category: "Card", color: "#ff6600",
    defaultFields: [
      { key: "cardholder_name", label: "Cardholder Name", type: "text", required: true, placeholder: "Name on card" },
      { key: "account_number",  label: "Last 4 Digits",   type: "text", required: true, placeholder: "e.g. 6011" },
      { key: "country",         label: "Country",         type: "text", required: true, placeholder: "Billing country" },
    ],
  },
  {
    id: "jcb", name: "JCB", svgFile: "card_jcb.svg", domain: "jcb.co.jp",
    category: "Card", color: "#003087",
    defaultFields: [
      { key: "cardholder_name", label: "Cardholder Name", type: "text", required: true, placeholder: "Name on card" },
      { key: "account_number",  label: "Last 4 Digits",   type: "text", required: true, placeholder: "e.g. 3530" },
      { key: "country",         label: "Country",         type: "text", required: true, placeholder: "Country" },
    ],
  },
  {
    id: "diners", name: "Diners Club", svgFile: "card_diners-club.svg", domain: "dinersclub.com",
    category: "Card", color: "#004a97",
    defaultFields: [
      { key: "cardholder_name", label: "Cardholder Name", type: "text", required: true, placeholder: "Name on card" },
      { key: "account_number",  label: "Last 4 Digits",   type: "text", required: true, placeholder: "e.g. 3000" },
      { key: "country",         label: "Country",         type: "text", required: true, placeholder: "Country" },
    ],
  },
  {
    id: "unionpay", name: "UnionPay", svgFile: "card_unionpay.svg", domain: "unionpayintl.com",
    category: "Card", color: "#e21836",
    defaultFields: [
      { key: "cardholder_name", label: "Cardholder Name", type: "text", required: true, placeholder: "Name on card" },
      { key: "account_number",  label: "Last 4 Digits",   type: "text", required: true, placeholder: "e.g. 6250" },
      { key: "country",         label: "Country",         type: "text", required: true, placeholder: "Country" },
    ],
  },
  // ── Digital ──
  {
    id: "google_pay", name: "Google Pay", svgFile: "card_google-pay.svg", domain: "pay.google.com",
    category: "Digital", color: "#4285f4",
    defaultFields: [
      { key: "email_or_phone", label: "Email or Phone", type: "text",  required: true, placeholder: "Linked Google Pay account" },
      { key: "full_name",      label: "Full Name",      type: "text",  required: true, placeholder: "Full name" },
    ],
  },
  {
    id: "apple_pay", name: "Apple Pay", svgFile: "card_apple-pay.svg", domain: "apple.com",
    category: "Digital", color: "#555",
    defaultFields: [
      { key: "apple_id_email", label: "Apple ID Email", type: "email", required: true, placeholder: "Apple ID email" },
      { key: "full_name",      label: "Full Name",       type: "text", required: true, placeholder: "Full name" },
    ],
  },
  {
    id: "samsung_pay", name: "Samsung Pay", svgFile: "card_samsung-pay.svg", domain: "samsung.com",
    category: "Digital", color: "#1428a0",
    defaultFields: [
      { key: "email",     label: "Samsung Account Email", type: "email", required: true, placeholder: "Samsung account email" },
      { key: "full_name", label: "Full Name",             type: "text",  required: true, placeholder: "Full name" },
    ],
  },
  {
    id: "wechat_pay", name: "WeChat Pay", svgFile: "card_wechat-pay.svg", domain: "weixin.qq.com",
    category: "Digital", color: "#07c160",
    defaultFields: [
      { key: "wechat_id", label: "WeChat ID",  type: "text", required: true, placeholder: "WeChat username / ID" },
      { key: "full_name", label: "Full Name",  type: "text", required: true, placeholder: "Full name" },
      { key: "country",   label: "Country",    type: "text", required: true, placeholder: "Country" },
    ],
  },
  {
    id: "alipay", name: "Alipay", svgFile: "card_alipay.svg", domain: "alipay.com",
    category: "Digital", color: "#1677ff",
    defaultFields: [
      { key: "alipay_account", label: "Alipay Account", type: "text",  required: true, placeholder: "Email or phone" },
      { key: "full_name",      label: "Full Name",      type: "text",  required: true, placeholder: "Full name" },
      { key: "country",        label: "Country",        type: "text",  required: true, placeholder: "Country" },
    ],
  },
  // ── Gateway ──
  {
    id: "stripe", name: "Stripe", svgFile: "card_stripe.svg", domain: "stripe.com",
    category: "Gateway", color: "#635bff",
    defaultFields: [
      { key: "email",     label: "Email Address", type: "email", required: true, placeholder: "your@email.com" },
      { key: "full_name", label: "Full Name",     type: "text",  required: true, placeholder: "Full name" },
      { key: "country",   label: "Country",       type: "text",  required: true, placeholder: "Country" },
    ],
  },
  {
    id: "klarna", name: "Klarna", svgFile: "card_klarna.svg", domain: "klarna.com",
    category: "Gateway", color: "#ffb3c7",
    defaultFields: [
      { key: "email",     label: "Email",     type: "email", required: true, placeholder: "your@email.com" },
      { key: "full_name", label: "Full Name", type: "text",  required: true, placeholder: "Full name" },
      { key: "country",   label: "Country",   type: "text",  required: true, placeholder: "Country" },
    ],
  },
  {
    id: "braintree", name: "Braintree", svgFile: "card_braintree.svg", domain: "braintreepayments.com",
    category: "Gateway", color: "#009cde",
    defaultFields: [
      { key: "email",     label: "Email",     type: "email", required: true, placeholder: "your@email.com" },
      { key: "full_name", label: "Full Name", type: "text",  required: true, placeholder: "Full name" },
    ],
  },
  // ── Local ──
  {
    id: "ideal", name: "iDEAL", svgFile: "card_ideal.svg", domain: "ideal.nl",
    category: "Local", color: "#cc0066",
    defaultFields: [
      { key: "bank_name",           label: "Bank Name",           type: "text",  required: true, placeholder: "e.g. ING / ABN AMRO" },
      { key: "account_holder_name", label: "Account Holder Name", type: "text",  required: true, placeholder: "Full name" },
      { key: "iban",                label: "IBAN",                type: "text",  required: true, placeholder: "NL..." },
    ],
  },
  {
    id: "bancontact", name: "Bancontact", svgFile: "card_bancontact.svg", domain: null,
    category: "Local", color: "#005499",
    defaultFields: [
      { key: "account_holder_name", label: "Account Holder Name", type: "text", required: true, placeholder: "Full name" },
      { key: "iban",                label: "IBAN",                type: "text", required: true, placeholder: "BE..." },
      { key: "bic",                 label: "BIC",                 type: "text", required: true, placeholder: "e.g. GEBABEBB" },
    ],
  },
  {
    id: "giropay", name: "Giropay", svgFile: "card_giropay.svg", domain: null,
    category: "Local", color: "#000268",
    defaultFields: [
      { key: "account_holder_name", label: "Account Holder Name", type: "text", required: true, placeholder: "Full name" },
      { key: "iban",                label: "IBAN",                type: "text", required: true, placeholder: "DE..." },
      { key: "bic",                 label: "BIC",                 type: "text", required: true, placeholder: "BIC code" },
    ],
  },
  {
    id: "sofort", name: "Sofort", svgFile: "card_sofort.svg", domain: "sofort.com",
    category: "Local", color: "#ef3b24",
    defaultFields: [
      { key: "account_holder_name", label: "Account Holder Name", type: "text", required: true, placeholder: "Full name" },
      { key: "iban",                label: "IBAN",                type: "text", required: true, placeholder: "DE..." },
      { key: "country",             label: "Country",             type: "text", required: true, placeholder: "e.g. Germany" },
    ],
  },
  {
    id: "eps", name: "EPS", svgFile: "card_eps.svg", domain: null,
    category: "Local", color: "#c8161d",
    defaultFields: [
      { key: "account_holder_name", label: "Account Holder Name", type: "text", required: true, placeholder: "Full name" },
      { key: "iban",                label: "IBAN",                type: "text", required: true, placeholder: "AT..." },
      { key: "bic",                 label: "BIC",                 type: "text", required: true, placeholder: "BIC code" },
    ],
  },
  {
    id: "przelewy24", name: "Przelewy24", svgFile: "card_przelewy24.svg", domain: "przelewy24.pl",
    category: "Local", color: "#d8192b",
    defaultFields: [
      { key: "email",     label: "Email",     type: "email", required: true, placeholder: "your@email.com" },
      { key: "full_name", label: "Full Name", type: "text",  required: true, placeholder: "Full name" },
      { key: "bank_name", label: "Bank Name", type: "text",  required: true, placeholder: "Polish bank name" },
    ],
  },
  {
    id: "twint", name: "TWINT", svgFile: "card_twint.svg", domain: "twint.ch",
    category: "Local", color: "#000000",
    defaultFields: [
      { key: "phone",     label: "Swiss Phone Number", type: "text", required: true, placeholder: "+41XXXXXXXXX" },
      { key: "full_name", label: "Full Name",          type: "text", required: true, placeholder: "Full name" },
    ],
  },
  {
    id: "belfius", name: "Belfius", svgFile: "card_belfius.svg", domain: "belfius.be",
    category: "Local", color: "#e30016",
    defaultFields: [
      { key: "account_holder_name", label: "Account Holder Name", type: "text", required: true, placeholder: "Full name" },
      { key: "iban",                label: "IBAN",                type: "text", required: true, placeholder: "BE..." },
      { key: "bic",                 label: "BIC",                 type: "text", required: true, placeholder: "e.g. GKCCBEBB" },
    ],
  },
  // ── Other ──
  {
    id: "western_union", name: "Western Union", svgFile: "card_western_union.svg", domain: "westernunion.com",
    category: "Other", color: "#fdbb30",
    defaultFields: [
      { key: "full_name", label: "Full Name",    type: "text", required: true, placeholder: "Receiver full name" },
      { key: "country",   label: "Country",      type: "text", required: true, placeholder: "Receiver country" },
      { key: "city",      label: "City",         type: "text", required: true, placeholder: "Receiver city" },
      { key: "phone",     label: "Phone Number", type: "text", required: true, placeholder: "Receiver phone" },
    ],
  },
  {
    id: "custom", name: "Custom", svgFile: null, domain: null,
    category: "Other", color: "#6b7280",
    defaultFields: [],
  },
];

const CATALOG_CATEGORIES = ["All", "Wallet", "Bank", "Crypto", "Card", "Digital", "Gateway", "Local", "Other"];

// ─── Status config ────────────────────────────────────────────────────────────

type StatusFilter = "All" | "Pending" | "Approved" | "Rejected";

const STATUS_FILTERS: Array<{ label: StatusFilter; icon: string }> = [
  { label: "All",      icon: "receipt-outline" },
  { label: "Pending",  icon: "time-outline" },
  { label: "Approved", icon: "checkmark-circle-outline" },
  { label: "Rejected", icon: "close-circle-outline" },
];

const STATUS_PILL: Record<string, string> = {
  Pending:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Rejected: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtTime(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// ─── Profile picture URL helper ──────────────────────────────────────────────
function profileUrl(pic: string | null | undefined): string | null {
  if (!pic) return null;
  return toManagedMediaUrl(pic) || null;
}

// ─── Logo component (payrexx SVG → clearbit → letter fallback) ────────────────

function LogoImg({
  svgFile, domain, name, color, size = "md",
}: {
  svgFile: string | null; domain: string | null; name: string; color: string;
  size?: "xs" | "sm" | "md";
}) {
  const [svgErr, setSvgErr]     = useState(false);
  const [clearErr, setClearErr] = useState(false);

  const dim = size === "xs" ? "w-7 h-7" : size === "sm" ? "w-9 h-9" : "w-12 h-12";
  const radius = "rounded-xl";

  const src = !svgErr && svgFile
    ? `${PR}${svgFile}`
    : !clearErr && domain
    ? `https://logo.clearbit.com/${domain}`
    : null;

  if (!src) {
    return (
      <div className={`${dim} ${radius} flex items-center justify-center font-black text-white shrink-0 text-sm`}
        style={{ background: `${color}22`, border: `1.5px solid ${color}44`, color }}>
        {name[0].toUpperCase()}
      </div>
    );
  }

  return (
    <div className={`${dim} ${radius} bg-white flex items-center justify-center overflow-hidden shrink-0 border border-white/10`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name}
        className="w-[82%] h-[82%] object-contain"
        onError={() => {
          if (!svgErr && svgFile) { setSvgErr(true); }
          else { setClearErr(true); }
        }}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WithdrawalAdminPage() {
  const [requests, setRequests]         = useState<WithdrawalRequest[]>([]);
  const [settings, setSettings]         = useState<Settings | null>(null);
  const [methods, setMethods]           = useState<PaymentMethod[]>([]);
  const [loading, setLoading]           = useState(true);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("All");
  const [search, setSearch]             = useState("");

  // Page view toggle
  const [pageView, setPageView]         = useState<"requests" | "transactions">("requests");
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [txLoading, setTxLoading]       = useState(false);
  const [txSearch, setTxSearch]         = useState("");

  // Limit modal
  const [showLimit, setShowLimit] = useState(false);
  const [limitMin, setLimitMin]   = useState("");
  const [limitMax, setLimitMax]   = useState("");
  const [limitBusy, setLimitBusy] = useState(false);

  // Payment methods panel
  const [showMethods, setShowMethods] = useState(false);

  // Add method — 2-step
  const [addStep, setAddStep]                 = useState<1 | 2>(1);
  const [showAddMethod, setShowAddMethod]     = useState(false);
  const [catalogSearch, setCatalogSearch]     = useState("");
  const [catalogCat, setCatalogCat]           = useState("All");
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogItem | null>(null);
  const [editName, setEditName]               = useState("");
  const [editFields, setEditFields]           = useState<FormField[]>([]);
  const [methodBusy, setMethodBusy]           = useState(false);

  // View request detail
  const [viewRequest, setViewRequest] = useState<WithdrawalRequest | null>(null);

  // Edit method modal
  const [editMethodTarget, setEditMethodTarget] = useState<PaymentMethod | null>(null);
  const [editMethodName, setEditMethodName]     = useState("");
  const [editMethodFields, setEditMethodFields] = useState<FormField[]>([]);
  const [editMethodBusy, setEditMethodBusy]     = useState(false);

  // Payment details view modal
  const [viewPaymentMethod, setViewPaymentMethod] = useState<WithdrawalRequest | null>(null);

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<WithdrawalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionBusy, setActionBusy]     = useState(false);

  // Toast
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const flash = (ok: boolean, msg: string) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 3200); };

  useEffect(() => {
    Promise.all([
      adminService.fetchWithdrawalRequests(),
      adminService.fetchWithdrawalSettings(),
      adminService.fetchWithdrawalPaymentMethods(),
    ]).then(([reqs, sett, meths]) => {
      setRequests(reqs); setSettings(sett); setMethods(meths);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (pageView === "transactions" && transactions.length === 0 && !txLoading) {
      setTxLoading(true);
      adminService.fetchWithdrawalTransactions()
        .then(setTransactions).catch(console.error).finally(() => setTxLoading(false));
    }
  }, [pageView]);

  // ── Derived ──
  const visible = requests.filter(r => {
    if (activeFilter !== "All" && r.status !== activeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        r.full_name?.toLowerCase().includes(s) ||
        r.username?.toLowerCase().includes(s) ||
        r.readable_user_id?.toLowerCase().includes(s) ||
        r.email?.toLowerCase().includes(s) ||
        r.payment_method_name?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const counts: Record<StatusFilter, number> = {
    All: requests.length,
    Pending:  requests.filter(r => r.status === "Pending").length,
    Approved: requests.filter(r => r.status === "Approved").length,
    Rejected: requests.filter(r => r.status === "Rejected").length,
  };

  const filteredCatalog = PAYMENT_CATALOG.filter(c => {
    if (catalogCat !== "All" && c.category !== catalogCat) return false;
    if (catalogSearch) {
      const s = catalogSearch.toLowerCase();
      return c.name.toLowerCase().includes(s) || c.category.toLowerCase().includes(s);
    }
    return true;
  });

  // ── Handlers ──
  const saveSettings = async () => {
    const mn = parseFloat(limitMin), mx = parseFloat(limitMax);
    if (isNaN(mn) || isNaN(mx)) return flash(false, "Enter valid amounts.");
    if (mn >= mx) return flash(false, "Min must be less than Max.");
    setLimitBusy(true);
    try {
      const s = await adminService.updateWithdrawalSettings(mn, mx);
      setSettings(s); setShowLimit(false); flash(true, "Withdrawal limits updated.");
    } catch (e: any) { flash(false, e.message); } finally { setLimitBusy(false); }
  };

  const refreshTransactions = () => {
    setTxLoading(true);
    adminService.fetchWithdrawalTransactions()
      .then(setTransactions).catch(console.error).finally(() => setTxLoading(false));
  };

  const approve = async (req: WithdrawalRequest) => {
    setActionBusy(true);
    try {
      await adminService.reviewWithdrawalRequest(req.id, "approve");
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: "Approved" } : r));
      flash(true, `Approved R ${parseFloat(req.amount).toFixed(2)} for ${req.full_name}.`);
      refreshTransactions();
    } catch (e: any) { flash(false, e.message); } finally { setActionBusy(false); }
  };

  const rejectConfirm = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setActionBusy(true);
    try {
      await adminService.reviewWithdrawalRequest(rejectTarget.id, "reject", rejectReason.trim());
      setRequests(prev => prev.map(r => r.id === rejectTarget.id ? { ...r, status: "Rejected", rejection_reason: rejectReason.trim() } : r));
      setRejectTarget(null); setRejectReason(""); flash(true, "Request rejected.");
      refreshTransactions();
    } catch (e: any) { flash(false, e.message); } finally { setActionBusy(false); }
  };

  const toggleMethod = async (m: PaymentMethod) => {
    try {
      const updated = await adminService.updateWithdrawalPaymentMethod(m.id, { is_active: !m.is_active });
      setMethods(prev => prev.map(pm => pm.id === m.id ? { ...pm, is_active: updated.is_active } : pm));
    } catch (e: any) { flash(false, e.message); }
  };

  const deleteMethod = async (m: PaymentMethod) => {
    if (!confirm(`Delete "${m.name}"?`)) return;
    try {
      await adminService.deleteWithdrawalPaymentMethod(m.id);
      setMethods(prev => prev.filter(pm => pm.id !== m.id));
      flash(true, `"${m.name}" removed.`);
    } catch (e: any) { flash(false, e.message); }
  };

  const openEditMethod = (m: PaymentMethod) => {
    setEditMethodTarget(m);
    setEditMethodName(m.name);
    setEditMethodFields(m.fields.map(f => ({ ...f })));
  };

  const addEditField = () =>
    setEditMethodFields(prev => [...prev, { key: `field_${Date.now()}`, label: "", type: "text", required: false, placeholder: "" }]);

  const updateEditField = (idx: number, patch: Partial<FormField>) =>
    setEditMethodFields(prev => prev.map((f, i) => i === idx ? { ...f, ...patch, key: patch.label ? patch.label.toLowerCase().replace(/\s+/g, "_") : f.key } : f));

  const removeEditField = (idx: number) => setEditMethodFields(prev => prev.filter((_, i) => i !== idx));

  const saveEditMethod = async () => {
    if (!editMethodTarget || !editMethodName.trim()) return flash(false, "Method name is required.");
    setEditMethodBusy(true);
    try {
      const updated = await adminService.updateWithdrawalPaymentMethod(editMethodTarget.id, {
        name: editMethodName.trim(),
        fields: editMethodFields,
      });
      setMethods(prev => prev.map(m => m.id === editMethodTarget.id ? { ...m, name: updated.name, fields: updated.fields } : m));
      setEditMethodTarget(null);
      flash(true, `"${updated.name}" updated.`);
    } catch (e: any) { flash(false, e.message); } finally { setEditMethodBusy(false); }
  };

  const openAddMethod = () => {
    setAddStep(1); setSelectedCatalog(null);
    setCatalogSearch(""); setCatalogCat("All");
    setEditName(""); setEditFields([]);
    setShowAddMethod(true);
  };

  const goToStep2 = () => {
    if (!selectedCatalog) return;
    setEditName(selectedCatalog.name);
    setEditFields(selectedCatalog.defaultFields.map(f => ({ ...f })));
    setAddStep(2);
  };

  const addField = () =>
    setEditFields(prev => [...prev, { key: `field_${Date.now()}`, label: "", type: "text", required: false, placeholder: "" }]);

  const updateField = (idx: number, patch: Partial<FormField>) =>
    setEditFields(prev => prev.map((f, i) => i === idx ? { ...f, ...patch, key: patch.label ? patch.label.toLowerCase().replace(/\s+/g, "_") : f.key } : f));

  const removeField = (idx: number) => setEditFields(prev => prev.filter((_, i) => i !== idx));

  const saveNewMethod = async () => {
    if (!editName.trim()) return flash(false, "Method name is required.");
    setMethodBusy(true);
    try {
      const created = await adminService.createWithdrawalPaymentMethod({
        name: editName.trim(),
        icon: selectedCatalog?.id || "custom",
        fields: editFields,
        is_active: true,
      });
      setMethods(prev => [created, ...prev]);
      setShowAddMethod(false);
      flash(true, `"${created.name}" payment method added.`);
    } catch (e: any) { flash(false, e.message); } finally { setMethodBusy(false); }
  };

  const getCatalog = (iconId: string): CatalogItem =>
    PAYMENT_CATALOG.find(c => c.id === iconId) || { id: "custom", name: iconId, svgFile: null, domain: null, category: "Other", color: "#6b7280", defaultFields: [] };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed left-1/2 top-4 z-[300] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 ${
          toast.ok ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-200" : "bg-rose-950/90 border-rose-500/30 text-rose-200"
        }`}>
          <IonIcon name={toast.ok ? "checkmark-circle-outline" : "alert-circle-outline"} className="text-sm shrink-0" />
          <span className="truncate">{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">Withdrawal Requests</h1>
        <p className="text-slate-400 text-sm font-medium mt-0.5">Manage user withdrawal requests and payment methods.</p>
      </div>

      {/* Pill nav */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap">
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-white/5 bg-white/5 p-1">
          {STATUS_FILTERS.map(f => (
            <button key={f.label} onClick={() => setActiveFilter(f.label)}
              className={`flex flex-1 sm:flex-none items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-all ${
                activeFilter === f.label ? "scale-[1.02] bg-white text-black shadow-lg" : "text-slate-500 hover:bg-white/5 hover:text-white"
              }`}>
              <IonIcon name={f.icon} className="text-sm" />
              {f.label}
              <span className={`ml-0.5 text-[9px] font-black ${activeFilter === f.label ? "text-black/60" : "text-slate-600"}`}>{counts[f.label]}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => { setLimitMin(settings ? String(settings.min_amount) : "50"); setLimitMax(settings ? String(settings.max_amount) : "10000"); setShowLimit(true); }}
          className="flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:border-white/20 hover:text-white transition-all"
        >
          <IonIcon name="options-outline" className="text-sm" />
          Withdrawal Limit
          {settings && <span className="ml-1 text-[9px] text-slate-500 normal-case">R{parseFloat(settings.min_amount).toFixed(0)}–R{parseFloat(settings.max_amount).toFixed(0)}</span>}
        </button>

        <button onClick={() => setShowMethods(true)}
          className="flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:border-white/20 hover:text-white transition-all">
          <IonIcon name="card-outline" className="text-sm" />
          Payment Methods
          <span className="ml-1 text-[9px] text-slate-500">{methods.filter(m => m.is_active).length} active</span>
        </button>

        <button onClick={() => setPageView(v => v === "transactions" ? "requests" : "transactions")}
          className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl border px-4 py-2.5 text-[10px] font-black uppercase tracking-wider transition-all ${
            pageView === "transactions"
              ? "border-violet-500/40 bg-violet-500/10 text-violet-400"
              : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white"
          }`}>
          <IonIcon name="swap-horizontal-outline" className="text-sm" />
          Wallet Transactions
          {transactions.length > 0 && <span className="ml-1 text-[9px] text-slate-500">{transactions.length}</span>}
        </button>
      </div>

      {/* ── Wallet Transactions Table ── */}
      {pageView === "transactions" && (
        <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] relative min-h-[400px] shadow-2xl overflow-hidden">
          {txLoading && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-[2rem]">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white" />
            </div>
          )}
          <div className="p-6 border-b border-[#1a1a1a] flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-violet-400 transition-colors">
                <IonIcon name="search-outline" className="text-lg" />
              </div>
              <input type="text" placeholder="Search by name, user ID or note..."
                value={txSearch} onChange={e => setTxSearch(e.target.value)}
                className="w-full bg-[#0c0c0e] border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-medium text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/30 focus:ring-4 focus:ring-violet-500/5 transition-all" />
            </div>
            <button onClick={refreshTransactions} disabled={txLoading}
              className="px-4 h-11 rounded-xl bg-white/5 border border-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition-all flex items-center gap-2 disabled:opacity-50">
              <IonIcon name="refresh-outline" className="text-sm" /> Refresh
            </button>
            <div className="px-4 h-11 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2.5 shrink-0">
              <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{transactions.length} Transactions</span>
            </div>
          </div>
          <div className="w-full overflow-x-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#1a1a1a]/50 text-slate-300 text-[9px] font-black uppercase tracking-[0.2em]">
                  <th className="px-6 py-5">User</th>
                  <th className="px-6 py-5 text-center">Type</th>
                  <th className="px-6 py-5 text-center">Amount</th>
                  <th className="px-6 py-5 text-center">Status</th>
                  <th className="px-6 py-5 text-left">Note</th>
                  <th className="px-6 py-5 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {(() => {
                  const filtered = transactions.filter(tx => {
                    if (!txSearch) return true;
                    const s = txSearch.toLowerCase();
                    return (
                      tx.sender_name?.toLowerCase().includes(s) ||
                      tx.sender_username?.toLowerCase().includes(s) ||
                      tx.sender_readable_id?.toLowerCase().includes(s) ||
                      tx.receiver_name?.toLowerCase().includes(s) ||
                      tx.receiver_username?.toLowerCase().includes(s) ||
                      tx.receiver_readable_id?.toLowerCase().includes(s) ||
                      tx.note?.toLowerCase().includes(s)
                    );
                  });
                  if (filtered.length === 0) return (
                    <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-500 font-medium italic">
                      {txSearch ? "No transactions match your search." : "No withdrawal transactions yet."}
                    </td></tr>
                  );
                  return filtered.map(tx => {
                    const isRefund = tx.type === "withdrawal_refund";
                    const user = isRefund
                      ? { name: tx.receiver_name, username: tx.receiver_username, id: tx.receiver_readable_id, pic: tx.receiver_pic }
                      : { name: tx.sender_name, username: tx.sender_username, id: tx.sender_readable_id, pic: tx.sender_pic };
                    const picSrc = profileUrl(user.pic);
                    return (
                      <tr key={tx.id} className="hover:bg-white/[0.02] transition-all">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 text-slate-500">
                              {picSrc
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={picSrc} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                : <IonIcon name="person" className="text-sm" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white truncate">{user.name || "—"}</p>
                              <p className="text-[10px] text-slate-500">@{user.username || "—"} · ID: {user.id || "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                            isRefund
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}>
                            <IonIcon name={isRefund ? "return-up-back-outline" : "arrow-up-circle-outline"} className="text-xs" />
                            {isRefund ? "Refund" : "Withdrawal"}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className={`text-base font-black ${isRefund ? "text-emerald-400" : "text-rose-400"}`}>
                            {isRefund ? "+" : "−"}R {parseFloat(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                            tx.status === "accepted" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : tx.status === "refunded" ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-white/5 text-slate-400 border-white/5"
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 max-w-[200px]">
                          <p className="text-[10px] text-slate-500 truncate">{tx.note || "—"}</p>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <p className="text-[10px] font-bold text-slate-400">{fmt(tx.created_at)}</p>
                          <p className="text-[9px] text-slate-600 mt-0.5 font-mono">{fmtTime(tx.created_at)}</p>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Table */}
      {pageView === "requests" && <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] relative min-h-[500px] shadow-2xl overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-[2rem]">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white" />
          </div>
        )}
        <div className="p-6 border-b border-[#1a1a1a] flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-400 transition-colors">
              <IonIcon name="search-outline" className="text-lg" />
            </div>
            <input type="text" placeholder="Search by name, email, user ID or method..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#0c0c0e] border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-medium text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 transition-all" />
          </div>
          <div className="px-4 h-11 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2.5 shrink-0">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{visible.length} Requests</span>
          </div>
        </div>

        <div className="w-full overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#1a1a1a]/50 text-slate-300 text-[9px] font-black uppercase tracking-[0.2em]">
                <th className="px-6 py-5">User</th>
                <th className="px-6 py-5 text-center">Amount</th>
                <th className="px-6 py-5 text-center">Method</th>
                <th className="px-6 py-5 text-center">Status</th>
                <th className="px-6 py-5 text-right">Date</th>
                <th className="px-6 py-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {visible.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-500 font-medium italic">
                  {search || activeFilter !== "All" ? "No requests match your filter." : "No withdrawal requests yet."}
                </td></tr>
              ) : visible.map(req => {
                const ci = getCatalog(req.payment_method_name?.toLowerCase().replace(/[\s()]/g, "_") || "");
                return (
                  <tr key={req.id} className="hover:bg-white/[0.02] transition-all cursor-pointer" onClick={() => setViewRequest(req)}>
                    <td className="px-6 py-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 overflow-hidden shrink-0">
                          {profileUrl(req.profile_picture)
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={profileUrl(req.profile_picture)!} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            : <IonIcon name="person" className="text-lg" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-white text-sm">{req.user_type?.toLowerCase() === 'admin' ? `@${req.username}` : req.full_name}</p>
                            <span className="text-[10px] text-slate-500 font-mono">ID: {req.readable_user_id}</span>
                          </div>
                          <p className="text-xs text-slate-400">@{req.username}</p>
                          <p className="text-[11px] text-slate-500 italic">{req.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="text-base font-black text-white">
                        R {parseFloat(req.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <LogoImg svgFile={ci.svgFile} domain={ci.domain} name={req.payment_method_name || "?"} color={ci.color} size="xs" />
                        <div className="text-left">
                          <p className="text-xs font-bold text-slate-300">{req.payment_method_name || "—"}</p>
                          {req.payment_details && Object.values(req.payment_details)[0] && (
                            <p className="text-[10px] text-slate-600 truncate max-w-[100px]">{Object.values(req.payment_details)[0]}</p>
                          )}
                        </div>
                        {req.payment_details && Object.keys(req.payment_details).length > 0 && (
                          <button
                            onClick={e => { e.stopPropagation(); setViewPaymentMethod(req); }}
                            title="View payment details"
                            className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-sky-400 hover:border-sky-500/30 hover:bg-sky-500/10 transition-all shrink-0"
                          >
                            <IonIcon name="eye-outline" className="text-xs" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${STATUS_PILL[req.status] || "bg-white/5 text-slate-400 border-white/5"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${req.status === "Approved" ? "bg-emerald-400" : req.status === "Rejected" ? "bg-rose-400" : "bg-amber-400"}`} />
                        {req.status}
                      </span>
                      {req.status === "Rejected" && req.rejection_reason && (
                        <p className="text-[10px] text-rose-400/60 mt-1 max-w-[140px] mx-auto truncate">{req.rejection_reason}</p>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <p className="text-[10px] font-bold text-slate-400">{fmt(req.created_at)}</p>
                      <p className="text-[9px] text-slate-600 mt-0.5 font-mono">{fmtTime(req.created_at)}</p>
                    </td>
                    <td className="px-6 py-5 text-right" onClick={e => e.stopPropagation()}>
                      {req.status === "Pending" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => approve(req)} disabled={actionBusy}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-400 uppercase tracking-widest hover:bg-emerald-500/20 transition-all disabled:opacity-50">
                            <IonIcon name="checkmark-outline" className="text-xs" /> Approve
                          </button>
                          <button onClick={() => { setRejectTarget(req); setRejectReason(""); }} disabled={actionBusy}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[9px] font-black text-rose-400 uppercase tracking-widest hover:bg-rose-500/20 transition-all disabled:opacity-50">
                            <IonIcon name="close-outline" className="text-xs" /> Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-600 italic">{req.reviewed_at ? fmt(req.reviewed_at) : "—"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>}

      {/* ════ MODAL: Withdrawal Limit ════ */}
      {showLimit && (
        <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] p-7 w-full max-w-sm shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <IonIcon name="options-outline" className="text-lg" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Withdrawal Limit</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Set min and max per request (Rupees).</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Minimum (R)", val: limitMin, set: setLimitMin, ph: "e.g. 50" },
                { label: "Maximum (R)", val: limitMax, set: setLimitMax, ph: "e.g. 10000" },
              ].map(f => (
                <div key={f.label}>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{f.label}</p>
                  <input type="number" min={0} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                    className="w-full bg-[#0c0c0e] border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/30 transition-all" />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowLimit(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/5 text-[11px] font-black text-slate-400 uppercase tracking-wide hover:border-white/10 hover:text-white transition-all">Cancel</button>
              <button onClick={saveSettings} disabled={limitBusy}
                className="flex-1 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] font-black text-blue-400 uppercase tracking-wide hover:bg-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {limitBusy && <div className="w-3.5 h-3.5 rounded-full border-t-2 border-blue-400 animate-spin" />}
                Save Limit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ PANEL: Payment Methods ════ */}
      {showMethods && (
        <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-end">
          <div className="h-full w-full max-w-md bg-[#09090b] border-l border-[#1a1a1a] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#1a1a1a] shrink-0">
              <div>
                <h2 className="text-sm font-black text-white">Payment Methods</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Active methods show on the user withdrawal form.</p>
              </div>
              <button onClick={() => setShowMethods(false)} className="w-8 h-8 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                <IonIcon name="close-outline" className="text-base" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3">
              {methods.length === 0 && (
                <div className="py-16 text-center">
                  <IonIcon name="card-outline" className="text-4xl text-slate-700 block mb-3" />
                  <p className="text-slate-500 text-sm">No payment methods yet.</p>
                </div>
              )}
              {methods.map(m => {
                const ci = getCatalog(m.icon);
                return (
                  <div key={m.id} className={`rounded-2xl border p-4 transition-all ${m.is_active ? "border-[#1a1a1a] bg-white/[0.02]" : "border-white/5 opacity-40"}`}>
                    <div className="flex items-center gap-3">
                      <LogoImg svgFile={ci.svgFile} domain={ci.domain} name={m.name} color={ci.color} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">{m.name}</p>
                        <button onClick={() => openEditMethod(m)} className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors text-left">
                          {ci.category} · <span className="underline underline-offset-2">{m.fields.length} field{m.fields.length !== 1 ? "s" : ""}</span>
                        </button>
                      </div>
                      <button onClick={() => toggleMethod(m)}
                        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${m.is_active ? "bg-emerald-500" : "bg-white/10"}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${m.is_active ? "translate-x-4" : "translate-x-0"}`} />
                      </button>
                      <button onClick={() => openEditMethod(m)}
                        className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 hover:bg-blue-500/20 transition-all ml-1 shrink-0">
                        <IonIcon name="create-outline" className="text-xs" />
                      </button>
                      <button onClick={() => deleteMethod(m)}
                        className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 hover:bg-rose-500/20 transition-all ml-1 shrink-0">
                        <IonIcon name="trash-outline" className="text-xs" />
                      </button>
                    </div>
                    {m.fields.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-1.5">
                        {m.fields.map(f => (
                          <span key={f.key} className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-[9px] font-bold text-slate-400">{f.label}{f.required ? " *" : ""}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="shrink-0 px-5 py-4 border-t border-[#1a1a1a]">
              <button onClick={openAddMethod}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/10 text-[11px] font-black text-slate-300 uppercase tracking-widest hover:border-white/20 hover:text-white transition-all">
                <IonIcon name="add-circle-outline" className="text-base" /> Add Payment Method
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL Step 1: Choose Method ════ */}
      {showAddMethod && addStep === 1 && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] w-full max-w-2xl shadow-2xl flex flex-col" style={{ maxHeight: "76vh" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a] shrink-0">
              <div>
                <h3 className="text-sm font-black text-white">Choose Payment Method</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{PAYMENT_CATALOG.length} methods available — select one to configure.</p>
              </div>
              <button onClick={() => setShowAddMethod(false)} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                <IonIcon name="close-outline" className="text-base" />
              </button>
            </div>

            {/* Search + category chips */}
            <div className="px-5 pt-3.5 pb-2.5 space-y-2.5 shrink-0 border-b border-[#1a1a1a]">
              <div className="relative group">
                <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-400 transition-colors">
                  <IonIcon name="search-outline" className="text-sm" />
                </div>
                <input type="text" placeholder="Search methods..." value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  className="w-full bg-[#0c0c0e] border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs font-medium text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/30 transition-all" />
              </div>
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
                {CATALOG_CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setCatalogCat(cat)}
                    className={`shrink-0 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                      catalogCat === cat ? "bg-blue-500/15 border-blue-500/30 text-blue-400" : "bg-white/[0.02] border-white/5 text-slate-500 hover:border-white/10 hover:text-white"
                    }`}>{cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Logo grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4">
              {filteredCatalog.length === 0 ? (
                <p className="text-center text-slate-600 text-sm py-8">No methods match your search.</p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {filteredCatalog.map(item => {
                    const isSelected = selectedCatalog?.id === item.id;
                    return (
                      <button key={item.id} onClick={() => setSelectedCatalog(isSelected ? null : item)}
                        className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
                          isSelected ? "border-blue-500/40 bg-blue-500/10" : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]"
                        }`}>
                        <LogoImg svgFile={item.svgFile} domain={item.domain} name={item.name} color={item.color} size="md" />
                        <p className={`text-[8px] font-black text-center leading-tight tracking-wide line-clamp-2 ${isSelected ? "text-blue-300" : "text-slate-400"}`}>
                          {item.name}
                        </p>
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                            <IonIcon name="checkmark" className="text-[8px] text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-5 py-3.5 border-t border-[#1a1a1a] flex items-center justify-between gap-3">
              {selectedCatalog ? (
                <div className="flex items-center gap-2">
                  <LogoImg svgFile={selectedCatalog.svgFile} domain={selectedCatalog.domain} name={selectedCatalog.name} color={selectedCatalog.color} size="xs" />
                  <div>
                    <p className="text-xs font-bold text-white">{selectedCatalog.name}</p>
                    <p className="text-[10px] text-slate-500">{selectedCatalog.category} · {selectedCatalog.defaultFields.length} default fields</p>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-600 italic">Select a method above to continue</p>
              )}
              <button onClick={goToStep2} disabled={!selectedCatalog}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-[11px] font-black text-blue-400 uppercase tracking-wide hover:bg-blue-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                Configure Fields <IonIcon name="arrow-forward-outline" className="text-sm" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL Step 2: Configure Fields ════ */}
      {showAddMethod && addStep === 2 && selectedCatalog && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] w-full max-w-md shadow-2xl flex flex-col" style={{ maxHeight: "76vh" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a] shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={() => setAddStep(1)} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                  <IonIcon name="arrow-back-outline" className="text-xs" />
                </button>
                <LogoImg svgFile={selectedCatalog.svgFile} domain={selectedCatalog.domain} name={selectedCatalog.name} color={selectedCatalog.color} size="sm" />
                <div>
                  <h3 className="text-sm font-black text-white">Configure Fields</h3>
                  <p className="text-[11px] text-slate-400">{selectedCatalog.name}</p>
                </div>
              </div>
              <button onClick={() => setShowAddMethod(false)} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                <IonIcon name="close-outline" className="text-base" />
              </button>
            </div>

            {/* Name input */}
            <div className="px-6 pt-4 pb-3 shrink-0">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Method Name</p>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="e.g. Binance"
                className="w-full bg-[#0c0c0e] border border-white/5 rounded-xl px-4 py-2.5 text-sm font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/30 transition-all" />
            </div>

            {/* Fields */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-2">
              <div className="flex items-center justify-between mb-2.5">
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">User Form Fields</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">What users fill in when withdrawing.</p>
                </div>
                <button onClick={addField}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:border-white/20 hover:text-white transition-all">
                  <IonIcon name="add-outline" className="text-xs" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {editFields.length === 0 && (
                  <p className="text-center text-[11px] text-slate-600 italic py-5">No fields. Click "Add" above.</p>
                )}
                {editFields.map((f, idx) => (
                  <div key={idx} className="bg-[#0c0c0e] border border-white/5 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Field {idx + 1}</p>
                      <button onClick={() => removeField(idx)} className="text-rose-400/50 hover:text-rose-400 transition-colors">
                        <IonIcon name="trash-outline" className="text-xs" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[9px] text-slate-600 mb-1">Label</p>
                        <input type="text" value={f.label} onChange={e => updateField(idx, { label: e.target.value })} placeholder="e.g. Email"
                          className="w-full bg-[#09090b] border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/30 transition-all" />
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-600 mb-1">Type</p>
                        <select value={f.type} onChange={e => updateField(idx, { type: e.target.value as FormField["type"] })}
                          className="w-full bg-[#09090b] border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/30 transition-all">
                          <option value="text">Text</option>
                          <option value="email">Email</option>
                          <option value="number">Number</option>
                        </select>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-600 mb-1">Placeholder</p>
                        <input type="text" value={f.placeholder} onChange={e => updateField(idx, { placeholder: e.target.value })} placeholder="Hint text"
                          className="w-full bg-[#09090b] border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/30 transition-all" />
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={f.required} onChange={e => updateField(idx, { required: e.target.checked })} className="w-3.5 h-3.5 rounded accent-blue-500" />
                          <span className="text-[10px] font-bold text-slate-400">Required</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 flex gap-3 px-6 py-4 border-t border-[#1a1a1a]">
              <button onClick={() => setShowAddMethod(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/5 text-[11px] font-black text-slate-400 uppercase tracking-wide hover:border-white/10 hover:text-white transition-all">Cancel</button>
              <button onClick={saveNewMethod} disabled={methodBusy}
                className="flex-1 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] font-black text-blue-400 uppercase tracking-wide hover:bg-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {methodBusy && <div className="w-3.5 h-3.5 rounded-full border-t-2 border-blue-400 animate-spin" />}
                Save Method
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL: View Request Detail ════ */}
      {viewRequest && (() => {
        const vr = viewRequest;
        const ci = getCatalog(vr.payment_method_name?.toLowerCase().replace(/[\s()]/g, "_") || "");
        const picSrc = profileUrl(vr.profile_picture);
        return (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewRequest(null)}>
            <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] w-full max-w-md shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "85vh" }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a] shrink-0">
                <h3 className="text-sm font-black text-white">Withdrawal Request</h3>
                <button onClick={() => setViewRequest(null)} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                  <IonIcon name="close-outline" className="text-base" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
                {/* User card */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center text-slate-500">
                    {picSrc
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={picSrc} alt={vr.full_name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).replaceWith(Object.assign(document.createElement("span"), { textContent: vr.full_name?.[0]?.toUpperCase() || "?" })); }} />
                      : <IonIcon name="person" className="text-2xl" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-white text-base truncate">{vr.user_type?.toLowerCase() === 'admin' ? `@${vr.username}` : vr.full_name}</p>
                    <p className="text-xs text-slate-400">@{vr.username}</p>
                    <p className="text-[11px] text-slate-500 truncate">{vr.email}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] font-mono text-slate-600">ID: {vr.readable_user_id}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-slate-400 capitalize">{vr.user_type}</span>
                    </div>
                  </div>
                </div>

                {/* Amount + status */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Amount</p>
                    <p className="text-xl font-black text-white">R {parseFloat(vr.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Wallet Balance</p>
                    <p className="text-xl font-black text-white">R {parseFloat(vr.wallet_balance || "0").toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>

                {/* Status pill */}
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${STATUS_PILL[vr.status] || "bg-white/5 text-slate-400 border-white/5"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${vr.status === "Approved" ? "bg-emerald-400" : vr.status === "Rejected" ? "bg-rose-400" : "bg-amber-400"}`} />
                    {vr.status}
                  </span>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500">Submitted {fmt(vr.created_at)} {fmtTime(vr.created_at)}</p>
                    {vr.reviewed_at && <p className="text-[10px] text-slate-600">Reviewed {fmt(vr.reviewed_at)}</p>}
                  </div>
                </div>

                {vr.status === "Rejected" && vr.rejection_reason && (
                  <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4">
                    <p className="text-[9px] font-black text-rose-400/70 uppercase tracking-widest mb-1">Rejection Reason</p>
                    <p className="text-xs text-rose-300">{vr.rejection_reason}</p>
                  </div>
                )}

                {/* Payment method */}
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Payment Method</p>
                  <div className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                    <LogoImg svgFile={ci.svgFile} domain={ci.domain} name={vr.payment_method_name || "?"} color={ci.color} size="sm" />
                    <p className="text-sm font-bold text-white">{vr.payment_method_name || "—"}</p>
                  </div>
                </div>

                {/* Payment details */}
                {vr.payment_details && Object.keys(vr.payment_details).length > 0 && (
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Payment Details</p>
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
                      {Object.entries(vr.payment_details).map(([key, val]) => (
                        <div key={key} className="flex items-start justify-between gap-3 px-4 py-3">
                          <p className="text-[10px] font-bold text-slate-500 capitalize shrink-0">{key.replace(/_/g, " ")}</p>
                          <p className="text-xs font-mono text-white text-right break-all">{String(val)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer actions */}
              {vr.status === "Pending" && (
                <div className="shrink-0 flex gap-3 px-6 py-4 border-t border-[#1a1a1a]">
                  <button onClick={() => { setViewRequest(null); setRejectTarget(vr); setRejectReason(""); }}
                    className="flex-1 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] font-black text-rose-400 uppercase tracking-wide hover:bg-rose-500/20 transition-all flex items-center justify-center gap-1.5">
                    <IonIcon name="close-outline" className="text-sm" /> Reject
                  </button>
                  <button onClick={() => { approve(vr); setViewRequest(null); }} disabled={actionBusy}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-black text-emerald-400 uppercase tracking-wide hover:bg-emerald-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
                    <IonIcon name="checkmark-outline" className="text-sm" /> Approve
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ════ MODAL: View Payment Method Details ════ */}
      {viewPaymentMethod && (() => {
        const vpm = viewPaymentMethod;
        const ci = getCatalog(vpm.payment_method_name?.toLowerCase().replace(/[\s()]/g, "_") || "");
        // Find matching method definition for field labels
        const methodDef = methods.find(m => m.name.toLowerCase() === vpm.payment_method_name?.toLowerCase());
        const getLabel = (key: string) => {
          const field = methodDef?.fields.find(f => f.key === key);
          return field?.label || key.replace(/_/g, " ");
        };
        return (
          <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewPaymentMethod(null)}>
            <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
                <div className="flex items-center gap-3">
                  <LogoImg svgFile={ci.svgFile} domain={ci.domain} name={vpm.payment_method_name || "?"} color={ci.color} size="sm" />
                  <div>
                    <h3 className="text-sm font-black text-white">Payment Details</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">{vpm.payment_method_name || "—"}</p>
                  </div>
                </div>
                <button onClick={() => setViewPaymentMethod(null)} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                  <IonIcon name="close-outline" className="text-base" />
                </button>
              </div>
              <div className="p-6 space-y-3">
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <IonIcon name="lock-closed-outline" className="text-xs text-slate-600" />
                  Read-only · Submitted by user
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
                  {Object.entries(vpm.payment_details).map(([key, val]) => (
                    <div key={key} className="flex items-start justify-between gap-4 px-4 py-3">
                      <p className="text-[10px] font-bold text-slate-500 shrink-0 capitalize">{getLabel(key)}</p>
                      <p className="text-xs font-mono text-white text-right break-all select-all">{String(val)}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-slate-600 text-center mt-2">
                  {vpm.full_name} · R {parseFloat(vpm.amount).toFixed(2)} withdrawal
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ════ MODAL: Edit Payment Method ════ */}
      {editMethodTarget && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] w-full max-w-md shadow-2xl flex flex-col" style={{ maxHeight: "76vh" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a] shrink-0">
              <div className="flex items-center gap-3">
                <LogoImg svgFile={getCatalog(editMethodTarget.icon).svgFile} domain={getCatalog(editMethodTarget.icon).domain} name={editMethodTarget.name} color={getCatalog(editMethodTarget.icon).color} size="sm" />
                <div>
                  <h3 className="text-sm font-black text-white">Edit Payment Method</h3>
                  <p className="text-[11px] text-slate-400">{editMethodTarget.name}</p>
                </div>
              </div>
              <button onClick={() => setEditMethodTarget(null)} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                <IonIcon name="close-outline" className="text-base" />
              </button>
            </div>

            {/* Name input */}
            <div className="px-6 pt-4 pb-3 shrink-0">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Method Name</p>
              <input type="text" value={editMethodName} onChange={e => setEditMethodName(e.target.value)} placeholder="e.g. Binance"
                className="w-full bg-[#0c0c0e] border border-white/5 rounded-xl px-4 py-2.5 text-sm font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/30 transition-all" />
            </div>

            {/* Fields */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-2">
              <div className="flex items-center justify-between mb-2.5">
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">User Form Fields</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">What users fill in when withdrawing.</p>
                </div>
                <button onClick={addEditField}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:border-white/20 hover:text-white transition-all">
                  <IonIcon name="add-outline" className="text-xs" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {editMethodFields.length === 0 && (
                  <p className="text-center text-[11px] text-slate-600 italic py-5">No fields. Click "Add" above.</p>
                )}
                {editMethodFields.map((f, idx) => (
                  <div key={idx} className="bg-[#0c0c0e] border border-white/5 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Field {idx + 1}</p>
                      <button onClick={() => removeEditField(idx)} className="text-rose-400/50 hover:text-rose-400 transition-colors">
                        <IonIcon name="trash-outline" className="text-xs" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[9px] text-slate-600 mb-1">Label</p>
                        <input type="text" value={f.label} onChange={e => updateEditField(idx, { label: e.target.value })} placeholder="e.g. Email"
                          className="w-full bg-[#09090b] border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/30 transition-all" />
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-600 mb-1">Type</p>
                        <select value={f.type} onChange={e => updateEditField(idx, { type: e.target.value as FormField["type"] })}
                          className="w-full bg-[#09090b] border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/30 transition-all">
                          <option value="text">Text</option>
                          <option value="email">Email</option>
                          <option value="number">Number</option>
                        </select>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-600 mb-1">Placeholder</p>
                        <input type="text" value={f.placeholder} onChange={e => updateEditField(idx, { placeholder: e.target.value })} placeholder="Hint text"
                          className="w-full bg-[#09090b] border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/30 transition-all" />
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={f.required} onChange={e => updateEditField(idx, { required: e.target.checked })} className="w-3.5 h-3.5 rounded accent-blue-500" />
                          <span className="text-[10px] font-bold text-slate-400">Required</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 flex gap-3 px-6 py-4 border-t border-[#1a1a1a]">
              <button onClick={() => setEditMethodTarget(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/5 text-[11px] font-black text-slate-400 uppercase tracking-wide hover:border-white/10 hover:text-white transition-all">Cancel</button>
              <button onClick={saveEditMethod} disabled={editMethodBusy}
                className="flex-1 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] font-black text-blue-400 uppercase tracking-wide hover:bg-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {editMethodBusy && <div className="w-3.5 h-3.5 rounded-full border-t-2 border-blue-400 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL: Reject Request ════ */}
      {rejectTarget && (
        <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] p-7 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <IonIcon name="close-circle-outline" className="text-base" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Reject Withdrawal</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">R {parseFloat(rejectTarget.amount).toFixed(2)} · {rejectTarget.full_name}</p>
              </div>
            </div>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..." rows={3}
              className="w-full bg-[#0c0c0e] border border-white/5 rounded-2xl p-4 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500/30 transition-all resize-none" />
            <div className="flex gap-3">
              <button onClick={() => { setRejectTarget(null); setRejectReason(""); }}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/5 text-[11px] font-black text-slate-400 uppercase tracking-wide hover:border-white/10 hover:text-white transition-all">Cancel</button>
              <button onClick={rejectConfirm} disabled={actionBusy || !rejectReason.trim()}
                className="flex-1 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] font-black text-rose-400 uppercase tracking-wide hover:bg-rose-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {actionBusy && <div className="w-3.5 h-3.5 rounded-full border-t-2 border-rose-400 animate-spin" />}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
