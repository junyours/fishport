const CACHE_VERSION = 5;
const cacheKey = (fiscalYear) => `opol:reports:collection-deposit:${fiscalYear}`;

export function readCollectionDepositCache(fiscalYear) {
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(cacheKey(fiscalYear)) || "null");
    if (cached?.version !== CACHE_VERSION) return null;
    if (cached.date && !/^\d{4}-\d{2}-\d{2}$/.test(cached.date)) return null;
    if (cached.pdfBase64 && !/^\d{4}-\d{2}-\d{2}$/.test(cached.generatedReport?.date || "")) return null;
    return cached;
  } catch {
    return null;
  }
}

export function writeCollectionDepositCache(fiscalYear, { date, generatedReport, pdfBytes, pdfBase64: savedPdfBase64, filename }) {
  try {
    let pdfBase64 = savedPdfBase64;
    if (pdfBytes) {
      let binary = "";
      for (let i = 0; i < pdfBytes.length; i += 0x8000) {
        binary += String.fromCharCode(...pdfBytes.subarray(i, i + 0x8000));
      }
      pdfBase64 = window.btoa(binary);
    }
    window.sessionStorage.setItem(cacheKey(fiscalYear), JSON.stringify({
      version: CACHE_VERSION, date, generatedReport, pdfBase64, filename,
    }));
  } catch {
    // Quota/security failures must not prevent viewing or exporting a report.
  }
}

export function restoreCollectionDepositPreview(cached) {
  try {
    if (!cached?.pdfBase64 || !cached.generatedReport?.reportData) return null;
    const bytes = Uint8Array.from(window.atob(cached.pdfBase64), (char) => char.charCodeAt(0));
    return { url: URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })), filename: cached.filename };
  } catch {
    return null;
  }
}
