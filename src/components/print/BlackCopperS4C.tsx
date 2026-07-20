"use client";

import React from "react";
import Image from "next/image";
import { formatReceiptLineQty } from "@/lib/itemUnits";

interface BlackCopperS4CProps {
  data: any;
  items: any[];
  companyInfo: any;
  config: any;
  dateStr: string;
  timeStr: string;
  activeFormat: "a4" | "a5";
}

export default function BlackCopperS4C({
  data,
  items,
  companyInfo,
  config,
  dateStr,
  timeStr,
  activeFormat,
}: BlackCopperS4CProps) {
  const grossTotal = Math.round(data.subtotal || data.total || 0);
  const discount = Math.round(data.discountAmount || 0);
  const netTotal = Math.round(data.total || data.amount || 0);
  const amountReceived = Math.round(data.amountReceived || data.receivedAmount || netTotal);
  const cashBack = amountReceived - netTotal;

  const carService = Math.round(data.carService || 0);
  const carServiceDiscount = Math.round(data.carServiceDiscount || 0);

  const itemsDiscount = items.reduce((acc: number, item: any) => {
    const gross = (Number(item.qty || item.cartons || 1) * Number(item.rate || item.unitPrice || 0));
    const net = Number(item.netAmount || item.total || item.amount || 0);
    return acc + Math.max(0, gross - net);
  }, 0);

  const customerName = (data.customer && data.customer.trim() && data.customer !== "Search Customer...")
    ? data.customer
    : (data.supplier && data.supplier.trim())
    ? data.supplier
    : (data.partyName && data.partyName.trim())
    ? data.partyName
    : "Walk-in Customer";

  // Check if we have student details or generic client details
  const isStudent = !!(data.studentName || data.rollNo || data.className);
  const studentDetailLabel = data.studentDetailLabel || "Billed To";

  return (
    <div 
      className={`black-copper-s4c-container bg-white text-black flex flex-col font-sans h-full w-full box-border`}
      style={{
        padding: activeFormat === "a5" ? "10mm" : "15mm",
        minHeight: activeFormat === "a5" ? "210mm" : "297mm",
      }}
    >
      {/* Header section with Company profile */}
      <div className="flex justify-between items-start border-b-2 pb-4 mb-6" style={{ borderColor: config.themeColor || "#800000" }}>
        <div className="space-y-1">
          {config.showLogo && companyInfo?.logo && (
            <div className="mb-2">
              <Image 
                src={companyInfo.logo} 
                alt="Company Logo" 
                width={140}
                height={55}
                unoptimized
                className="h-12 w-auto object-contain" 
              />
            </div>
          )}
          <h2 className="text-lg font-black uppercase tracking-tight" style={{ color: config.themeColor || "#800000" }}>
            {companyInfo?.companyName || "AL HADEED TRADERS"}
          </h2>
          <p className="text-[10px] text-slate-500 font-bold max-w-[320px] leading-tight">
            {companyInfo?.address || "Main Road, Al Hadeed Traders Market"}
          </p>
          <p className="text-[10px] text-slate-500 font-bold">
            Tel: {companyInfo?.phone || "03108444612"} {companyInfo?.city ? `| City: ${companyInfo.city}` : ""}
          </p>
          {companyInfo?.ntn && (
            <p className="text-[10px] text-slate-500 font-bold">NTN: {companyInfo.ntn}</p>
          )}
        </div>
        
        {/* Document Info */}
        <div className="text-right">
          <h1 className="text-2xl font-black tracking-tight uppercase mb-2" style={{ color: config.themeColor || "#800000" }}>
            {data.receiptType || "Invoice"}
          </h1>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] font-bold text-left border border-slate-200 p-2.5 rounded-lg bg-slate-50 min-w-[180px]">
            <span className="text-slate-400">Doc No:</span>
            <span className="text-slate-800 text-right font-black">{data.invoiceNo || data.poNumber || data.referenceNo || data.receiptNo || data.voucherNo || "-"}</span>
            <span className="text-slate-400">Date:</span>
            <span className="text-slate-800 text-right">{dateStr}</span>
            <span className="text-slate-400">Time:</span>
            <span className="text-slate-800 text-right">{timeStr}</span>
            <span className="text-slate-400">Payment:</span>
            <span className="text-slate-800 text-right uppercase">{data.paymentMethod || data.paymentMode || "Credit"}</span>
          </div>
        </div>
      </div>

      {/* Student Details / Customer details / Billed to */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="border border-slate-200 p-3 rounded-lg flex flex-col justify-start">
          <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5">{studentDetailLabel}</h3>
          
          {isStudent ? (
            <div className="space-y-1 text-[11px] font-bold text-slate-800">
              <p className="font-extrabold text-sm text-slate-900">{data.studentName}</p>
              <div className="grid grid-cols-2 gap-y-0.5 mt-1">
                <span className="text-slate-400">Roll No:</span>
                <span>{data.rollNo}</span>
                <span className="text-slate-400">Class:</span>
                <span>{data.className}</span>
                {data.section && (
                  <>
                    <span className="text-slate-400">Section:</span>
                    <span>{data.section}</span>
                  </>
                )}
                {data.fatherName && (
                  <>
                    <span className="text-slate-400">Father Name:</span>
                    <span>{data.fatherName}</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-0.5 text-[11px] font-bold text-slate-800">
              <p className="font-extrabold text-sm text-slate-900">{customerName}</p>
              {data.phone && <p className="text-slate-500 font-bold">Tel: {data.phone}</p>}
              {data.address && <p className="text-slate-400 font-medium leading-tight mt-1">{data.address}</p>}
              {data.partyId?.phone && <p className="text-slate-500 font-bold">Tel: {data.partyId.phone}</p>}
              {data.partyId?.address && <p className="text-slate-400 font-medium leading-tight mt-1">{data.partyId.address}</p>}
            </div>
          )}
        </div>

        {/* Vehicle Details (specific to oil shop setup) or secondary details */}
        <div className="border border-slate-200 p-3 rounded-lg flex flex-col justify-start">
          <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5">Vehicle & Service Info</h3>
          {data.regNo ? (
            <div className="grid grid-cols-2 gap-y-1 text-[10px] font-bold text-slate-850">
              <span className="text-slate-400">Vehicle No:</span>
              <span className="text-slate-800 text-right font-black">{data.regNo}</span>
              
              {data.startKms !== undefined && (
                <>
                  <span className="text-slate-400">KMs (S/E/R):</span>
                  <span className="text-slate-800 text-right">{data.startKms || 0} / {data.endKms || 0} / {data.rangeKms || 0}</span>
                </>
              )}
              {data.oilGaugeLimit && (
                <>
                  <span className="text-slate-400">Oil Gauge Limit:</span>
                  <span className="text-slate-800 text-right">{data.oilGaugeLimit}</span>
                </>
              )}
            </div>
          ) : (
            <div className="my-auto text-center py-4">
              <p className="text-[10px] text-slate-400 font-bold italic">No vehicle details provided</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Items Table */}
      <div className="flex-1">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-350 text-[10px] font-black text-slate-450 uppercase tracking-widest bg-slate-50">
              <th className="py-2 px-2 text-left w-8">#</th>
              <th className="py-2 px-2 text-left">Description</th>
              <th className="py-2 px-2 text-center w-16">Qty</th>
              <th className="py-2 px-2 text-right w-24">Price/Ctn</th>
              <th className="py-2 px-2 text-right w-20">Discount</th>
              <th className="py-2 px-2 text-right w-24">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[11px] font-bold text-slate-700">
            {items.map((item: any, i: number) => {
              const desc = item.description || item.itemName || item.accountName || "Item";
              const qty = item.qty || item.cartons || 1;
              const price = Number(item.unitPrice || item.rate || item.amount || 0);
              const total = Number(item.total || item.amount || item.netAmount || item.grossAmount || 0);
              
              const gross = qty * price;
              const disc = Math.max(0, gross - total);
              
              // Use formatReceiptLineQty to get converted quantity display
              const qtyDisplay = formatReceiptLineQty(item, item);

              return (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-2 text-slate-400 font-medium">{i + 1}</td>
                  <td className="py-2.5 px-2 text-slate-800 font-black">
                    {desc}
                    <div className="text-[9px] text-slate-500 font-normal mt-0.5">{qtyDisplay.equivalentLabel || ""}</div>
                  </td>
                  <td className="py-2.5 px-2 text-center">{qtyDisplay.qtyLabel}</td>
                  <td className="py-2.5 px-2 text-right">PKR {price.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right text-rose-600 font-medium">{disc > 0 ? `PKR ${disc.toLocaleString()}` : "-"}</td>
                  <td className="py-2.5 px-2 text-right text-slate-900 font-black">PKR {total.toLocaleString()}</td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400 italic font-bold">No items found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary and Signatures */}
      <div className="grid grid-cols-12 gap-6 mt-8 pt-4 border-t border-slate-150">
        {/* Left Side: Notes, signatures and QR code */}
        <div className="col-span-7 flex flex-col justify-between space-y-6">
          <div className="text-[10px] text-slate-500 font-bold leading-relaxed space-y-0.5">
            <p className="font-extrabold text-slate-700 mb-1">Notes / Terms:</p>
            <p>1. Goods once sold are only returnable within 7 days with original receipt.</p>
            <p>2. Payment should be made as per agreed terms.</p>
            {data.notes && <p className="mt-2 text-maroon-850 font-black">Remarks: {data.notes}</p>}
          </div>

          <div className="flex gap-4 items-center">
            {config.showBankDetails && (
              <div className="flex items-center justify-center p-1.5 border border-dashed border-slate-300 rounded bg-slate-50">
                <div className="w-14 h-14 bg-white flex items-center justify-center text-[7px] text-slate-400 border border-slate-200">
                  [ QR CODE ]
                </div>
              </div>
            )}
            <div className="flex-1 grid grid-cols-2 gap-6 pt-4">
              <div className="border-t border-slate-300 text-center pt-2">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Customer Signature</span>
              </div>
              <div className="border-t border-slate-300 text-center pt-2">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Authorized Signature</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Financial Breakdown */}
        <div className="col-span-5 border border-slate-200 rounded-xl p-3 bg-slate-50 text-[10px] font-bold space-y-2 text-slate-600">
          <div className="flex justify-between">
            <span>Gross Total:</span>
            <span className="text-slate-800">PKR {grossTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          {itemsDiscount > 0 && (
            <div className="flex justify-between">
              <span>Product Discount:</span>
              <span className="text-rose-600">-PKR {itemsDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {carService > 0 && (
            <div className="flex justify-between">
              <span>Car Service Charges:</span>
              <span className="text-slate-800">+PKR {carService.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {carServiceDiscount > 0 && (
            <div className="flex justify-between">
              <span>Car Wash Discount:</span>
              <span className="text-rose-600">-PKR {carServiceDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between">
              <span>Additional Discount:</span>
              <span className="text-rose-600">-PKR {discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between text-xs font-black pt-2 border-t border-slate-350 text-slate-900 uppercase">
            <span>Net Total:</span>
            <span style={{ color: config.themeColor || "#800000" }}>PKR {netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between pt-1 text-slate-500">
            <span>Amount Paid:</span>
            <span>PKR {amountReceived.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Cash Back:</span>
            <span>PKR {cashBack >= 0 ? cashBack.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}</span>
          </div>
        </div>
      </div>

      {/* Footer text */}
      <div className="text-center text-[10px] font-bold border-t border-slate-200 pt-3 mt-8">
        <span className="block font-black uppercase tracking-wider">{config.footerText || "* Thanks For Your Visit *"}</span>
        <span className="block text-slate-400 mt-1">Software By: Roonjha Developers : 03152914836</span>
      </div>
    </div>
  );
}
