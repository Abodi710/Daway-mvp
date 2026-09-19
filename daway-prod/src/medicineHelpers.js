/** تحويل بيانات نموذج الواجهة إلى payload متوافق مع API الخادم */
export function formToMedicinePayload(formData, { ownerId, isAdmin } = {}) {
  const barcode = formData.bar_code || formData.barcode || '';
  const payload = {
    name: formData.name,
    barcode,
    batch_number: formData.batch_number || barcode || `B${Date.now()}`,
    expire_date: formData.expiry_date || formData.expire_date,
    price: Number(formData.price),
    quantity: Number(formData.quantity),
  };
  if (isAdmin) {
    payload.owner_id = Number(formData.pharmacy_id || formData.owner_id);
  } else if (ownerId != null) {
    payload.owner_id = Number(ownerId);
  }
  return payload;
}

export function medicineEditPayload(medicine, fields) {
  return {
    name: fields.name,
    quantity: fields.quantity,
    price: fields.price,
    batch_number: medicine.batch_number || medicine.barcode || medicine.bar_code || 'B000',
    expire_date: medicine.expire_date || medicine.expiry_date,
  };
}
