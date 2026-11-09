export const RECEIPT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const RECEIPT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export function receiptImageError(file) {
  if (!file) return "";
  if (!RECEIPT_IMAGE_TYPES.includes(file.type)) return "Choose a JPG, PNG, or WebP image.";
  if (file.size > RECEIPT_IMAGE_MAX_BYTES) return "The OR image must be 10 MB or smaller.";
  return "";
}

export function savePaymentRequest(api, payload, id = null) {
  const url = id == null ? "/payments" : `/payments/${id}`;
  const config = { params: { minimal: 1 } };
  if (payload.official_receipt_image) {
    // Axios serializes the plain payload after the fiscal-year interceptor.
    // PHP parses multipart files on POST; method spoofing routes edits to PUT.
    config.headers = { "Content-Type": "multipart/form-data" };
    return api.post(url, id == null ? payload : { ...payload, _method: "PUT" }, config);
  }
  return id == null ? api.post(url, payload, config) : api.put(url, payload, config);
}
