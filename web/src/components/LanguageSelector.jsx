import React, { useEffect, useId, useRef, useState } from "react";
import { IoChevronDownOutline, IoChevronUpOutline } from "react-icons/io5";
import { LANGUAGE_OPTIONS, useLanguageStore } from "../store/languageStore";

export default function LanguageSelector({ className = "", onChange, inline = false }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const optionRefs = useRef([]);
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const selectedIndex = Math.max(0, LANGUAGE_OPTIONS.findIndex((option) => option.value === language));

  useEffect(() => {
    if (!open) return undefined;
    optionRefs.current[selectedIndex]?.focus();
    const closeOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [open, selectedIndex]);

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      const current = optionRefs.current.indexOf(document.activeElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? LANGUAGE_OPTIONS.length - 1
        : (current + (event.key === "ArrowDown" ? 1 : -1) + LANGUAGE_OPTIONS.length) % LANGUAGE_OPTIONS.length;
      optionRefs.current[next]?.focus();
    }
  };
  return (
    <div
      ref={containerRef}
      translate="no"
      className={`relative w-full ${className}`}
      onKeyDown={handleKeyDown}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label="Language"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`language-options-${id}`}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
        style={{ fontFamily: "'Montserrat', sans-serif" }}
      >
        {LANGUAGE_OPTIONS[selectedIndex].label}
        {open ? <IoChevronUpOutline className="text-[13px] text-slate-400" /> : <IoChevronDownOutline className="text-[13px] text-slate-400" />}
      </button>
      {open && <div
        id={`language-options-${id}`}
        role="listbox"
        aria-label="Language"
        className={`${inline ? "relative mt-2" : "absolute left-0 top-[calc(100%+8px)]"} z-30 max-h-[220px] w-full overflow-y-auto rounded-[10px] border border-slate-200 bg-white pt-0 pb-1 shadow-[0_16px_40px_rgba(15,23,42,0.12)] [&::-webkit-scrollbar]:hidden`}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {LANGUAGE_OPTIONS.map((option, index) => <button
          key={option.value}
          ref={(element) => { optionRefs.current[index] = element; }}
          type="button"
          role="option"
          aria-selected={option.value === language}
          tabIndex={index === selectedIndex ? 0 : -1}
          onClick={() => {
            setLanguage(option.value);
            setOpen(false);
            buttonRef.current?.focus();
            onChange?.(option.value);
          }}
          className="block w-full border-none px-3 py-2 text-left text-[12px] font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-400"
          style={{ backgroundColor: option.value === language ? "#1a1f36" : "transparent", color: option.value === language ? "#ffffff" : "#1a1f36", fontWeight: 400 }}
        >{option.label}</button>)}
      </div>}
    </div>
  );
}
