/** Sudan's 18 states — reference data for location filters. */
export const SUDAN_STATES = [
  'الخرطوم',
  'الجزيرة',
  'نهر النيل',
  'الشمالية',
  'البحر الأحمر',
  'كسلا',
  'القضارف',
  'سنار',
  'النيل الأزرق',
  'النيل الأبيض',
  'شمال كردفان',
  'جنوب كردفان',
  'غرب كردفان',
  'شمال دارفور',
  'جنوب دارفور',
  'شرق دارفور',
  'غرب دارفور',
  'وسط دارفور',
];

/**
 * Pharmacies have a free-text address, not a state column, so the state is
 * inferred from the address text. Longer names are tried first so that
 * "شمال كردفان" is not mistaken for another state sharing a word.
 */
const BY_LENGTH = [...SUDAN_STATES].sort((a, b) => b.length - a.length);

export const stateFromAddress = (address = '') =>
  BY_LENGTH.find((state) => String(address).includes(state)) || '';
