export const formatCurrency = (amount, currency = 'ريال') => {
  const num = Number(amount);
  if (isNaN(num)) return '0.00 ' + currency;
  return num.toLocaleString('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' ' + currency;
};
