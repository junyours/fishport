import { useEffect, useId, useRef, useState } from "react";
import { IoCloudUploadOutline, IoCloseOutline } from "react-icons/io5";
import { receiptImageError } from "../lib/paymentReceipt";
import { showBottomToast } from "../store/bottomToastStore";

export default function PaymentReceiptUpload({ file, existingUrl, error, disabled, onChange }) {
  const id = useId();
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) { setPreview(""); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const imageUrl = preview || existingUrl;
  const selectImage = (selected) => {
    if (disabled || !selected) return;
    const message = receiptImageError(selected);
    if (message) { showBottomToast("error", "Invalid Image", message); return; }
    onChange(selected);
  };
  return (
    <div style={{ fontFamily: "'Montserrat', sans-serif" }}>
      <span id={`${id}-label`} style={{ fontFamily: "'Montserrat', sans-serif" }} className="mb-1.5 block text-[11px] font-semibold uppercase text-[#6F6F82]">OR IMAGE</span>
      <input ref={fileInputRef} id={id} aria-labelledby={`${id}-label`} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} className="hidden" onChange={(event) => {
        selectImage(event.target.files?.[0]);
        event.target.value = "";
      }} />
      {imageUrl ? (
        <div className="flex flex-col gap-3">
          <div className="relative overflow-hidden rounded-[10px] border border-gray-200 bg-black">
            <a href={imageUrl} target="_blank" rel="noopener noreferrer">
              <img src={imageUrl} alt="Official receipt image" className="block w-full object-contain" style={{ maxHeight: 280 }} />
            </a>
            {file ? <div className="absolute left-0 right-0 top-0 flex justify-end px-3 py-2.5" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)" }}>
              <button type="button" title="Clear Selection" aria-label="Clear Selection" onClick={() => onChange(null)} disabled={disabled} className="flex h-7 w-7 items-center justify-center rounded-[10px] border-none bg-white/20 text-white cursor-pointer transition-colors hover:bg-red-500/70 disabled:cursor-not-allowed disabled:opacity-60">
                <IoCloseOutline className="text-[15px]" />
              </button>
            </div> : null}
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={disabled} className="w-full rounded-[10px] border border-dashed border-gray-300 bg-[#fafbfc] py-2.5 text-[13px] font-medium text-gray-500 cursor-pointer transition-all hover:border-[#4096ff] hover:bg-blue-50 hover:text-[#4096ff] disabled:cursor-not-allowed disabled:opacity-60">
            Change Image
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={disabled} onDrop={(event) => {
          event.preventDefault();
          selectImage(event.dataTransfer.files?.[0]);
        }} onDragOver={(event) => event.preventDefault()} className={`flex min-h-[252px] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-[10px] border-2 border-dashed bg-[#fafbfc] px-5 py-10 transition-colors hover:border-[#4096ff] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 ${error ? "border-red-300" : "border-gray-300"}`}>
          <span className="flex h-[56px] w-[56px] items-center justify-center rounded-[10px] bg-blue-50">
            <IoCloudUploadOutline className="text-[26px] text-blue-500" />
          </span>
          <span className="m-0 text-center text-[11px] font-semibold uppercase text-[#6F6F82]">Upload Official Receipt Image</span>
        </button>
      )}
      {error ? <p className="mb-0 mt-1 text-[12px] text-red-500" role="alert">{error}</p> : null}
    </div>
  );
}
