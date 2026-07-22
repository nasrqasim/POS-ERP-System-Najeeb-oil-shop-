"use client";

import React from "react";
import Image from "next/image";
import { formatReceiptLineQty } from "@/lib/itemUnits";

interface ThermalReceiptProps {
  data: any;
  items: any[];
  companyInfo: any;
  config: any;
  dateStr: string;
  timeStr: string;
}

function formatQty(val: any): string {
  if (val === undefined || val === null) return "0";
  const num = Number(val);
  if (isNaN(num)) return String(val);
  if (Number.isInteger(num)) return num.toString();
  return parseFloat(num.toFixed(2)).toString();
}

export default function ThermalReceipt({
  data,
  items,
  companyInfo,
  config,
  dateStr,
  timeStr,
}: ThermalReceiptProps) {
  const totalQty = items.reduce((acc, item) => acc + (Number(item.qty) || Number(item.cartons) || 1), 0);
  const itemCount = items.length;

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

  const phoneNo = (companyInfo?.phone && companyInfo.phone.trim() !== "-")
    ? companyInfo.phone
    : "03108444612";

  const receiptNo = data.invoiceNo || data.poNumber || data.referenceNo || data.receiptNo || data.voucherNo || "8047";
  const operatorName = data.operatorName || data.salesPerson || companyInfo?.userName || "Administrator";
  const salesPerson = data.salesPerson || "-";
  const paymentMethod = data.paymentMethod || data.paymentMode || "Cash";

  return (
    <div 
      className="thermal-receipt-container text-black bg-white p-1 font-mono text-[12px] font-black leading-tight w-[76mm] max-w-[76mm] mx-auto" 
      style={{ color: '#000000', fontFamily: 'Courier New, Courier, monospace, sans-serif', fontWeight: 900 }}
    >
      {/* Logo */}
      {config?.showLogo && companyInfo?.logo && (
        <div className="flex justify-center mb-1">
          <Image 
            src={companyInfo.logo} 
            alt="Company Logo" 
            width={120}
            height={50}
            unoptimized
            className="h-12 w-auto object-contain grayscale" 
          />
        </div>
      )}

      {/* Company Title */}
      <div className="text-center mb-1">
        <h2 className="font-black uppercase tracking-tight text-[16px] text-black mb-0.5" style={{ color: '#000000', fontWeight: 900, fontSize: '16px' }}>
          {companyInfo?.companyName || "AL HADEED TRADERS"}
        </h2>
        {companyInfo?.address && (
          <p className="text-[11px] font-black leading-tight mb-0.5 text-black" style={{ color: '#000000', fontWeight: 900 }}>{companyInfo.address}</p>
        )}
        <p className="text-[12px] font-black text-black" style={{ color: '#000000', fontWeight: 900 }}>Tel: {phoneNo}</p>
      </div>

      {/* Solid Filled Black Header Bar for Receipt Type (Matches Image 2) */}
      <div 
        className="bg-black text-white text-center py-1 font-black uppercase tracking-wider my-1.5 text-[13px]" 
        style={{ backgroundColor: '#000000', color: '#ffffff', fontWeight: 900 }}
      >
        {data.receiptType || "Sale Receipt"}
      </div>

      {/* Structured Meta Info Section (Clean flex rows, no truncation) */}
      <div className="text-[12px] text-black font-black my-1.5 border-b-2 border-black pb-1.5 space-y-1 text-left" style={{ color: '#000000', fontWeight: 900 }}>
        <div className="flex justify-between items-center">
          <span className="font-black">Receipt No.</span>
          <span className="text-[13px] font-black">{receiptNo}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Date &nbsp;<strong className="font-black">{dateStr}</strong></span>
          <span>Time &nbsp;<strong className="font-black">{timeStr}</strong></span>
        </div>
        <div className="flex justify-between items-center">
          <span>Operator Name:</span>
          <span className="font-black">{operatorName}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Sales Person:</span>
          <span className="font-black">{salesPerson}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Customer Name:</span>
          <span className="font-black truncate max-w-[160px]">{customerName}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Payment Type:</span>
          <span className="font-black uppercase">{paymentMethod}</span>
        </div>

        {/* Optional Vehicle & KM details if present */}
        {(data.regNo || (data.startKms !== undefined && data.startKms !== null && data.startKms !== 0)) && (
          <div className="pt-1 mt-1 border-t border-dashed border-black space-y-0.5">
            {data.regNo && (
              <div className="flex justify-between items-center">
                <span>Vehicle No:</span>
                <span className="font-black uppercase">{data.regNo}</span>
              </div>
            )}
            {data.startKms !== undefined && data.startKms !== null && data.startKms !== 0 && (
              <div className="flex justify-between items-center">
                <span>Start / End KM:</span>
                <span className="font-black">{data.startKms} / {data.endKms || 0}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Items Table Headers (Matches Image 2: Description | Qty | Price/Ctn | Total) */}
      <div className="border-t-2 border-b-2 border-black py-1 my-1 text-[12px] font-black text-black" style={{ color: '#000000', fontWeight: 900 }}>
        <div className="flex justify-between items-center">
          <span className="w-[44%] text-left">Description</span>
          <span className="w-[14%] text-center">Qty</span>
          <span className="w-[21%] text-right">Price/Ctn</span>
          <span className="w-[21%] text-right">Total</span>
        </div>
      </div>

      {/* Items List (Item name on top line, numbers cleanly aligned on line 2) */}
      <div className="space-y-1.5 mb-1.5 text-[12px] font-black text-black" style={{ color: '#000000', fontWeight: 900 }}>
        {items.map((item: any, i: number) => {
          const desc = item.description || item.itemName || item.accountName || "Item";
          const qty = item.qty || item.cartons || 1;
          const price = Math.round(item.unitPrice || item.rate || item.amount || 0);
          const total = Math.round(item.total || item.amount || item.netAmount || item.grossAmount || 0);
          
          const qtyDisplay = formatReceiptLineQty(item, item);
          
          return (
            <div key={i} className="border-b border-dashed border-black pb-1 pt-0.5">
              {/* Top row: Full Item Name */}
              <div className="text-left font-black text-[13px] text-black leading-snug break-words">
                {desc}
              </div>
              {/* Bottom row: Unit details + Qty + Price/Ctn + Total */}
              <div className="flex justify-between items-center text-[12px] text-black font-black mt-0.5">
                <span className="w-[44%] text-left text-[11px] font-black text-black truncate">
                  {qtyDisplay.equivalentLabel || ""}
                </span>
                <span className="w-[14%] text-center font-black">
                  {qtyDisplay.qtyLabel || qty}
                </span>
                <span className="w-[21%] text-right font-black">
                  {price.toLocaleString()}
                </span>
                <span className="w-[21%] text-right font-black">
                  {total.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="text-center py-2 text-black font-black">No items found</div>
        )}
      </div>

      {/* Item & Qty Summary Row */}
      <div className="border-t-2 border-b-2 border-black py-1 my-1.5 text-[12px] font-black text-black flex justify-between" style={{ color: '#000000', fontWeight: 900 }}>
        <span>Item(s) &nbsp;{itemCount}</span>
        <span>Total Qty &nbsp;{formatQty(totalQty)}</span>
      </div>

      {/* Financial Summary */}
      <div className="space-y-1 text-[12px] font-black text-black my-1.5 text-right" style={{ color: '#000000', fontWeight: 900 }}>
        <div className="flex justify-between">
          <span>Gross Total</span>
          <span>{grossTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        {itemsDiscount > 0 && (
          <div className="flex justify-between">
            <span>Product Discount</span>
            <span>-{itemsDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        )}
        {carService > 0 && (
          <div className="flex justify-between">
            <span>Car Service Charges</span>
            <span>+{carService.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        )}
        {carServiceDiscount > 0 && (
          <div className="flex justify-between">
            <span>Car Wash Discount</span>
            <span>-{carServiceDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>-{discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        )}
        <div className="flex justify-between text-[14px] font-black pt-1.5 pb-1 border-t-2 border-b-2 border-black uppercase my-1" style={{ fontSize: '14px', color: '#000000', fontWeight: 900 }}>
          <span>Net Total PKR</span>
          <span>{netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between pt-0.5">
          <span>Amount Received</span>
          <span>{amountReceived.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between">
          <span>Cash Back PKR</span>
          <span>{cashBack >= 0 ? cashBack.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}</span>
        </div>
        {discount > 0 && (
          <div className="text-center font-black text-[12px] pt-1 uppercase">
            You Saved Rs.{discount.toLocaleString()}
          </div>
        )}
      </div>

      {/* Visit Note */}
      <div className="text-center font-black my-2.5 text-[12px] uppercase text-black" style={{ color: '#000000', fontWeight: 900 }}>
        *Thanks For Your Visit*
      </div>

      {/* Software By Footer */}
      <div className="text-center text-[10px] font-black text-black border-t-2 border-black pt-1.5 mt-2" style={{ color: '#000000', fontWeight: 900 }}>
        Software By: Roonjha developers : 03152914836
      </div>
    </div>
  );
}
