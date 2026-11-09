import React, { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ReportsInnerTopbar from "../layout/ReportsInnerTopbar";
import { getRemittanceReportQueryOptions } from "../hooks/useRemittanceReportDataQuery";
import { buildCollectionDepositPdf, buildCollectionDepositExcel } from "../lib/exportCollectionDepositReport";
import { showBottomToast } from "../store/bottomToastStore";
import { readCollectionDepositCache, writeCollectionDepositCache, restoreCollectionDepositPreview } from "../lib/collectionDepositCache";

export default function CollectionDepositReport({ fiscalYear }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState(null);
  const previewRef = useRef(null);
  const generatedReportRef = useRef(null);
  const generatingRef = useRef(false);
  const revision = useRef(0);
  const selectedDateRef = useRef("");
  useEffect(() => {
    revision.current++;
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const cached = readCollectionDepositCache(fiscalYear);
    const restoredPreview = restoreCollectionDepositPreview(cached);
    setDate(cached?.date || "");
    selectedDateRef.current = cached?.date || "";
    setPreview(restoredPreview);
    generatedReportRef.current = restoredPreview ? cached.generatedReport : null;
    previewRef.current = restoredPreview?.url || null;
  }, [fiscalYear]);
  useEffect(() => () => {
    revision.current++;
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);
  const changeDate = (_, value) => {
    const nextDate = String(value || "").slice(0, 10);
    setDate(nextDate);
    selectedDateRef.current = nextDate;
    // Filter edits leave the generated report and its Excel snapshot intact.
    writeCollectionDepositCache(fiscalYear, { ...readCollectionDepositCache(fiscalYear), date: nextDate });
  };
  const generate = async (format) => {
    if (!date) {
      showBottomToast("error", "Missing Filter", "Please select a day.");
      return;
    }
    if (generatingRef.current) {
      showBottomToast("error", "Report in Progress", "A report is already being generated. Please wait.");
      return;
    }
    if (format === "excel" && !generatedReportRef.current) {
      showBottomToast("error", "Report Required", "Generate the report and wait for the data to finish loading before exporting.");
      return;
    }
    generatingRef.current = true;
    const requestedRevision = revision.current;
    setBusy(format);
    if (format === "pdf") {
      writeCollectionDepositCache(fiscalYear, { date });
      generatedReportRef.current = null;
      setPreview(null);
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    try {
      const options = format === "pdf" ? {
        reportData: await queryClient.fetchQuery({
          ...getRemittanceReportQueryOptions({ filterType: "daily", selectedDate: date }),
          staleTime: 0,
        }),
        date,
      } : generatedReportRef.current;
      if (requestedRevision !== revision.current) return;
      const pdfBytes = format === "pdf" ? await buildCollectionDepositPdf(options) : null;
      const output = pdfBytes ? new Blob([pdfBytes], { type: "application/pdf" }) : await buildCollectionDepositExcel(options);
      if (requestedRevision !== revision.current) return;
      const url = URL.createObjectURL(output);
      const filename = `Collection_and_Deposit_Report_${options.date}.${format === "pdf" ? "pdf" : "xlsx"}`;
      if (format === "pdf") {
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        previewRef.current = url;
        generatedReportRef.current = options;
        setPreview({ url, filename });
        writeCollectionDepositCache(fiscalYear, { date: selectedDateRef.current, generatedReport: options, pdfBytes, filename });
      } else {
        const link = document.createElement("a"); link.href = url; link.download = filename;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (cause) {
      if (requestedRevision === revision.current) {
        showBottomToast("error", "Report Error", cause?.response?.data?.message || cause?.message || "Unable to generate report. Please try again.");
      }
    } finally {
      generatingRef.current = false;
      setBusy("");
    }
  };
  return <>
    <ReportsInnerTopbar
      activeReport="collection-deposit"
      dailyDate={date}
      onDailyDateChange={changeDate}
      onGenerateReport={() => generate("pdf")}
      onExportExcel={() => generate("excel")}
    />
    <div className="min-h-0 flex-1 bg-white">
      {busy === "pdf" ? <div className="flex h-full items-center justify-center text-[13px] text-slate-500">Generating PDF preview...</div> : preview ? <iframe title="Collection and Deposit Report Viewer" src={preview.url} className="h-full w-full border-0" /> : <div className="flex h-full items-center justify-center text-[13px] text-slate-500">Preview will appear after clicking Generate PDF</div>}
    </div>
  </>;
}
