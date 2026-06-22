"use client";

import { useEffect, useMemo, useState } from "react";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";
import { authService } from "@/services/authService";
import { chatService } from "@/services/chatService";

// ─── PayRexx logos ────────────────────────────────────────────────────────────
const PR = "https://raw.githubusercontent.com/payrexx/payment-logos/main/assets/card-icons/";

interface FormField {
  key: string;
  label: string;
  type: "text" | "email" | "number";
  required: boolean;
  placeholder: string;
  defaultValue?: string;
  locked?: boolean;
}

interface TopupMethod {
  id: number;
  name: string;
  icon: string;
  category: string;
  fields: FormField[];
  is_active: boolean;
}

interface CoinRequest {
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
  status: "Pending" | "Verified" | "Rejected";
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface AdminUser {
  id: number;
  username: string;
  full_name: string;
  user_type: string;
}

interface TopupRequestAssignment {
  topup_request_id: number;
  assigned_admin_id: number;
  assigned_admin?: {
    id: number;
    name: string;
    username?: string | null;
  };
  updated_at?: string | null;
}

interface P2PTransaction {
  id: number;
  ad_id: number;
  buyer_id: number;
  seller_id: number;
  amount: string;
  receive_amount: string | null;
  receive_currency?: string | null;
  tx_id: string | null;
  screenshot_data: string | null;
  screenshot_name: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  admin_fields?: Array<{ key: string; label: string; value?: string; defaultValue?: string; locked?: boolean }> | string | null;
  buyer_fields?: Array<{ key: string; label: string; value?: string; defaultValue?: string; locked?: boolean }> | string | null;
  lkr_rate?: string | null;
  min_amount?: string | null;
  max_amount?: string | null;
  release_value?: string | null;
  release_unit?: string | null;
  description?: string | null;
  buyer_report_reason: string | null;
  buyer_reported_at: string | null;
  seller_report_reason: string | null;
  seller_reported_at: string | null;
  ad_name: string | null;
  category: string | null;
  crypto_currency: string | null;
  buyer_username: string | null;
  buyer_name: string | null;
  buyer_readable_id: string | null;
  seller_username: string | null;
  seller_name: string | null;
  seller_readable_id: string | null;
}

interface ChatMessage {
  id: number;
  sender_id: number;
  receiver_id: number;
  type: "text" | "image";
  text: string | null;
  image_url?: string | null;
  file_name?: string | null;
  status?: string;
  created_at: string;
  sender_name?: string | null;
  receiver_name?: string | null;
}

interface CatalogItem {
  id: string;
  name: string;
  svgFile: string | null;
  domain: string | null;
  category: string;
  color: string;
  defaultFields: FormField[];
}

const PAYMENT_CATALOG: CatalogItem[] = [
  // ── Wallet ──
  { id: "paypal",        name: "PayPal",           svgFile: "card_paypal.svg",            domain: "paypal.com",          category: "Wallet",  color: "#0070ba", defaultFields: [{ key: "paypal_email", label: "PayPal Email", type: "email", required: true, placeholder: "your@paypal.com" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Name on PayPal" }] },
  { id: "skrill",        name: "Skrill",            svgFile: "card_skrill_sofort.svg",     domain: "skrill.com",          category: "Wallet",  color: "#862165", defaultFields: [{ key: "skrill_email", label: "Skrill Email", type: "email", required: true, placeholder: "your@skrill.com" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full legal name" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "e.g. Sri Lanka" }, { key: "phone", label: "Phone Number", type: "text", required: false, placeholder: "Optional" }] },
  { id: "neteller",      name: "Neteller",          svgFile: "card_neteller.svg",          domain: "neteller.com",        category: "Wallet",  color: "#8b0000", defaultFields: [{ key: "neteller_email", label: "Neteller Email / ID", type: "email", required: true, placeholder: "your@neteller.com" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "Country" }] },
  { id: "payoneer",      name: "Payoneer",          svgFile: null,                         domain: "payoneer.com",        category: "Wallet",  color: "#ff4800", defaultFields: [{ key: "payoneer_email", label: "Payoneer Email", type: "email", required: true, placeholder: "your@payoneer.com" }, { key: "account_holder_name", label: "Account Holder Name", type: "text", required: true, placeholder: "Full name" }, { key: "recipient_id", label: "Recipient ID", type: "text", required: false, placeholder: "Optional" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "e.g. Sri Lanka" }, { key: "currency", label: "Currency", type: "text", required: true, placeholder: "e.g. USD" }] },
  { id: "wise",          name: "Wise",              svgFile: null,                         domain: "wise.com",            category: "Wallet",  color: "#9fe870", defaultFields: [{ key: "wise_email", label: "Wise Email", type: "email", required: true, placeholder: "your@wise.com" }, { key: "account_holder_name", label: "Account Holder Name", type: "text", required: true, placeholder: "Full name" }, { key: "bank_country", label: "Bank Country", type: "text", required: true, placeholder: "e.g. United Kingdom" }, { key: "currency", label: "Currency", type: "text", required: true, placeholder: "e.g. GBP" }, { key: "iban", label: "IBAN / Account Number", type: "text", required: true, placeholder: "GB29NWBK..." }, { key: "swift_bic", label: "SWIFT / BIC", type: "text", required: false, placeholder: "Optional" }] },
  { id: "amazon_pay",    name: "Amazon Pay",        svgFile: "card_amazon_pay.svg",        domain: "pay.amazon.com",      category: "Wallet",  color: "#ff9900", defaultFields: [{ key: "email", label: "Amazon Email", type: "email", required: true, placeholder: "your@amazon.com" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }] },
  { id: "paysafecard",   name: "PaySafeCard",       svgFile: "card_paysafecard.svg",       domain: "paysafecard.com",     category: "Wallet",  color: "#003c96", defaultFields: [{ key: "card_code", label: "Card Code / PIN", type: "text", required: true, placeholder: "16-digit code" }, { key: "email", label: "Email", type: "email", required: true, placeholder: "Account email" }] },
  { id: "qiwi",          name: "QIWI",              svgFile: "card_qiwi.svg",              domain: "qiwi.com",            category: "Wallet",  color: "#ff8c00", defaultFields: [{ key: "phone", label: "QIWI Phone Number", type: "text", required: true, placeholder: "+7XXXXXXXXXX" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "Country" }] },
  // ── Bank ──
  { id: "bank_transfer", name: "Bank Transfer",     svgFile: "card_bank-transfer.svg",     domain: "swift.com",           category: "Bank",    color: "#1a73e8", defaultFields: [{ key: "account_holder_name", label: "Account Holder Name", type: "text", required: true, placeholder: "Full name" }, { key: "bank_name", label: "Bank Name", type: "text", required: true, placeholder: "e.g. Standard Bank" }, { key: "account_number", label: "Account Number / IBAN", type: "text", required: true, placeholder: "e.g. 1234567890" }, { key: "swift_bic", label: "SWIFT / BIC Code", type: "text", required: true, placeholder: "e.g. SBZAZAJJ" }, { key: "branch", label: "Bank Branch", type: "text", required: false, placeholder: "Optional" }, { key: "bank_address", label: "Bank Address", type: "text", required: false, placeholder: "Optional" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "e.g. South Africa" }, { key: "currency", label: "Currency", type: "text", required: true, placeholder: "e.g. ZAR / USD" }] },
  { id: "sepa",          name: "SEPA Direct Debit", svgFile: "card_sepa-direct-debit.svg", domain: null,                  category: "Bank",    color: "#003399", defaultFields: [{ key: "account_holder_name", label: "Account Holder Name", type: "text", required: true, placeholder: "Full name" }, { key: "iban", label: "IBAN", type: "text", required: true, placeholder: "DE89370400440532013000" }, { key: "bic", label: "BIC / SWIFT", type: "text", required: true, placeholder: "e.g. COBADEFFXXX" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "e.g. Germany" }] },
  { id: "direct_debit",  name: "Direct Debit",      svgFile: "card_direct_debit.svg",      domain: null,                  category: "Bank",    color: "#2c5f8a", defaultFields: [{ key: "account_holder_name", label: "Account Holder Name", type: "text", required: true, placeholder: "Full name" }, { key: "account_number", label: "Account Number", type: "text", required: true, placeholder: "e.g. 12345678" }, { key: "sort_code", label: "Sort Code / BSB", type: "text", required: true, placeholder: "e.g. 20-00-00" }, { key: "bank_name", label: "Bank Name", type: "text", required: true, placeholder: "Bank name" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "Country" }] },
  { id: "trustly",       name: "Trustly",           svgFile: "card_trustly.svg",           domain: "trustly.com",         category: "Bank",    color: "#0ee06e", defaultFields: [{ key: "email", label: "Email", type: "email", required: true, placeholder: "your@email.com" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "Country" }] },
  // ── Crypto ──
  { id: "binance",       name: "Binance",           svgFile: null,                         domain: "binance.com",         category: "Crypto",  color: "#f0b90b", defaultFields: [{ key: "network", label: "Network", type: "text", required: true, placeholder: "TRC20 / BEP20 / ERC20" }, { key: "wallet_address", label: "Wallet Address", type: "text", required: true, placeholder: "Your wallet address" }, { key: "account_email", label: "Account Email", type: "email", required: false, placeholder: "Optional Binance email" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "e.g. Sri Lanka" }] },
  { id: "bitcoin",       name: "Bitcoin",           svgFile: "card_bitcoin.svg",           domain: "bitcoin.org",         category: "Crypto",  color: "#f7931a", defaultFields: [{ key: "wallet_address", label: "Bitcoin Wallet Address", type: "text", required: true, placeholder: "bc1q..." }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "e.g. Sri Lanka" }] },
  { id: "ethereum",      name: "Ethereum",          svgFile: "card_ethereum.svg",          domain: "ethereum.org",        category: "Crypto",  color: "#627eea", defaultFields: [{ key: "wallet_address", label: "ETH Wallet Address", type: "text", required: true, placeholder: "0x..." }, { key: "network", label: "Network", type: "text", required: true, placeholder: "Mainnet / BSC / Polygon" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "Country" }] },
  { id: "usdt",          name: "USDT (Tether)",     svgFile: null,                         domain: "tether.to",           category: "Crypto",  color: "#26a17b", defaultFields: [{ key: "network", label: "Network", type: "text", required: true, placeholder: "TRC20 / BEP20 / ERC20" }, { key: "wallet_address", label: "Wallet Address", type: "text", required: true, placeholder: "Your USDT wallet address" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "e.g. Sri Lanka" }] },
  { id: "litecoin",      name: "Litecoin",          svgFile: "card_litecoin.svg",          domain: "litecoin.org",        category: "Crypto",  color: "#a6a9aa", defaultFields: [{ key: "wallet_address", label: "Litecoin Address", type: "text", required: true, placeholder: "L..." }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "Country" }] },
  { id: "ripple",        name: "Ripple (XRP)",      svgFile: "card_ripple.svg",            domain: "ripple.com",          category: "Crypto",  color: "#346aa9", defaultFields: [{ key: "wallet_address", label: "XRP Wallet Address", type: "text", required: true, placeholder: "r..." }, { key: "destination_tag", label: "Destination Tag", type: "text", required: false, placeholder: "Optional tag" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "Country" }] },
  { id: "coinbase",      name: "Coinbase",          svgFile: "card_coinbase.svg",          domain: "coinbase.com",        category: "Crypto",  color: "#0052ff", defaultFields: [{ key: "email", label: "Coinbase Email", type: "email", required: true, placeholder: "your@coinbase.com" }, { key: "wallet_address", label: "Wallet Address", type: "text", required: false, placeholder: "Optional" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "Country" }] },
  { id: "trust_wallet",  name: "Trust Wallet",      svgFile: null,                         domain: "trustwallet.com",     category: "Crypto",  color: "#3375bb", defaultFields: [{ key: "wallet_address", label: "Wallet Address", type: "text", required: true, placeholder: "Your Trust Wallet address" }, { key: "network", label: "Network", type: "text", required: true, placeholder: "BSC / ETH / TRX" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }] },
  { id: "go_crypto",     name: "GoCrypto",          svgFile: "card_go-crypto.svg",         domain: null,                  category: "Crypto",  color: "#00b5e2", defaultFields: [{ key: "wallet_address", label: "Wallet Address", type: "text", required: true, placeholder: "Wallet address" }, { key: "email", label: "Email", type: "email", required: true, placeholder: "your@email.com" }] },
  // ── Card ──
  { id: "visa",          name: "Visa",              svgFile: "card_visa.svg",              domain: "visa.com",            category: "Card",    color: "#1a1f71", defaultFields: [{ key: "cardholder_name", label: "Cardholder Name", type: "text", required: true, placeholder: "Name on card" }, { key: "account_number", label: "Last 4 Digits", type: "text", required: true, placeholder: "e.g. 4242" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "Billing country" }] },
  { id: "mastercard",    name: "Mastercard",        svgFile: "card_mastercard.svg",        domain: "mastercard.com",      category: "Card",    color: "#eb001b", defaultFields: [{ key: "cardholder_name", label: "Cardholder Name", type: "text", required: true, placeholder: "Name on card" }, { key: "account_number", label: "Last 4 Digits", type: "text", required: true, placeholder: "e.g. 5555" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "Billing country" }] },
  { id: "amex",          name: "Amex",              svgFile: "card_american-express.svg",  domain: "americanexpress.com", category: "Card",    color: "#007bc1", defaultFields: [{ key: "cardholder_name", label: "Cardholder Name", type: "text", required: true, placeholder: "Name on card" }, { key: "account_number", label: "Last 4 Digits", type: "text", required: true, placeholder: "e.g. 3782" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "Billing country" }] },
  { id: "maestro",       name: "Maestro",           svgFile: "card_maestro.svg",           domain: null,                  category: "Card",    color: "#0099df", defaultFields: [{ key: "cardholder_name", label: "Cardholder Name", type: "text", required: true, placeholder: "Name on card" }, { key: "account_number", label: "Last 4 Digits", type: "text", required: true, placeholder: "e.g. 6759" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "Country" }] },
  { id: "discover",      name: "Discover",          svgFile: "card_discover.svg",          domain: "discover.com",        category: "Card",    color: "#ff6600", defaultFields: [{ key: "cardholder_name", label: "Cardholder Name", type: "text", required: true, placeholder: "Name on card" }, { key: "account_number", label: "Last 4 Digits", type: "text", required: true, placeholder: "e.g. 6011" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "Billing country" }] },
  { id: "jcb",           name: "JCB",               svgFile: "card_jcb.svg",               domain: "jcb.co.jp",           category: "Card",    color: "#003087", defaultFields: [{ key: "cardholder_name", label: "Cardholder Name", type: "text", required: true, placeholder: "Name on card" }, { key: "account_number", label: "Last 4 Digits", type: "text", required: true, placeholder: "e.g. 3530" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "Country" }] },
  { id: "diners",        name: "Diners Club",       svgFile: "card_diners-club.svg",       domain: "dinersclub.com",      category: "Card",    color: "#004a97", defaultFields: [{ key: "cardholder_name", label: "Cardholder Name", type: "text", required: true, placeholder: "Name on card" }, { key: "account_number", label: "Last 4 Digits", type: "text", required: true, placeholder: "e.g. 3000" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "Country" }] },
  { id: "unionpay",      name: "UnionPay",          svgFile: "card_unionpay.svg",          domain: "unionpayintl.com",    category: "Card",    color: "#e21836", defaultFields: [{ key: "cardholder_name", label: "Cardholder Name", type: "text", required: true, placeholder: "Name on card" }, { key: "account_number", label: "Last 4 Digits", type: "text", required: true, placeholder: "e.g. 6250" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "Country" }] },
  // ── Digital ──
  { id: "google_pay",    name: "Google Pay",        svgFile: "card_google-pay.svg",        domain: "pay.google.com",      category: "Digital", color: "#4285f4", defaultFields: [{ key: "email_or_phone", label: "Email or Phone", type: "text", required: true, placeholder: "Linked Google Pay account" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }] },
  { id: "apple_pay",     name: "Apple Pay",         svgFile: "card_apple-pay.svg",         domain: "apple.com",           category: "Digital", color: "#555555", defaultFields: [{ key: "apple_id_email", label: "Apple ID Email", type: "email", required: true, placeholder: "Apple ID email" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }] },
  { id: "samsung_pay",   name: "Samsung Pay",       svgFile: "card_samsung-pay.svg",       domain: "samsung.com",         category: "Digital", color: "#1428a0", defaultFields: [{ key: "email", label: "Samsung Account Email", type: "email", required: true, placeholder: "Samsung account email" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }] },
  { id: "wechat_pay",    name: "WeChat Pay",        svgFile: "card_wechat-pay.svg",        domain: "weixin.qq.com",       category: "Digital", color: "#07c160", defaultFields: [{ key: "wechat_id", label: "WeChat ID", type: "text", required: true, placeholder: "WeChat username / ID" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "Country" }] },
  { id: "alipay",        name: "Alipay",            svgFile: "card_alipay.svg",            domain: "alipay.com",          category: "Digital", color: "#1677ff", defaultFields: [{ key: "alipay_account", label: "Alipay Account", type: "text", required: true, placeholder: "Email or phone" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "Country" }] },
  // ── Gateway ──
  { id: "stripe",        name: "Stripe",            svgFile: "card_stripe.svg",            domain: "stripe.com",          category: "Gateway", color: "#635bff", defaultFields: [{ key: "email", label: "Email Address", type: "email", required: true, placeholder: "your@email.com" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "Country" }] },
  { id: "klarna",        name: "Klarna",            svgFile: "card_klarna.svg",            domain: "klarna.com",          category: "Gateway", color: "#ffb3c7", defaultFields: [{ key: "email", label: "Email", type: "email", required: true, placeholder: "your@email.com" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "Country" }] },
  { id: "braintree",     name: "Braintree",         svgFile: "card_braintree.svg",         domain: "braintreepayments.com", category: "Gateway", color: "#009cde", defaultFields: [{ key: "email", label: "Email", type: "email", required: true, placeholder: "your@email.com" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }] },
  // ── Local ──
  { id: "ideal",         name: "iDEAL",             svgFile: "card_ideal.svg",             domain: "ideal.nl",            category: "Local",   color: "#cc0066", defaultFields: [{ key: "bank_name", label: "Bank Name", type: "text", required: true, placeholder: "e.g. ING / ABN AMRO" }, { key: "account_holder_name", label: "Account Holder Name", type: "text", required: true, placeholder: "Full name" }, { key: "iban", label: "IBAN", type: "text", required: true, placeholder: "NL..." }] },
  { id: "bancontact",    name: "Bancontact",         svgFile: "card_bancontact.svg",        domain: null,                  category: "Local",   color: "#005499", defaultFields: [{ key: "account_holder_name", label: "Account Holder Name", type: "text", required: true, placeholder: "Full name" }, { key: "iban", label: "IBAN", type: "text", required: true, placeholder: "BE..." }, { key: "bic", label: "BIC", type: "text", required: true, placeholder: "e.g. GEBABEBB" }] },
  { id: "giropay",       name: "Giropay",           svgFile: "card_giropay.svg",           domain: null,                  category: "Local",   color: "#000268", defaultFields: [{ key: "account_holder_name", label: "Account Holder Name", type: "text", required: true, placeholder: "Full name" }, { key: "iban", label: "IBAN", type: "text", required: true, placeholder: "DE..." }, { key: "bic", label: "BIC", type: "text", required: true, placeholder: "BIC code" }] },
  { id: "sofort",        name: "Sofort",            svgFile: "card_sofort.svg",            domain: "sofort.com",          category: "Local",   color: "#ef3b24", defaultFields: [{ key: "account_holder_name", label: "Account Holder Name", type: "text", required: true, placeholder: "Full name" }, { key: "iban", label: "IBAN", type: "text", required: true, placeholder: "DE..." }, { key: "country", label: "Country", type: "text", required: true, placeholder: "e.g. Germany" }] },
  { id: "eps",           name: "EPS",               svgFile: "card_eps.svg",               domain: null,                  category: "Local",   color: "#c8161d", defaultFields: [{ key: "account_holder_name", label: "Account Holder Name", type: "text", required: true, placeholder: "Full name" }, { key: "iban", label: "IBAN", type: "text", required: true, placeholder: "AT..." }, { key: "bic", label: "BIC", type: "text", required: true, placeholder: "BIC code" }] },
  { id: "przelewy24",    name: "Przelewy24",        svgFile: "card_przelewy24.svg",        domain: "przelewy24.pl",       category: "Local",   color: "#d8192b", defaultFields: [{ key: "email", label: "Email", type: "email", required: true, placeholder: "your@email.com" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }, { key: "bank_name", label: "Bank Name", type: "text", required: true, placeholder: "Polish bank name" }] },
  { id: "twint",         name: "TWINT",             svgFile: "card_twint.svg",             domain: "twint.ch",            category: "Local",   color: "#000000", defaultFields: [{ key: "phone", label: "Swiss Phone Number", type: "text", required: true, placeholder: "+41XXXXXXXXX" }, { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Full name" }] },
  { id: "belfius",       name: "Belfius",           svgFile: "card_belfius.svg",           domain: "belfius.be",          category: "Local",   color: "#e30016", defaultFields: [{ key: "account_holder_name", label: "Account Holder Name", type: "text", required: true, placeholder: "Full name" }, { key: "iban", label: "IBAN", type: "text", required: true, placeholder: "BE..." }, { key: "bic", label: "BIC", type: "text", required: true, placeholder: "e.g. GKCCBEBB" }] },
  // ── Other ──
  { id: "western_union", name: "Western Union",     svgFile: "card_western_union.svg",     domain: "westernunion.com",    category: "Other",   color: "#fdbb30", defaultFields: [{ key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Receiver full name" }, { key: "country", label: "Country", type: "text", required: true, placeholder: "Receiver country" }, { key: "city", label: "City", type: "text", required: true, placeholder: "Receiver city" }, { key: "phone", label: "Phone Number", type: "text", required: true, placeholder: "Receiver phone" }] },
  { id: "custom",        name: "Custom",            svgFile: null,                         domain: null,                  category: "Other",   color: "#6b7280", defaultFields: [] },
];

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function profileUrl(pic: string | null | undefined): string | null {
  if (!pic) return null;
  if (pic.startsWith("http") || pic.startsWith("data:")) return pic;
  return `/uploads/${pic.split(/[\\/]/).pop()}`;
}

function proofUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  return path.startsWith("/") ? path : `/uploads/${path.replace(/^\/+/, "")}`;
}

function parseFieldList(value: P2PTransaction["admin_fields"]) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isImageProof(url: string | null) {
  if (!url) return false;
  return url.startsWith("data:image/") || /\.(png|jpe?g|jfif|gif|webp|bmp)$/i.test(url.split("?")[0]);
}

// ─── Logo helper ──────────────────────────────────────────────────────────────
function PaymentLogo({ item, size = 28 }: { item: CatalogItem; size?: number }) {
  const [src, setSrc] = useState<string | null>(item.svgFile ? `${PR}${item.svgFile}` : item.domain ? `https://logo.clearbit.com/${item.domain}` : null);
  const initials = item.name.slice(0, 2).toUpperCase();
  if (!src) return (
    <span style={{ width: size, height: size, fontSize: size * 0.38, background: item.color + "33", border: `1px solid ${item.color}55` }}
      className="rounded-lg flex items-center justify-center font-black text-white shrink-0">{initials}</span>
  );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={item.name} width={size} height={size}
      style={{ width: size, height: size, objectFit: "contain", borderRadius: 6 }}
      className="shrink-0 bg-white/10 p-0.5"
      onError={() => {
        if (src.includes("payrexx") && item.domain) { setSrc(`https://logo.clearbit.com/${item.domain}`); return; }
        setSrc(null);
      }} />
  );
}

// ─── Method Logo (saved method by name, find catalog match) ──────────────────
function MethodLogo({ name, size = 28 }: { name: string; size?: number }) {
  const cat = PAYMENT_CATALOG.find(c => c.name.toLowerCase() === name.toLowerCase()) || null;
  if (!cat) {
    const initials = name.slice(0, 2).toUpperCase();
    return <span style={{ width: size, height: size, fontSize: size * 0.38 }} className="rounded-lg flex items-center justify-center font-black text-white bg-white/10 border border-white/10 shrink-0">{initials}</span>;
  }
  return <PaymentLogo item={cat} size={size} />;
}

// ─── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES = ["All", "Wallet", "Bank", "Crypto", "Card", "Digital", "Gateway", "Local", "Other"];

type PageView = "home" | "topup-methods" | "requests" | "buy-coins" | "sell-coins";

export default function AdminTopupPage() {
  const [view, setView] = useState<PageView>("buy-coins");

  // ── Topup Methods state ──
  const [methods, setMethods] = useState<TopupMethod[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [catFilter, setCatFilter] = useState("All");
  const [catSearch, setCatSearch] = useState("");
  const [editMethod, setEditMethod] = useState<TopupMethod | null>(null);
  const [addFromCatalog, setAddFromCatalog] = useState<CatalogItem | null>(null);
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [methodError, setMethodError] = useState("");

  // new method form
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("cash-outline");
  const [newCategory, setNewCategory] = useState("Other");
  const [newFields, setNewFields] = useState<FormField[]>([]);
  const [newActive, setNewActive] = useState(true);

  // ── Coin Requests state ──
  const [requests, setRequests] = useState<CoinRequest[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqFilter, setReqFilter] = useState("All");
  const [userTypeFilter, setUserTypeFilter] = useState("All");
  const [reqDetail, setReqDetail] = useState<CoinRequest | null>(null);
  const [showMethodsPanel, setShowMethodsPanel] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ req: CoinRequest } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [currentUserType, setCurrentUserType] = useState("");
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [topupAssignments, setTopupAssignments] = useState<TopupRequestAssignment[]>([]);
  const [topupAssignmentSelections, setTopupAssignmentSelections] = useState<Record<number, number>>({});
  const [assigningTopupId, setAssigningTopupId] = useState<number | null>(null);

  // P2P transaction reports
  const [buyTransactions, setBuyTransactions] = useState<P2PTransaction[]>([]);
  const [sellTransactions, setSellTransactions] = useState<P2PTransaction[]>([]);
  const [p2pLoading, setP2pLoading] = useState(false);
  const [p2pStatusFilter, setP2pStatusFilter] = useState("All");
  const [p2pError, setP2pError] = useState("");
  const [proofModal, setProofModal] = useState<{ tx: P2PTransaction; url: string } | null>(null);
  const [chatModal, setChatModal] = useState<{ tx: P2PTransaction; role: "seller" | "buyer"; participantId: number; participantName: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    authService.getProfile()
      .then((profile: any) => setCurrentUserType(String(profile?.user_type || "")))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (view === "topup-methods" && methods.length === 0) loadMethods();
    if (view === "requests" && requests.length === 0) loadRequests();
    if (view === "buy-coins" && buyTransactions.length === 0) loadP2PTransactions("buy");
    if (view === "sell-coins" && sellTransactions.length === 0) loadP2PTransactions("sell");
  }, [view]);

  const normalizedUserType = currentUserType.trim().toLowerCase().replace(/\s+/g, "_");
  const isSuperAdmin = normalizedUserType === "super_admin" || normalizedUserType === "superadmin";
  const currentAdminChatLabel = isSuperAdmin ? "Googer Support" : "Admin";

  const loadMethods = async () => {
    setMethodsLoading(true);
    try { setMethods(await adminService.fetchTopupPaymentMethods()); }
    catch { /* silent */ } finally { setMethodsLoading(false); }
  };

  const loadRequests = async () => {
    setReqLoading(true);
    try { setRequests(await adminService.fetchCoinRequests()); }
    catch { /* silent */ } finally { setReqLoading(false); }
  };

  const loadAdminUsers = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      if (!token) return;
      const response = await fetch("/api/users/all", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json().catch(() => []);
      const rows = Array.isArray(data) ? data : [];
      setAdminUsers(
        rows.filter((row: any) => String(row?.user_type || "").toLowerCase() === "admin")
      );
    } catch {
      setAdminUsers([]);
    }
  };

  const loadTopupAssignments = async () => {
    try {
      const rows = await chatService.listAssignedTopupRequestChats();
      setTopupAssignments(Array.isArray(rows) ? rows : []);
    } catch {
      setTopupAssignments([]);
    }
  };

  const assignTopupAdmin = async (request: CoinRequest, assignedAdminId?: number | null) => {
    const topupRequestId = Number(request.id);
    setAssigningTopupId(topupRequestId);
    setReviewError("");
    try {
      await chatService.assignTopupRequestAdmin(topupRequestId, assignedAdminId ?? null);
      await loadTopupAssignments();
      setTopupAssignmentSelections((prev) => ({
        ...prev,
        [topupRequestId]: assignedAdminId ? Number(assignedAdminId) : 0,
      }));
    } catch (err: any) {
      setReviewError(err.message || "Failed to assign admin");
    } finally {
      setAssigningTopupId(null);
    }
  };

  useEffect(() => {
    if (view !== "requests" || !isSuperAdmin) return;
    loadAdminUsers();
    loadTopupAssignments();
  }, [view, isSuperAdmin]);

  const loadP2PTransactions = async (kind: "buy" | "sell") => {
    setP2pLoading(true);
    setP2pError("");
    try {
      const rows = kind === "buy"
        ? await adminService.fetchP2PBuyTransactions()
        : await adminService.fetchP2PSellTransactions();
      if (kind === "buy") setBuyTransactions(rows);
      else setSellTransactions(rows);
    } catch (err: any) {
      setP2pError(err.message || "Failed to fetch transactions");
    } finally {
      setP2pLoading(false);
    }
  };

  const openP2PChat = async (tx: P2PTransaction, role: "seller" | "buyer") => {
    const participantId = Number(role === "seller" ? tx.seller_id : tx.buyer_id);
    const participantName = role === "seller"
      ? (tx.seller_name || tx.seller_username || "Seller")
      : (tx.buyer_name || tx.buyer_username || "Buyer");
    if (!participantId) return;

    setChatModal({ tx, role, participantId, participantName });
    setChatText("");
    setChatError("");
    setChatLoading(true);
    try {
      await chatService.updatePresence(participantId, null, null).catch(() => {});
      const messages = await chatService.getMessages(participantId, true);
      setChatMessages(Array.isArray(messages) ? messages : []);
    } catch (err: any) {
      setChatError(err.message || "Failed to open chat");
      setChatMessages([]);
    } finally {
      setChatLoading(false);
    }
  };

  const closeP2PChat = () => {
    setChatModal(null);
    setChatMessages([]);
    setChatText("");
    setChatError("");
    chatService.updatePresence(null, null, null).catch(() => {});
  };

  const sendP2PChatMessage = async () => {
    if (!chatModal || !chatText.trim()) return;
    setChatSending(true);
    setChatError("");
    try {
      const message = await chatService.sendMessage({
        receiverId: chatModal.participantId,
        type: "text",
        text: chatText.trim(),
      });
      setChatMessages(prev => [...prev, message]);
      setChatText("");
    } catch (err: any) {
      setChatError(err.message || "Failed to send message");
    } finally {
      setChatSending(false);
    }
  };

  // ── Build field list from catalog item ──
  const openCatalogItem = (item: CatalogItem) => {
    setAddFromCatalog(item);
    setNewName(item.name);
    setNewIcon("cash-outline");
    setNewCategory(item.category);
    setNewFields(item.defaultFields.map(f => ({ ...f })));
    setNewActive(true);
    setMethodError("");
    setShowCatalogPicker(false);
  };

  const openCustomForm = () => {
    setAddFromCatalog(null);
    setNewName("");
    setNewIcon("cash-outline");
    setNewCategory("Other");
    setNewFields([]);
    setNewActive(true);
    setMethodError("");
    setShowCatalogPicker(false);
    setShowCustomForm(true);
  };

  const openEditMethod = (m: TopupMethod) => {
    setEditMethod(m);
    setNewName(m.name);
    setNewIcon(m.icon);
    setNewCategory(m.category || "Other");
    setNewFields(m.fields.map(f => ({ ...f })));
    setNewActive(m.is_active);
    setMethodError("");
    setAddFromCatalog(null);
    setShowCustomForm(false);
  };

  const closeMethodForm = () => {
    setEditMethod(null);
    setAddFromCatalog(null);
    setShowCustomForm(false);
    setMethodError("");
    setNewCategory("Other");
  };

  const saveMethod = async () => {
    if (!newName.trim()) { setMethodError("Name is required"); return; }
    setSaving(true); setMethodError("");
    try {
      const payload = { name: newName.trim(), icon: newIcon, category: newCategory, fields: newFields, is_active: newActive };
      if (editMethod) {
        const updated = await adminService.updateTopupPaymentMethod(editMethod.id, payload);
        setMethods(prev => prev.map(m => m.id === editMethod.id ? updated : m));
      } else {
        const created = await adminService.createTopupPaymentMethod(payload);
        setMethods(prev => [created, ...prev]);
      }
      closeMethodForm();
    } catch (err: any) { setMethodError(err.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  const toggleMethodActive = async (m: TopupMethod) => {
    try {
      const updated = await adminService.updateTopupPaymentMethod(m.id, { is_active: !m.is_active });
      setMethods(prev => prev.map(x => x.id === m.id ? updated : x));
    } catch { /* silent */ }
  };

  const deleteMethod = async (m: TopupMethod) => {
    if (!confirm(`Delete "${m.name}"?`)) return;
    try {
      await adminService.deleteTopupPaymentMethod(m.id);
      setMethods(prev => prev.filter(x => x.id !== m.id));
    } catch { /* silent */ }
  };

  const addField = () => setNewFields(prev => [...prev, { key: `field_${Date.now()}`, label: "", type: "text", required: false, placeholder: "" }]);
  const removeField = (idx: number) => setNewFields(prev => prev.filter((_, i) => i !== idx));
  const updateField = (idx: number, key: keyof FormField, val: any) =>
    setNewFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: val } : f));

  // ── Review actions ──
  const approveRequest = async (req: CoinRequest) => {
    setReviewLoading(true); setReviewError("");
    try {
      const updated = await adminService.reviewCoinRequest(req.id, "approve");
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, ...updated } : r));
      if (reqDetail?.id === req.id) setReqDetail(prev => prev ? { ...prev, ...updated } : null);
    } catch (err: any) { setReviewError(err.message || "Failed to approve"); }
    finally { setReviewLoading(false); }
  };

  const rejectRequest = async () => {
    if (!rejectModal || !rejectReason.trim()) return;
    setReviewLoading(true); setReviewError("");
    try {
      const updated = await adminService.reviewCoinRequest(rejectModal.req.id, "reject", rejectReason.trim());
      setRequests(prev => prev.map(r => r.id === rejectModal.req.id ? { ...r, ...updated } : r));
      if (reqDetail?.id === rejectModal.req.id) setReqDetail(prev => prev ? { ...prev, ...updated } : null);
      setRejectModal(null); setRejectReason("");
    } catch (err: any) { setReviewError(err.message || "Failed to reject"); }
    finally { setReviewLoading(false); }
  };

  const USER_TYPES = ["All", ...Array.from(new Set(requests.map(r => r.user_type).filter(Boolean)))];
  const filteredRequests = requests.filter(r =>
    (reqFilter === "All" || r.status === reqFilter) &&
    (userTypeFilter === "All" || r.user_type?.toLowerCase() === userTypeFilter.toLowerCase())
  );
  const topupAssignmentMap = useMemo(
    () => new Map(topupAssignments.map((assignment) => [assignment.topup_request_id, assignment])),
    [topupAssignments]
  );
  const activeP2PTransactions = view === "sell-coins" ? sellTransactions : buyTransactions;
  const filteredP2PTransactions = activeP2PTransactions.filter(tx =>
    p2pStatusFilter === "All" || tx.status?.toLowerCase() === p2pStatusFilter.toLowerCase()
  );
  const isFormOpen = !!(editMethod || addFromCatalog || showCustomForm);
  const catalogFiltered = PAYMENT_CATALOG.filter(c =>
    (catFilter === "All" || c.category === catFilter) &&
    c.name.toLowerCase().includes(catSearch.toLowerCase())
  );

  const renderViewTabs = () => {
    const tabs: Array<{ key: PageView; label: string; icon: string; active: boolean }> = [
      { key: "buy-coins", label: "Buy Coins", icon: "cart-outline", active: view === "buy-coins" },
      { key: "sell-coins", label: "Sell Coins", icon: "swap-horizontal-outline", active: view === "sell-coins" },
      { key: "requests", label: "Top Up", icon: "add-circle-outline", active: view === "requests" || view === "topup-methods" },
    ];

    return (
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setView(tab.key)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition ${
              tab.active
                ? "bg-white text-black shadow-lg shadow-white/10"
                : "border border-white/10 bg-white/[0.04] text-white/45 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            <IonIcon name={tab.icon} className="text-xs" />
            {tab.label}
          </button>
        ))}
      </div>
    );
  };

  // ─── HOME ─────────────────────────────────────────────────────────────────
  if (view === "home") return (
    <div className="space-y-6">
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Admin</p>
        <h1 className="text-base font-black uppercase tracking-tight text-white">Top-Up / Requests</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Buy */}
        <button onClick={() => setView("buy-coins")}
          className="group rounded-[1.75rem] border border-sky-500/20 bg-sky-500/[0.06] p-6 text-left transition hover:bg-sky-500/[0.12] hover:border-sky-500/40 active:scale-[0.98]">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-500/30 bg-sky-500/15 text-sky-400 mb-4">
            <IonIcon name="cart-outline" className="text-xl" />
          </div>
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-sky-400/70 mb-1">P2P Report</p>
          <h2 className="text-lg font-black uppercase tracking-tight text-white">Buy Coins</h2>
          <p className="mt-2 text-[9px] text-white/30">View buy coin transactions, status, proofs and reports</p>
          <div className="mt-4 flex items-center gap-1.5 text-sky-400/50 text-[9px] font-black uppercase tracking-widest group-hover:text-sky-400 transition">
            Open Details <IonIcon name="arrow-forward-outline" className="text-xs" />
          </div>
        </button>

        {/* Sell */}
        <button onClick={() => setView("sell-coins")}
          className="group rounded-[1.75rem] border border-violet-500/20 bg-violet-500/[0.06] p-6 text-left transition hover:bg-violet-500/[0.12] hover:border-violet-500/40 active:scale-[0.98]">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/15 text-violet-400 mb-4">
            <IonIcon name="swap-horizontal-outline" className="text-xl" />
          </div>
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-violet-400/70 mb-1">P2P Report</p>
          <h2 className="text-lg font-black uppercase tracking-tight text-white">Sell Coins</h2>
          <p className="mt-2 text-[9px] text-white/30">View sell coin transactions, status, proofs and reports</p>
          <div className="mt-4 flex items-center gap-1.5 text-violet-400/50 text-[9px] font-black uppercase tracking-widest group-hover:text-violet-400 transition">
            Open Details <IonIcon name="arrow-forward-outline" className="text-xs" />
          </div>
        </button>

        {/* Top Up */}
        <div className="rounded-[1.75rem] border border-emerald-500/20 bg-emerald-500/[0.06] p-6 space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 mb-4">
            <IonIcon name="add-circle-outline" className="text-xl" />
          </div>
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-400/70 mb-1">Manage</p>
          <h2 className="text-lg font-black uppercase tracking-tight text-white">Top Up</h2>
          <div className="space-y-2 pt-1">
            <button onClick={() => setView("requests")}
              className="w-full flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-left hover:bg-emerald-500/20 transition">
              <IonIcon name="time-outline" className="text-sm text-emerald-400 shrink-0" />
              <div>
                <p className="text-[10px] font-black text-white">Requests</p>
                <p className="text-[8px] text-white/30">Review pending topup requests</p>
              </div>
              <IonIcon name="chevron-forward-outline" className="ml-auto text-[10px] text-emerald-400/40" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (view === "buy-coins" || view === "sell-coins") {
    const isSell = view === "sell-coins";
    const title = isSell ? "Sell Coins Seller Side Details" : "Buy Coins Seller Side Details";
    const kind = isSell ? "sell" : "buy";

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">P2P Transaction Report</p>
            <h1 className="text-base font-black uppercase tracking-tight text-white">{title}</h1>
          </div>
          {renderViewTabs()}
          <button onClick={() => loadP2PTransactions(kind)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white transition">
            <IonIcon name="refresh-outline" className="text-sm" />
          </button>
        </div>

        {p2pError && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
            <IonIcon name="alert-circle-outline" className="shrink-0 text-sm text-rose-400" />
            <p className="text-[10px] font-bold text-rose-300">{p2pError}</p>
          </div>
        )}

        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {["All", "pending", "completed", "cancelled"].map(s => (
            <button key={s} onClick={() => setP2pStatusFilter(s)}
              className={`shrink-0 rounded-2xl px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition ${p2pStatusFilter === s ? "bg-white text-black" : "bg-white/[0.04] text-white/40 hover:bg-white/[0.08]"}`}>
              {s}
              <span className="ml-1.5 opacity-60">
                {s === "All" ? activeP2PTransactions.length : activeP2PTransactions.filter(tx => tx.status?.toLowerCase() === s).length}
              </span>
            </button>
          ))}
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] overflow-hidden">
          {p2pLoading ? (
            <div className="p-12 text-center text-[10px] font-black uppercase tracking-widest text-white/25">Loading...</div>
          ) : filteredP2PTransactions.length === 0 ? (
            <div className="p-12 text-center">
              <IonIcon name="receipt-outline" className="text-4xl text-white/10 block mx-auto mb-3" />
              <p className="text-[10px] font-black uppercase tracking-widest text-white/25">No {p2pStatusFilter !== "All" ? p2pStatusFilter : ""} transactions</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[9px] font-black uppercase tracking-[0.18em] text-white/30">
                    <th className="px-5 py-4">Seller Flow</th>
                    <th className="px-5 py-4">Seller / Buyer</th>
                    <th className="px-5 py-4">Amount</th>
                    <th className="px-5 py-4">Proof</th>
                    <th className="px-5 py-4">Reports</th>
                    <th className="px-5 py-4">Chats / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredP2PTransactions.map(tx => {
                    const image = proofUrl(tx.screenshot_data);
                    const sellerFields = parseFieldList(tx.admin_fields);
                    const buyerFields = parseFieldList(tx.buyer_fields);
                    return (
                      <tr key={tx.id} className="hover:bg-white/[0.02] transition align-top">
                        <td className="px-5 py-4 min-w-[180px]">
                          <p className="text-[11px] font-black text-white">#{tx.id}</p>
                          <p className="text-[10px] text-white/45 mt-0.5">{tx.ad_name || "Unknown method"}</p>
                          <p className="text-[9px] text-white/25 mt-0.5">{tx.category || "P2P"} {tx.crypto_currency ? `- ${tx.crypto_currency}` : ""}</p>
                          <div className="mt-2 grid grid-cols-2 gap-1.5">
                            <div className="rounded-lg bg-black/20 border border-white/[0.05] px-2 py-1">
                              <p className="text-[7px] font-black uppercase tracking-widest text-white/25">Rate</p>
                              <p className="text-[9px] font-bold text-white">R {tx.lkr_rate || "-"}</p>
                            </div>
                            <div className="rounded-lg bg-black/20 border border-white/[0.05] px-2 py-1">
                              <p className="text-[7px] font-black uppercase tracking-widest text-white/25">Release</p>
                              <p className="text-[9px] font-bold text-white">{tx.release_value ? `${tx.release_value}${tx.release_unit || "h"}` : "-"}</p>
                            </div>
                          </div>
                          {sellerFields.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {sellerFields.slice(0, 3).map(field => (
                                <div key={field.key || field.label} className="flex justify-between gap-2 rounded-lg bg-violet-500/[0.06] border border-violet-500/10 px-2 py-1">
                                  <span className="text-[7px] font-black uppercase tracking-widest text-violet-400/70">{field.label || field.key}</span>
                                  <span className="text-[9px] font-bold text-white text-right break-all">{field.value || field.defaultValue || "-"}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="text-[9px] text-white/25 mt-2">{timeAgo(tx.created_at)} · {new Date(tx.created_at).toLocaleString()}</p>
                        </td>
                        <td className="px-5 py-4 min-w-[220px]">
                          <div className="space-y-2">
                            <div>
                              <p className="text-[8px] font-black uppercase tracking-widest text-violet-400/60">Seller</p>
                              <p className="text-[10px] font-bold text-white">{tx.seller_name || tx.seller_username || "Unknown"}</p>
                              <p className="text-[9px] text-white/30">@{tx.seller_username || "-"} · {tx.seller_readable_id || tx.seller_id}</p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black uppercase tracking-widest text-sky-400/60">Buyer</p>
                              <p className="text-[10px] font-bold text-white">{tx.buyer_name || tx.buyer_username || "Unknown"}</p>
                              <p className="text-[9px] text-white/30">@{tx.buyer_username || "-"} · {tx.buyer_readable_id || tx.buyer_id}</p>
                            </div>
                            {buyerFields.length > 0 && (
                              <div className="space-y-1 pt-1">
                                {buyerFields.slice(0, 3).map(field => (
                                  <div key={field.key || field.label} className="flex justify-between gap-2 rounded-lg bg-sky-500/[0.06] border border-sky-500/10 px-2 py-1">
                                    <span className="text-[7px] font-black uppercase tracking-widest text-sky-400/70">{field.label || field.key}</span>
                                    <span className="text-[9px] font-bold text-white text-right break-all">{field.value || field.defaultValue || "-"}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 min-w-[150px]">
                          <p className="text-[8px] font-black uppercase tracking-widest text-white/30">{isSell ? "R Amount" : "Paid Amount"}</p>
                          <p className="text-sm font-black text-white">R {parseFloat(tx.amount || "0").toFixed(2)}</p>
                          <p className="text-[8px] font-black uppercase tracking-widest text-white/30 mt-3">Receive</p>
                          <p className="text-[10px] font-bold text-emerald-400">{tx.receive_amount || "-"} {tx.receive_currency || ""}</p>
                        </td>
                        <td className="px-5 py-4 min-w-[170px]">
                          <p className="text-[9px] text-white/35 break-all">TX: {tx.tx_id || "-"}</p>
                          {image ? (
                            <button type="button" onClick={() => setProofModal({ tx, url: image })}
                              className="mt-2 inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-white/55 hover:text-white hover:bg-white/[0.08] transition">
                              <IonIcon name="document-attach-outline" className="text-xs" />View Post
                            </button>
                          ) : (
                            <p className="mt-2 text-[9px] text-white/20">No proof uploaded</p>
                          )}
                          {tx.screenshot_name && <p className="mt-1 text-[8px] text-white/25 break-all">{tx.screenshot_name}</p>}
                        </td>
                        <td className="px-5 py-4 min-w-[220px]">
                          {tx.buyer_report_reason || tx.seller_report_reason ? (
                            <div className="space-y-2">
                              {tx.buyer_report_reason && (
                                <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-2">
                                  <p className="text-[8px] font-black uppercase tracking-widest text-sky-400/70">Buyer Report</p>
                                  <p className="text-[10px] text-sky-100 mt-0.5">{tx.buyer_report_reason}</p>
                                  {tx.buyer_reported_at && <p className="text-[8px] text-sky-200/40 mt-1">{new Date(tx.buyer_reported_at).toLocaleString()}</p>}
                                </div>
                              )}
                              {tx.seller_report_reason && (
                                <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-2">
                                  <p className="text-[8px] font-black uppercase tracking-widest text-violet-400/70">Seller Report</p>
                                  <p className="text-[10px] text-violet-100 mt-0.5">{tx.seller_report_reason}</p>
                                  {tx.seller_reported_at && <p className="text-[8px] text-violet-200/40 mt-1">{new Date(tx.seller_reported_at).toLocaleString()}</p>}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-[9px] text-white/20">No reports</p>
                          )}
                        </td>
                        <td className="px-5 py-4 min-w-[130px]">
                          <div className="mb-3 grid grid-cols-1 gap-2">
                            <button type="button" onClick={() => openP2PChat(tx, "seller")}
                              className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2 text-left hover:bg-violet-500/[0.12] transition">
                              <div className="flex items-center gap-1.5">
                                <IonIcon name="chatbubble-ellipses-outline" className="text-violet-400 text-xs" />
                                <p className="text-[8px] font-black uppercase tracking-widest text-violet-400/80">Seller Chat</p>
                              </div>
                              <p className="mt-1 text-[9px] font-bold text-white truncate">{tx.seller_name || tx.seller_username || "Seller"}</p>
                              <p className="text-[8px] text-white/30">Order #{tx.id}</p>
                            </button>
                            <button type="button" onClick={() => openP2PChat(tx, "buyer")}
                              className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-3 py-2 text-left hover:bg-sky-500/[0.12] transition">
                              <div className="flex items-center gap-1.5">
                                <IonIcon name="chatbubbles-outline" className="text-sky-400 text-xs" />
                                <p className="text-[8px] font-black uppercase tracking-widest text-sky-400/80">Buyer Chat</p>
                              </div>
                              <p className="mt-1 text-[9px] font-bold text-white truncate">{tx.buyer_name || tx.buyer_username || "Buyer"}</p>
                              <p className="text-[8px] text-white/30">Order #{tx.id}</p>
                            </button>
                          </div>
                          <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${
                            tx.status === "completed" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
                            tx.status === "cancelled" ? "border-rose-500/30 bg-rose-500/10 text-rose-400" :
                            "border-amber-500/30 bg-amber-500/10 text-amber-400"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${tx.status === "completed" ? "bg-emerald-400" : tx.status === "cancelled" ? "bg-rose-400" : "bg-amber-400"}`} />
                            {tx.status}
                          </span>
                          {tx.completed_at && <p className="mt-2 text-[9px] text-white/25">{new Date(tx.completed_at).toLocaleString()}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {proofModal && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full sm:max-w-3xl rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 bg-[#0a0a0c] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] shrink-0">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Uploaded Image / Document</p>
                  <h3 className="text-sm font-black uppercase tracking-tight text-white truncate">
                    {proofModal.tx.ad_name || `Order #${proofModal.tx.id}`}
                  </h3>
                  <p className="mt-1 text-[9px] text-white/30 truncate">
                    Seller: {proofModal.tx.seller_name || proofModal.tx.seller_username || "-"} · Buyer: {proofModal.tx.buyer_name || proofModal.tx.buyer_username || "-"}
                  </p>
                </div>
                <button onClick={() => setProofModal(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/40 hover:text-white shrink-0">
                  <IonIcon name="close-outline" className="text-sm" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-5 space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
                    <p className="text-[8px] font-black uppercase tracking-widest text-white/30">Order</p>
                    <p className="mt-1 text-[11px] font-bold text-white">#{proofModal.tx.id}</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
                    <p className="text-[8px] font-black uppercase tracking-widest text-white/30">Transaction ID</p>
                    <p className="mt-1 text-[11px] font-bold text-white break-all">{proofModal.tx.tx_id || "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
                    <p className="text-[8px] font-black uppercase tracking-widest text-white/30">File</p>
                    <p className="mt-1 text-[11px] font-bold text-white break-all">{proofModal.tx.screenshot_name || "Uploaded proof"}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-black/30 p-3 min-h-[320px] flex items-center justify-center">
                  {isImageProof(proofModal.url) ? (
                    <img
                      src={proofModal.url}
                      alt={proofModal.tx.screenshot_name || "Uploaded proof"}
                      className="max-h-[65vh] w-full object-contain rounded-xl bg-black"
                    />
                  ) : (
                    <iframe
                      src={proofModal.url}
                      title={proofModal.tx.screenshot_name || "Uploaded document"}
                      className="h-[65vh] w-full rounded-xl bg-white"
                    />
                  )}
                </div>

                <a href={proofModal.url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[9px] font-black uppercase tracking-widest text-white/60 hover:bg-white/[0.08] hover:text-white transition">
                  <IonIcon name="open-outline" className="text-sm" />
                  Open Original
                </a>
              </div>
            </div>
          </div>
        )}

        {chatModal && (
          <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 bg-[#0a0a0c] shadow-2xl overflow-hidden flex flex-col h-[78vh] sm:h-[68vh]">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] shrink-0">
                <div className="min-w-0">
                  <p className={`text-[9px] font-black uppercase tracking-[0.22em] ${chatModal.role === "seller" ? "text-violet-400/70" : "text-sky-400/70"}`}>
                    {chatModal.role === "seller" ? "Seller Chat" : "Buyer Chat"}
                  </p>
                  <h3 className="text-sm font-black uppercase tracking-tight text-white truncate">{chatModal.participantName}</h3>
                  <p className="mt-1 text-[9px] text-white/30 truncate">
                    Order #{chatModal.tx.id} · {chatModal.tx.ad_name || "P2P Transaction"}
                  </p>
                </div>
                <button onClick={closeP2PChat}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/40 hover:text-white shrink-0">
                  <IonIcon name="close-outline" className="text-sm" />
                </button>
              </div>

              {chatError && (
                <div className="mx-5 mt-4 flex items-center gap-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
                  <IonIcon name="alert-circle-outline" className="shrink-0 text-sm text-rose-400" />
                  <p className="text-[10px] font-bold text-rose-300">{chatError}</p>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {chatLoading ? (
                  <div className="h-full flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-white/25">Loading chat...</div>
                ) : chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <IonIcon name="chatbubbles-outline" className="text-4xl text-white/10 mb-3" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/25">No messages yet</p>
                    <p className="mt-1 text-[9px] text-white/20">Admin can start the conversation here.</p>
                  </div>
                ) : (
                  chatMessages.map(message => {
                    const incoming = Number(message.sender_id) === chatModal.participantId;
                    return (
                      <div key={message.id} className={`flex ${incoming ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 border ${
                          incoming
                            ? "border-white/[0.07] bg-white/[0.04] text-white"
                            : "border-emerald-500/20 bg-emerald-500/15 text-emerald-50"
                        }`}>
                          <p className="text-[8px] font-black uppercase tracking-widest opacity-50 mb-1">
                            {incoming ? chatModal.participantName : currentAdminChatLabel}
                          </p>
                          {message.type === "image" && message.image_url ? (
                            <a href={message.image_url} target="_blank" rel="noreferrer" className="text-[10px] font-bold underline underline-offset-2">
                              {message.file_name || "Image attachment"}
                            </a>
                          ) : (
                            <p className="text-[11px] font-semibold leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
                          )}
                          <p className="mt-1 text-[8px] opacity-40">{new Date(message.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-white/[0.07] p-4 shrink-0">
                <div className="flex gap-2">
                  <textarea
                    value={chatText}
                    onChange={e => setChatText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendP2PChatMessage();
                      }
                    }}
                    placeholder={`Message ${chatModal.participantName}...`}
                    rows={2}
                    className="flex-1 resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[11px] font-semibold text-white placeholder-white/20 outline-none focus:border-white/20"
                  />
                  <button
                    onClick={sendP2PChatMessage}
                    disabled={chatSending || !chatText.trim()}
                    className="flex h-[58px] w-[58px] items-center justify-center rounded-2xl bg-white text-black hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition">
                    <IonIcon name={chatSending ? "reload-outline" : "send-outline"} className={`text-lg ${chatSending ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── PAYMENT METHODS VIEW ─────────────────────────────────────────────────
  if (view === "topup-methods") return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button onClick={() => setView("requests")}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white transition">
          <IonIcon name="chevron-back-outline" className="text-base" />
        </button>
        <div className="flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Top-Up System</p>
          <h1 className="text-base font-black uppercase tracking-tight text-white">Payment Methods</h1>
        </div>
        {renderViewTabs()}
        <button onClick={() => setShowCatalogPicker(true)}
          className="flex items-center gap-1.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/20 transition">
          <IonIcon name="add-outline" className="text-sm" />Add Method
        </button>
      </div>

      {/* Active methods list */}
      <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] overflow-hidden">
        {methodsLoading ? (
          <div className="p-12 text-center text-[10px] font-black uppercase tracking-widest text-white/25">Loading...</div>
        ) : methods.length === 0 ? (
          <div className="p-12 text-center">
            <IonIcon name="card-outline" className="text-4xl text-white/10 block mx-auto mb-3" />
            <p className="text-[10px] font-black uppercase tracking-widest text-white/25">No payment methods yet</p>
            <p className="text-[9px] text-white/20 mt-1">Add methods from the catalog to show them to users</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {methods.map(m => {
              const cat = PAYMENT_CATALOG.find(c => c.name.toLowerCase() === m.name.toLowerCase());
              return (
                <div key={m.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition">
                  <MethodLogo name={m.name} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-white">{m.name}</p>
                    <p className="text-[9px] text-white/30 mt-0.5">{m.fields.length} field{m.fields.length !== 1 ? "s" : ""}{cat ? ` · ${cat.category}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* on/off toggle */}
                    <button onClick={() => toggleMethodActive(m)}
                      className={`relative w-10 h-5 rounded-full border transition-all ${m.is_active ? "border-emerald-500/30 bg-emerald-500/20" : "border-white/10 bg-white/[0.04]"}`}>
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${m.is_active ? "left-5 bg-emerald-400" : "left-0.5 bg-white/20"}`} />
                    </button>
                    <button onClick={() => openEditMethod(m)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/40 hover:text-sky-400 hover:border-sky-500/30 hover:bg-sky-500/10 transition">
                      <IonIcon name="create-outline" className="text-xs" />
                    </button>
                    <button onClick={() => deleteMethod(m)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/40 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition">
                      <IonIcon name="trash-outline" className="text-xs" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Catalog Picker Modal */}
      {showCatalogPicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 bg-[#0a0a0c] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] shrink-0">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Top-Up Methods</p>
                <h3 className="text-sm font-black uppercase tracking-tight text-white">Select from Catalog ({PAYMENT_CATALOG.length - 1} methods)</h3>
              </div>
              <button onClick={() => setShowCatalogPicker(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/40 hover:text-white">
                <IonIcon name="close-outline" className="text-sm" />
              </button>
            </div>

            <div className="px-4 pt-4 space-y-3 shrink-0">
              <input value={catSearch} onChange={e => setCatSearch(e.target.value)} placeholder="Search payment methods..."
                className="w-full rounded-2xl border border-white/10 bg-black/30 py-2.5 px-4 text-[11px] text-white placeholder-white/20 outline-none" />
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setCatFilter(c)}
                    className={`shrink-0 rounded-2xl px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition ${catFilter === c ? "bg-white text-black" : "bg-white/[0.04] text-white/40 hover:bg-white/[0.08]"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-1">
              {catalogFiltered.map(item => (
                <button key={item.id} onClick={() => openCatalogItem(item)}
                  className="w-full flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left hover:bg-white/[0.06] hover:border-white/10 transition">
                  <PaymentLogo item={item} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-white">{item.name}</p>
                    <p className="text-[9px] text-white/30 mt-0.5">{item.category} · {item.defaultFields.length} fields</p>
                  </div>
                  <IonIcon name="add-circle-outline" className="text-sm text-white/20" />
                </button>
              ))}
              <button onClick={openCustomForm}
                className="w-full flex items-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] px-4 py-3 text-left hover:bg-white/[0.04] transition">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/40 shrink-0">
                  <IonIcon name="add-outline" className="text-sm" />
                </span>
                <div>
                  <p className="text-[11px] font-black text-white">Custom Method</p>
                  <p className="text-[9px] text-white/30 mt-0.5">Create a custom payment method</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Add Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 bg-[#0a0a0c] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] shrink-0">
              <div className="flex items-center gap-3">
                {addFromCatalog && <PaymentLogo item={addFromCatalog} size={32} />}
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">{editMethod ? "Edit" : "Add"} Method</p>
                  <h3 className="text-sm font-black uppercase tracking-tight text-white">{editMethod ? editMethod.name : addFromCatalog ? addFromCatalog.name : "Custom Method"}</h3>
                </div>
              </div>
              <button onClick={closeMethodForm}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/40 hover:text-white">
                <IonIcon name="close-outline" className="text-sm" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {methodError && (
                <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
                  <IonIcon name="alert-circle-outline" className="shrink-0 text-sm text-rose-400" />
                  <p className="text-[10px] font-bold text-rose-300">{methodError}</p>
                </div>
              )}

              <label className="block space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Method Name</span>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. PayPal"
                  className="w-full rounded-2xl border border-white/10 bg-black/30 py-2.5 px-4 text-[11px] text-white placeholder-white/20 outline-none focus:border-white/20" />
              </label>

              {/* Active toggle */}
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div>
                  <p className="text-[10px] font-black text-white">Active</p>
                  <p className="text-[9px] text-white/30">Users can see and select this method</p>
                </div>
                <button onClick={() => setNewActive(v => !v)}
                  className={`relative w-10 h-5 rounded-full border transition-all ${newActive ? "border-emerald-500/30 bg-emerald-500/20" : "border-white/10 bg-white/[0.04]"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${newActive ? "left-5 bg-emerald-400" : "left-0.5 bg-white/20"}`} />
                </button>
              </div>

              {/* Fields editor */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Form Fields ({newFields.length})</span>
                  <button onClick={addField}
                    className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-white/50 hover:bg-white/[0.08] hover:text-white transition">
                    <IonIcon name="add-outline" className="text-xs" />Add
                  </button>
                </div>

                {newFields.length === 0 && (
                  <p className="text-center text-[9px] text-white/20 py-4 border border-dashed border-white/[0.06] rounded-2xl">No fields yet — add fields users must fill when submitting</p>
                )}

                {newFields.map((f, idx) => (
                  <div key={idx} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/25">Field {idx + 1}</span>
                      <button onClick={() => removeField(idx)}
                        className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/30 hover:text-rose-400 hover:border-rose-500/30 transition">
                        <IonIcon name="trash-outline" className="text-[10px]" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block space-y-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/25">Label</span>
                        <input value={f.label} onChange={e => updateField(idx, "label", e.target.value)} placeholder="e.g. PayPal Email"
                          className="w-full rounded-xl border border-white/10 bg-black/30 py-1.5 px-3 text-[10px] text-white placeholder-white/15 outline-none" />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/25">Key</span>
                        <input value={f.key} onChange={e => updateField(idx, "key", e.target.value.replace(/\s+/g, "_").toLowerCase())} placeholder="field_key"
                          className="w-full rounded-xl border border-white/10 bg-black/30 py-1.5 px-3 text-[10px] font-mono text-white placeholder-white/15 outline-none" />
                      </label>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="block space-y-1 flex-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/25">Type</span>
                        <select value={f.type} onChange={e => updateField(idx, "type", e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/30 py-1.5 px-3 text-[10px] text-white outline-none">
                          <option value="text">Text</option>
                          <option value="email">Email</option>
                          <option value="number">Number</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer pt-5">
                        <input type="checkbox" checked={f.required} onChange={e => updateField(idx, "required", e.target.checked)}
                          className="rounded border-white/20 bg-transparent accent-emerald-400" />
                        <span className="text-[9px] font-bold text-white/50">Required</span>
                      </label>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/25">Pre-filled Value</span>
                        {f.defaultValue && (
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={!!f.locked} onChange={e => updateField(idx, "locked", e.target.checked)}
                              className="rounded border-white/20 bg-transparent accent-amber-400" />
                            <span className="text-[8px] font-black uppercase tracking-widest text-amber-400/70">Locked</span>
                          </label>
                        )}
                      </div>
                      <input
                        value={f.defaultValue ?? ""}
                        onChange={e => {
                          updateField(idx, "defaultValue", e.target.value);
                          if (!e.target.value) updateField(idx, "locked", false);
                        }}
                        placeholder="Leave empty if user fills this"
                        className="w-full rounded-xl border border-white/10 bg-black/30 py-1.5 px-3 text-[10px] text-white placeholder-white/15 outline-none focus:border-amber-500/30"
                      />
                      {f.defaultValue && f.locked && (
                        <p className="text-[8px] text-amber-400/60">User will see this pre-filled and cannot change it.</p>
                      )}
                      {f.defaultValue && !f.locked && (
                        <p className="text-[8px] text-white/25">User sees this as a default but can edit it.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 pb-5 shrink-0">
              <button onClick={saveMethod} disabled={saving}
                className="w-full rounded-2xl bg-emerald-500 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed">
                {saving ? "Saving..." : editMethod ? "Save Changes" : "Add Method"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ─── COIN REQUESTS VIEW ───────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Top-Up System</p>
          <h1 className="text-base font-black uppercase tracking-tight text-white">Requests</h1>
        </div>
        {renderViewTabs()}
        <button onClick={() => { if (methods.length === 0) loadMethods(); setShowMethodsPanel(true); }}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 h-9 text-[9px] font-black uppercase tracking-widest text-white/50 hover:bg-white/[0.08] hover:text-white transition">
          <IonIcon name="card-outline" className="text-sm" />
          Methods
        </button>
        <button onClick={() => {
          loadRequests();
          if (isSuperAdmin) loadTopupAssignments();
        }}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white transition">
          <IonIcon name="refresh-outline" className="text-sm" />
        </button>
      </div>

      {reviewError && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
          <IonIcon name="alert-circle-outline" className="shrink-0 text-sm text-rose-400" />
          <p className="text-[10px] font-bold text-rose-300">{reviewError}</p>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {["All", "Pending", "Verified", "Rejected"].map(s => (
            <button key={s} onClick={() => setReqFilter(s)}
              className={`shrink-0 rounded-2xl px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition ${reqFilter === s ? "bg-white text-black" : "bg-white/[0.04] text-white/40 hover:bg-white/[0.08]"}`}>
              {s}
              <span className="ml-1.5 opacity-60">
                {s === "All" ? requests.length : requests.filter(r => r.status === s).length}
              </span>
            </button>
          ))}
        </div>
        {USER_TYPES.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <span className="shrink-0 flex items-center text-[9px] font-black uppercase tracking-widest text-white/25 pr-1">Type:</span>
            {USER_TYPES.map(t => (
              <button key={t} onClick={() => setUserTypeFilter(t)}
                className={`shrink-0 rounded-2xl px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition ${userTypeFilter === t ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white/[0.04] text-white/40 hover:bg-white/[0.08] border border-transparent"}`}>
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Requests table */}
      <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] overflow-hidden">
        {reqLoading ? (
          <div className="p-12 text-center text-[10px] font-black uppercase tracking-widest text-white/25">Loading...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center">
            <IonIcon name="time-outline" className="text-4xl text-white/10 block mx-auto mb-3" />
            <p className="text-[10px] font-black uppercase tracking-widest text-white/25">No {reqFilter !== "All" ? reqFilter.toLowerCase() : ""} requests</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06] text-[9px] font-black uppercase tracking-[0.18em] text-white/30">
                  <th className="px-5 py-4">User</th>
                  <th className="px-5 py-4">Status</th>
                  {isSuperAdmin && <th className="px-5 py-4">Assigned Admin</th>}
                  <th className="px-5 py-4">When</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredRequests.map(req => {
                  const picSrc = profileUrl(req.profile_picture);
                  const assignment = topupAssignmentMap.get(req.id);
                  const selectedAdminId = topupAssignmentSelections[req.id] ?? assignment?.assigned_admin_id ?? 0;
                  return (
                    <tr key={req.id} className="hover:bg-white/[0.02] transition">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-white/40 overflow-hidden shrink-0">
                            {picSrc
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={picSrc} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              : <IonIcon name="person-outline" className="text-base" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[11px] font-bold text-white">{req.user_type?.toLowerCase() === 'admin' ? `@${req.username}` : (req.full_name || req.username)}</p>
                              {req.user_type && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.07] text-white/40 capitalize">{req.user_type}</span>
                              )}
                            </div>
                            <p className="text-[9px] text-white/35 mt-0.5">@{req.username}</p>
                            <p className="text-[9px] font-mono text-white/25 mt-0.5">ID: {req.readable_user_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${
                          req.status === "Verified"  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
                          req.status === "Rejected" ? "border-rose-500/30 bg-rose-500/10 text-rose-400" :
                          "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${req.status === "Verified" ? "bg-emerald-400" : req.status === "Rejected" ? "bg-rose-400" : "bg-amber-400"}`} />
                          {req.status}
                        </span>
                      </td>
                      {isSuperAdmin && (
                        <td className="px-5 py-4">
                          <div className="space-y-2 min-w-[220px]">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${
                                assignment?.assigned_admin?.username
                                  ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                                  : "border-white/10 bg-white/[0.03] text-white/35"
                              }`}>
                                {assignment?.assigned_admin?.username ? `@${assignment.assigned_admin.username}` : "Unassigned"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={selectedAdminId || ""}
                                onChange={(event) => setTopupAssignmentSelections((prev) => ({
                                  ...prev,
                                  [req.id]: Number(event.target.value || 0),
                                }))}
                                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[10px] text-white outline-none"
                              >
                                <option value="">Select Admin</option>
                                {adminUsers.map((admin) => (
                                  <option key={admin.id} value={admin.id}>
                                    @{admin.username} {admin.full_name ? `(${admin.full_name})` : ""}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => assignTopupAdmin(req, selectedAdminId || null)}
                                disabled={!selectedAdminId || assigningTopupId === req.id}
                                className="rounded-xl bg-blue-600 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:opacity-40"
                              >
                                {assigningTopupId === req.id ? "Saving..." : assignment?.assigned_admin?.username ? "Reassign" : "Assign"}
                              </button>
                              {assignment?.assigned_admin?.username && (
                                <button
                                  onClick={() => assignTopupAdmin(req, null)}
                                  disabled={assigningTopupId === req.id}
                                  className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-40"
                                >
                                  Unassign
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="px-5 py-4">
                        <p className="text-[10px] text-white/40">{timeAgo(req.created_at)}</p>
                        <p className="text-[9px] text-white/20 mt-0.5">{new Date(req.created_at).toLocaleDateString()}</p>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {req.status === "Pending" && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => approveRequest(req)} disabled={reviewLoading}
                              className="flex items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-40">
                              <IonIcon name="checkmark-outline" className="text-xs" />Approve
                            </button>
                            <button onClick={() => { setRejectModal({ req }); setRejectReason(""); setReviewError(""); }} disabled={reviewLoading}
                              className="flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/20 transition disabled:opacity-40">
                              <IonIcon name="close-outline" className="text-xs" />Reject
                            </button>
                          </div>
                        )}
                        {req.status !== "Pending" && (
                          <span className="text-[9px] text-white/20">{req.reviewed_at ? timeAgo(req.reviewed_at) : "—"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {reqDetail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 bg-[#0a0a0c] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] shrink-0">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Request</p>
                <h3 className="text-sm font-black uppercase tracking-tight text-white">{reqDetail.full_name || reqDetail.username}</h3>
              </div>
              <button onClick={() => setReqDetail(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/40 hover:text-white">
                <IonIcon name="close-outline" className="text-sm" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/30 mb-1">Amount</p>
                  <p className="text-lg font-black text-emerald-400">R {parseFloat(reqDetail.amount).toFixed(2)}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/30 mb-1">Status</p>
                  <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${
                    reqDetail.status === "Verified"  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
                    reqDetail.status === "Rejected" ? "border-rose-500/30 bg-rose-500/10 text-rose-400" :
                    "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  }`}>{reqDetail.status}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-2">
                <p className="text-[8px] font-black uppercase tracking-widest text-white/30">User Info</p>
                <p className="text-[11px] font-bold text-white">{reqDetail.full_name || "—"}</p>
                <p className="text-[9px] text-white/40">@{reqDetail.username} · {reqDetail.email}</p>
                <p className="text-[9px] text-white/30">Wallet: R {parseFloat(reqDetail.wallet_balance || "0").toFixed(2)}</p>
              </div>

              {reqDetail.payment_method_name && (
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <MethodLogo name={reqDetail.payment_method_name} size={24} />
                    <p className="text-[10px] font-black text-white">{reqDetail.payment_method_name}</p>
                  </div>
                  {Object.entries(reqDetail.payment_details || {}).map(([k, v]) => (
                    <div key={k} className="flex items-start justify-between gap-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-white/30 shrink-0">{k.replace(/_/g, " ")}</span>
                      <span className="text-[10px] font-bold text-white text-right break-all">{v || "—"}</span>
                    </div>
                  ))}
                </div>
              )}

              {reqDetail.rejection_reason && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-4">
                  <p className="text-[8px] font-black uppercase tracking-widest text-rose-400/70 mb-1">Rejection Reason</p>
                  <p className="text-[10px] text-rose-300">{reqDetail.rejection_reason}</p>
                </div>
              )}

              {reqDetail.status === "Pending" && (
                <div className="flex gap-2 pt-2">
                  <button onClick={() => { approveRequest(reqDetail); setReqDetail(null); }} disabled={reviewLoading}
                    className="flex-1 rounded-2xl bg-emerald-500 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-emerald-400 disabled:opacity-40">
                    Approve
                  </button>
                  <button onClick={() => { setRejectModal({ req: reqDetail }); setRejectReason(""); setReqDetail(null); }} disabled={reviewLoading}
                    className="flex-1 rounded-2xl border border-rose-500/30 bg-rose-500/10 py-3 text-[10px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/20 transition disabled:opacity-40">
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Catalog Picker (overlays the methods panel) ── */}
      {showCatalogPicker && (
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 bg-[#0a0a0c] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] shrink-0">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Top-Up Methods</p>
                <h3 className="text-sm font-black uppercase tracking-tight text-white">Select from Catalog ({PAYMENT_CATALOG.length - 1} methods)</h3>
              </div>
              <button onClick={() => setShowCatalogPicker(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/40 hover:text-white">
                <IonIcon name="close-outline" className="text-sm" />
              </button>
            </div>
            <div className="px-4 pt-4 space-y-3 shrink-0">
              <input value={catSearch} onChange={e => setCatSearch(e.target.value)} placeholder="Search payment methods..."
                className="w-full rounded-2xl border border-white/10 bg-black/30 py-2.5 px-4 text-[11px] text-white placeholder-white/20 outline-none" />
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setCatFilter(c)}
                    className={`shrink-0 rounded-2xl px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition ${catFilter === c ? "bg-white text-black" : "bg-white/[0.04] text-white/40 hover:bg-white/[0.08]"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-1">
              {catalogFiltered.map(item => (
                <button key={item.id} onClick={() => openCatalogItem(item)}
                  className="w-full flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left hover:bg-white/[0.06] hover:border-white/10 transition">
                  <PaymentLogo item={item} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-white">{item.name}</p>
                    <p className="text-[9px] text-white/30 mt-0.5">{item.category} · {item.defaultFields.length} fields</p>
                  </div>
                  <IonIcon name="add-circle-outline" className="text-sm text-white/20" />
                </button>
              ))}
              <button onClick={openCustomForm}
                className="w-full flex items-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] px-4 py-3 text-left hover:bg-white/[0.04] transition">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/40 shrink-0">
                  <IonIcon name="add-outline" className="text-sm" />
                </span>
                <div>
                  <p className="text-[11px] font-black text-white">Custom Method</p>
                  <p className="text-[9px] text-white/30 mt-0.5">Create a custom payment method</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Form (overlays the methods panel) ── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 bg-[#0a0a0c] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] shrink-0">
              <div className="flex items-center gap-3">
                {addFromCatalog && <PaymentLogo item={addFromCatalog} size={32} />}
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">{editMethod ? "Edit" : "Add"} Method</p>
                  <h3 className="text-sm font-black uppercase tracking-tight text-white">{editMethod ? editMethod.name : addFromCatalog ? addFromCatalog.name : "Custom Method"}</h3>
                </div>
              </div>
              <button onClick={closeMethodForm}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/40 hover:text-white">
                <IonIcon name="close-outline" className="text-sm" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {methodError && (
                <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
                  <IonIcon name="alert-circle-outline" className="shrink-0 text-sm text-rose-400" />
                  <p className="text-[10px] font-bold text-rose-300">{methodError}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Method Name</span>
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. My Bank"
                    className="w-full rounded-2xl border border-white/10 bg-black/30 py-2.5 px-4 text-[11px] text-white placeholder-white/20 outline-none focus:border-white/20" />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Category</span>
                  <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 py-2.5 px-4 text-[11px] text-white outline-none focus:border-white/20 appearance-none">
                    {["Wallet","Bank","Crypto","Card","Digital","Gateway","Local","Other"].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div>
                  <p className="text-[10px] font-black text-white">Active</p>
                  <p className="text-[9px] text-white/30">Users can see and select this method</p>
                </div>
                <button onClick={() => setNewActive(v => !v)}
                  className={`relative w-10 h-5 rounded-full border transition-all ${newActive ? "border-emerald-500/30 bg-emerald-500/20" : "border-white/10 bg-white/[0.04]"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${newActive ? "left-5 bg-emerald-400" : "left-0.5 bg-white/20"}`} />
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Form Fields ({newFields.length})</span>
                  <button onClick={addField}
                    className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-white/50 hover:bg-white/[0.08] hover:text-white transition">
                    <IonIcon name="add-outline" className="text-xs" />Add
                  </button>
                </div>
                {newFields.length === 0 && (
                  <p className="text-center text-[9px] text-white/20 py-4 border border-dashed border-white/[0.06] rounded-2xl">No fields yet — add fields users must fill when submitting</p>
                )}
                {newFields.map((f, idx) => (
                  <div key={idx} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/25">Field {idx + 1}</span>
                      <button onClick={() => removeField(idx)}
                        className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/30 hover:text-rose-400 hover:border-rose-500/30 transition">
                        <IonIcon name="trash-outline" className="text-[10px]" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block space-y-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/25">Label</span>
                        <input value={f.label} onChange={e => updateField(idx, "label", e.target.value)} placeholder="e.g. PayPal Email"
                          className="w-full rounded-xl border border-white/10 bg-black/30 py-1.5 px-3 text-[10px] text-white placeholder-white/15 outline-none" />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/25">Key</span>
                        <input value={f.key} onChange={e => updateField(idx, "key", e.target.value.replace(/\s+/g, "_").toLowerCase())} placeholder="field_key"
                          className="w-full rounded-xl border border-white/10 bg-black/30 py-1.5 px-3 text-[10px] font-mono text-white placeholder-white/15 outline-none" />
                      </label>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="block space-y-1 flex-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/25">Type</span>
                        <select value={f.type} onChange={e => updateField(idx, "type", e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/30 py-1.5 px-3 text-[10px] text-white outline-none">
                          <option value="text">Text</option>
                          <option value="email">Email</option>
                          <option value="number">Number</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer pt-5">
                        <input type="checkbox" checked={f.required} onChange={e => updateField(idx, "required", e.target.checked)}
                          className="rounded border-white/20 bg-transparent accent-emerald-400" />
                        <span className="text-[9px] font-bold text-white/50">Required</span>
                      </label>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/25">Pre-filled Value</span>
                        {f.defaultValue && (
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={!!f.locked} onChange={e => updateField(idx, "locked", e.target.checked)}
                              className="rounded border-white/20 bg-transparent accent-amber-400" />
                            <span className="text-[8px] font-black uppercase tracking-widest text-amber-400/70">Locked</span>
                          </label>
                        )}
                      </div>
                      <input
                        value={f.defaultValue ?? ""}
                        onChange={e => {
                          updateField(idx, "defaultValue", e.target.value);
                          if (!e.target.value) updateField(idx, "locked", false);
                        }}
                        placeholder="Leave empty if user fills this"
                        className="w-full rounded-xl border border-white/10 bg-black/30 py-1.5 px-3 text-[10px] text-white placeholder-white/15 outline-none focus:border-amber-500/30"
                      />
                      {f.defaultValue && f.locked && (
                        <p className="text-[8px] text-amber-400/60">User will see this pre-filled and cannot change it.</p>
                      )}
                      {f.defaultValue && !f.locked && (
                        <p className="text-[8px] text-white/25">User sees this as a default but can edit it.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 pb-5 shrink-0">
              <button onClick={saveMethod} disabled={saving}
                className="w-full rounded-2xl bg-emerald-500 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed">
                {saving ? "Saving..." : editMethod ? "Save Changes" : "Add Method"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Methods Management Panel ── */}
      {showMethodsPanel && (
        <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-end">
          <div className="h-full w-full max-w-md bg-[#09090b] border-l border-white/[0.07] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07] shrink-0">
              <div>
                <h2 className="text-sm font-black text-white">Payment Methods</h2>
                <p className="text-[11px] text-white/40 mt-0.5">Active methods show on the user top-up form.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowCatalogPicker(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/20 transition">
                  <IonIcon name="add-outline" className="text-sm" />Add
                </button>
                <button onClick={() => setShowMethodsPanel(false)}
                  className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition">
                  <IonIcon name="close-outline" className="text-base" />
                </button>
              </div>
            </div>

            {/* Methods list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {methodsLoading && (
                <div className="py-16 text-center text-[10px] font-black uppercase tracking-widest text-white/25">Loading...</div>
              )}
              {!methodsLoading && methods.length === 0 && (
                <div className="py-16 text-center">
                  <IonIcon name="card-outline" className="text-4xl text-white/10 block mx-auto mb-3" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/25">No payment methods yet.</p>
                  <p className="text-[9px] text-white/20 mt-1">Add methods from the catalog above.</p>
                </div>
              )}
              {!methodsLoading && methods.map(m => {
                const cat = PAYMENT_CATALOG.find(c => c.name.toLowerCase() === m.name.toLowerCase());
                return (
                  <div key={m.id} className={`rounded-2xl border p-4 transition-all ${m.is_active ? "border-white/[0.08] bg-white/[0.02]" : "border-white/[0.04] opacity-40"}`}>
                    <div className="flex items-center gap-3">
                      <MethodLogo name={m.name} size={36} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">{m.name}</p>
                        <button onClick={() => openEditMethod(m)} className="text-[10px] text-white/35 hover:text-emerald-400 transition text-left">
                          {cat?.category ?? "Custom"} · <span className="underline underline-offset-2">{m.fields.length} field{m.fields.length !== 1 ? "s" : ""}</span>
                        </button>
                      </div>
                      {/* Toggle */}
                      <button onClick={() => toggleMethodActive(m)}
                        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${m.is_active ? "bg-emerald-500" : "bg-white/10"}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${m.is_active ? "translate-x-4" : "translate-x-0"}`} />
                      </button>
                      {/* Edit */}
                      <button onClick={() => openEditMethod(m)}
                        className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-white/40 hover:text-sky-400 hover:border-sky-500/30 hover:bg-sky-500/10 transition ml-1 shrink-0">
                        <IonIcon name="create-outline" className="text-xs" />
                      </button>
                      {/* Delete */}
                      <button onClick={() => deleteMethod(m)}
                        className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-white/40 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition ml-1 shrink-0">
                        <IonIcon name="trash-outline" className="text-xs" />
                      </button>
                    </div>
                    {m.fields.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/[0.05] flex flex-wrap gap-1.5">
                        {m.fields.map(f => (
                          <span key={f.key} className="px-2 py-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[9px] font-bold text-white/40">
                            {f.label}{f.required ? " *" : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#0a0a0c] shadow-2xl p-6 space-y-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35 mb-1">Reject Request</p>
              <h3 className="text-sm font-black uppercase tracking-tight text-white">Provide Reason</h3>
            </div>
            {reviewError && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
                <IonIcon name="alert-circle-outline" className="shrink-0 text-sm text-rose-400" />
                <p className="text-[10px] font-bold text-rose-300">{reviewError}</p>
              </div>
            )}
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Explain why this request is being rejected..."
              rows={3}
              className="w-full rounded-2xl border border-white/10 bg-black/30 py-3 px-4 text-[11px] text-white placeholder-white/20 outline-none resize-none focus:border-rose-500/30" />
            <div className="flex gap-2">
              <button onClick={() => setRejectModal(null)}
                className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-[10px] font-black uppercase tracking-widest text-white/60 hover:bg-white/[0.08]">
                Cancel
              </button>
              <button onClick={rejectRequest} disabled={reviewLoading || !rejectReason.trim()}
                className="flex-1 rounded-2xl bg-rose-600 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-rose-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
                {reviewLoading ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
