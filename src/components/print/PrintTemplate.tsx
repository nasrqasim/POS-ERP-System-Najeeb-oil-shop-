"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import ThermalReceipt from "./ThermalReceipt";
import BlackCopperS4C from "./BlackCopperS4C";
import Certificate from "./Certificate";
import Report from "./Report";

interface PrintTemplateProps {
  formatName: string;
  data: any;
  items?: any[];
  autoPrint?: boolean;
  onPrintComplete?: () => void;
  defaultFormat?: "thermal" | "a5" | "a4";
}

export default function PrintTemplate({ 
  formatName, 
  data, 
  items = [], 
  autoPrint = false,
  onPrintComplete,
  defaultFormat
}: PrintTemplateProps) {
  const [config, setConfig] = useState<any>(null);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const initialFormat = defaultFormat || (formatName.toLowerCase().includes("sale") ? "thermal" : "a4");
  const [activeFormat, setActiveFormat] = useState<"thermal" | "a5" | "a4">(initialFormat);
  const [formatInitialized, setFormatInitialized] = useState(false);

  useEffect(() => {
    setMounted(true);
    Promise.all([
      fetch(`/api/settings/print-formats?formatName=${encodeURIComponent(formatName)}`).then(res => res.json()),
      fetch("/api/shop-profile").then(res => res.json())
    ]).then(([formatRes, companyRes]) => {
      if (formatRes.ok && formatRes.data) {
        setConfig(formatRes.data);
        // Sync activeFormat with saved paperSize from database if explicitly set, else use defaultFormat
        if (!formatInitialized) {
          if (defaultFormat) {
            setActiveFormat(defaultFormat);
          } else if (formatRes.data.paperSize) {
            const ps = formatRes.data.paperSize.toLowerCase();
            if (ps === "thermal" || ps === "80mm") {
              setActiveFormat("thermal");
            } else if (ps === "a5") {
              setActiveFormat("a5");
            } else {
              setActiveFormat("a4");
            }
          } else {
            setActiveFormat(formatName.toLowerCase().includes("sale") ? "thermal" : "a4");
          }
          setFormatInitialized(true);
        }
      }
      if (companyRes.ok) setCompanyInfo(companyRes.data);
    });
    return () => setMounted(false);
  }, [formatName, formatInitialized, defaultFormat]);

  // Handle auto-printing only when config and companyInfo are fully fetched and mounted
  useEffect(() => {
    if (mounted && config && companyInfo && autoPrint) {
      const timer = setTimeout(() => {
        window.print();
        if (onPrintComplete) {
          onPrintComplete();
        }
      }, 800); // Settle timeout to guarantee complete style & DOM hydration
      return () => clearTimeout(timer);
    }
  }, [mounted, config, companyInfo, autoPrint, onPrintComplete]);

  if (!config || !mounted) return null;

  // Resolve midnight UTC 5 AM timezone offset issue for date-only formats
  const getExactDateTime = () => {
    let rawDate = data.date ? new Date(data.date) : new Date();
    let isDateOnly = false;
    
    if (typeof data.date === "string") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
        isDateOnly = true;
      }
    }
    
    // UTC midnight translates to 05:00:00 AM local time in PKT
    if (rawDate.getUTCHours() === 0 && rawDate.getUTCMinutes() === 0 && rawDate.getUTCSeconds() === 0) {
      isDateOnly = true;
    }
    
    if (isDateOnly) {
      if (data.createdAt) {
        rawDate = new Date(data.createdAt);
      } else if (data.updatedAt) {
        rawDate = new Date(data.updatedAt);
      } else {
        // Fallback: Use current time but preserve original date
        const now = new Date();
        rawDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      }
    }
    return rawDate;
  };

  const rawDate = getExactDateTime();
  const dateStr = rawDate.toLocaleDateString('en-GB'); // dd-mm-yyyy format
  const timeStr = rawDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const isThermal = activeFormat === "thermal";

  const downloadPDF = async () => {
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const element = document.getElementById("print-area");
      if (!element) return;

      const originalDisplay = element.style.display;
      const originalPosition = element.style.position;
      const originalLeft = element.style.left;
      const originalTop = element.style.top;
      const originalWidth = element.style.width;

      // Temporarily render block off-screen
      element.style.display = "block";
      element.style.position = "absolute";
      element.style.left = "-9999px";
      element.style.top = "0";

      if (activeFormat === "thermal") {
        element.style.width = "302px"; // ~80mm width
      } else if (activeFormat === "a5") {
        element.style.width = "559px"; // A5 width
      } else {
        element.style.width = "794px"; // A4 width
      }

      const canvas = await html2canvas(element, {
        scale: 3, // Ultra-sharp print-quality rendering
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      let pdf;

      if (activeFormat === "thermal") {
        const widthMm = 80;
        const heightMm = (canvas.height * widthMm) / canvas.width;
        pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: [widthMm, heightMm]
        });
        pdf.addImage(imgData, "JPEG", 0, 0, widthMm, heightMm);
      } else if (activeFormat === "a5") {
        pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a5"
        });
        pdf.addImage(imgData, "JPEG", 0, 0, 148, 210);
      } else {
        pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4"
        });
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
      }

      pdf.save(`${formatName.replace(/\s+/g, "_")}_${data.invoiceNo || data.receiptNo || data.voucherNo || "document"}.pdf`);

      // Restore styling
      element.style.display = originalDisplay;
      element.style.position = originalPosition;
      element.style.left = originalLeft;
      element.style.top = originalTop;
      element.style.width = originalWidth;
    } catch (e) {
      console.error("PDF generation failed", e);
      alert("Failed to save PDF directly. Please print to PDF instead.");
    }
  };

  const printLayout = (
    <div id="print-area" className="bg-white text-black p-0 m-0">
      <style>{`
        /* Hide print-area on normal screen view to prevent visual interference */
        #print-area {
          display: none;
        }

        /* Global print-area styles (applies to both screen/canvas and print modes) */
        #print-area table {
          width: 100% !important;
          border-collapse: collapse !important;
          border: none !important;
        }

        #print-area th, #print-area td {
          border: none !important;
          background: transparent !important;
        }

        /* Specific border and padding rules for invoice table in BlackCopperS4C */
        #print-area .black-copper-s4c-container th {
          border-bottom: 2px solid #94a3b8 !important;
          padding: 6px 8px !important;
        }
        #print-area .black-copper-s4c-container td {
          border-bottom: 1px solid #e2e8f0 !important;
          padding: 8px !important;
        }

        /* Specific border and padding rules for report table in Report */
        #print-area .report-container th {
          border-bottom: 2px solid #800000 !important;
          padding: 6px 8px !important;
        }
        #print-area .report-container td {
          border-bottom: 1px solid #f1f5f9 !important;
          padding: 6px 8px !important;
        }

        /* Container styling rules applied globally to match canvas/pdf with print output */
        .black-copper-s4c-container {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          min-height: 0 !important;
          box-sizing: border-box !important;
        }

        .certificate-container {
          width: 100% !important;
          max-width: 100% !important;
          height: 100% !important;
          margin: 0 !important;
          box-sizing: border-box !important;
        }

        .report-container {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
        }

        .thermal-receipt-container {
          width: 80mm !important;
          max-width: 80mm !important;
          margin: 0 auto !important;
          padding: 2mm !important;
          box-sizing: border-box !important;
        }

        @media print {
          /* Hide standard React layouts completely */
          body > *:not(#print-area) {
            display: none !important;
          }
          
          #print-area {
            display: block !important;
            position: relative !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            background: white !important;
            color: black !important;
          }

          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
          }

          @page {
            size: ${
              formatName.toLowerCase().includes("certificate")
                ? "A4 landscape"
                : activeFormat === 'a4'
                ? 'A4 portrait'
                : activeFormat === 'a5'
                ? 'A5 portrait'
                : '80mm auto'
            };
            margin: ${activeFormat === 'thermal' ? '0' : activeFormat === 'a5' ? '10mm' : '15mm'};
          }
        }
      `}</style>

      {isThermal ? (
        <ThermalReceipt
          data={data}
          items={items}
          companyInfo={companyInfo}
          config={config}
          dateStr={dateStr}
          timeStr={timeStr}
        />
      ) : formatName.toLowerCase().includes("certificate") ? (
        <Certificate
          data={data}
          companyInfo={companyInfo}
          config={config}
          dateStr={dateStr}
        />
      ) : formatName.toLowerCase().includes("report") ? (
        <Report
          data={data}
          items={items}
          companyInfo={companyInfo}
          config={config}
          dateStr={dateStr}
          timeStr={timeStr}
        />
      ) : (
        <BlackCopperS4C
          data={data}
          items={items}
          companyInfo={companyInfo}
          config={config}
          dateStr={dateStr}
          timeStr={timeStr}
          activeFormat={activeFormat as "a4" | "a5"}
        />
      )}
    </div>
  );

  const toolbar = (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl p-3 flex items-center gap-3 z-[9999] no-print">
      <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Print Size:</span>
      <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
        {(['thermal', 'a5', 'a4'] as const).map((fmt) => (
          <button
            key={fmt}
            onClick={() => setActiveFormat(fmt)}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
              activeFormat === fmt
                ? 'bg-maroon-800 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {fmt}
          </button>
        ))}
      </div>
      <button
        onClick={downloadPDF}
        className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-black hover:bg-slate-900 transition-all shadow-md uppercase"
      >
        Download PDF
      </button>
      <button
        onClick={() => window.print()}
        className="px-4 py-2 bg-maroon-800 text-white rounded-lg text-xs font-black hover:bg-maroon-900 transition-all shadow-md shadow-maroon-900/10 uppercase"
      >
        Print
      </button>
    </div>
  );

  return (
    <>
      {mounted && toolbar}
      {mounted && createPortal(printLayout, document.body)}
    </>
  );
}
