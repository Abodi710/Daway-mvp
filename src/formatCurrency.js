/**
 * Money and dates are shown one way across the whole app: Sudanese pounds
 * (ج.س) with Western digits, matching how prices are written on Sudanese
 * pharmacy shelves and receipts.
 */
const LOCALE = 'ar-SD-u-nu-latn';

export const CURRENCY = 'ج.س';

export const formatCurrency = (amount, currency = CURRENCY) => {
  const num = Number(amount);
  const value = Number.isFinite(num) ? num : 0;
  return `${value.toLocaleString(LOCALE, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
};

/** SQLite CURRENT_TIMESTAMP values are UTC without a zone marker. */
const parseServerDate = (value) => {
  if (!value) return null;
  const text = String(value);
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(text) ? `${text.replace(' ', 'T')}Z` : text;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDateTime = (value) => {
  const date = parseServerDate(value);
  return date
    ? date.toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' })
    : '-';
};

export const formatDate = (value) => {
  const date = parseServerDate(value);
  return date ? date.toLocaleDateString(LOCALE, { dateStyle: 'medium' }) : '-';
};
