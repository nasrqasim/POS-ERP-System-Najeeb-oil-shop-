import { fail, ok } from "@/lib/api";
import dbConnect from "@/lib/db";
import Invoice from "@/models/Invoice";
import Item from "@/models/Item";
import { lineStockQty } from "@/lib/itemUnits";
import mongoose from "mongoose";

const IN_TYPES = new Set([
  "purchase",
  "import_purchase",
  "non_tax_purchase",
  "sale_return",
  "non_tax_sale_return",
  "add_stock",
  "grn",
]);

const OUT_TYPES = new Set([
  "sale",
  "non_tax_sale",
  "pos",
  "pos_counter_sale",
  "purchase_return",
  "non_tax_purchase_return",
  "reduce_stock",
  "challan",
]);

function parseLocalDate(value: string, endOfDay = false): Date {
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (endOfDay) dt.setHours(23, 59, 59, 999);
  else dt.setHours(0, 0, 0, 0);
  return dt;
}

function resolveLineItemId(line: { itemId?: unknown }): string {
  const id = line.itemId;
  if (!id) return "";
  if (typeof id === "object" && id !== null) {
    if ("_id" in (id as object)) return String((id as { _id: unknown })._id);
    if (typeof (id as any).toString === "function") return (id as any).toString();
  }
  return String(id);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");
    if (!itemId) return fail("itemId is required");
    if (!mongoose.Types.ObjectId.isValid(itemId)) return fail("Invalid itemId");

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const itemOid = new mongoose.Types.ObjectId(itemId);

    await dbConnect();

    const fromDate = from ? parseLocalDate(from) : null;
    const toDate = to ? parseLocalDate(to, true) : null;

    const invoices = await Invoice.find({
      status: { $nin: ["cancelled", "Cancelled"] },
      "lines.itemId": { $in: [itemOid, itemId] },
    })
      .select("invoiceNo type date lines locationId reference partyId createdAt")
      .populate("locationId", "name")
      .populate("partyId", "name companyName type")
      .sort({ date: 1, createdAt: 1 })
      .lean();

    const rows: Array<{
      date: Date;
      refNo: string;
      type: string;
      location: string;
      partyName: string;
      in: number;
      out: number;
      rate: number;
      total: number;
    }> = [];

    for (const inv of invoices) {
      const invType = String(inv.type || "");
      const isIn = IN_TYPES.has(invType);
      const isOut = OUT_TYPES.has(invType);
      if (!isIn && !isOut) continue;

      const partyObj = inv.partyId as any;
      let partyName = invType.toLowerCase().includes("sale") ? "Walk-in (Cash) Customer" : "Cash Vendor";
      if (partyObj) {
        partyName = partyObj.name || partyObj.companyName || partyName;
      }

      for (const line of inv.lines || []) {
        if (resolveLineItemId(line) !== itemId) continue;

        let qty = lineStockQty(line);
        if (qty <= 0) {
          const liters = Number(line.liters) || 0;
          const gallons = Number(line.gallons) || 0;
          if (liters > 0) qty = liters;
          else if (gallons > 0) qty = gallons;
          else continue;
        }

        rows.push({
          date: inv.date as Date,
          refNo: inv.invoiceNo || "",
          type: invType.replace(/_/g, " ").toUpperCase(),
          location: (inv.locationId as { name?: string })?.name || "Main Warehouse",
          partyName,
          in: isIn ? qty : 0,
          out: isOut ? qty : 0,
          rate: Number(line.rate) || 0,
          total: Number(line.netAmount) || qty * (Number(line.rate) || 0),
        });
      }
    }

    const itemObj = await Item.findById(itemOid).select("stockQtyCartons createdAt purchaseRate gallonsInCtn litersInCtn").lean();
    const currentStock = itemObj ? ((itemObj as any).stockQtyCartons || 0) : 0;
    const gallonsInCtn = itemObj ? ((itemObj as any).gallonsInCtn || 0) : 0;
    const litersInCtn = itemObj ? ((itemObj as any).litersInCtn || 0) : 0;

    const totalInAllTime = rows.reduce((sum, r) => sum + r.in, 0);
    const totalOutAllTime = rows.reduce((sum, r) => sum + r.out, 0);
    const initialStock = Math.max(0, currentStock - totalInAllTime + totalOutAllTime);

    // Insert opening balance as the first row (like PV 215 in Excel)
    if (initialStock > 0) {
      const itemCreatedAt = (itemObj as any)?.createdAt;
      const openingDate = itemCreatedAt
        ? new Date(itemCreatedAt)
        : rows.length > 0
          ? new Date(rows[0].date)
          : new Date();
      const pRate = (itemObj as any)?.purchaseRate || 0;

      rows.unshift({
        date: openingDate,
        refNo: "Opening",
        type: "OPENING BALANCE",
        location: "",
        partyName: "Opening Balance",
        in: initialStock,
        out: 0,
        rate: pRate,
        total: initialStock * pRate,
      });
    }

    // Start running balance from 0 (opening stock is now included as a row)
    let runningBalance = 0;
    const rowsWithBalance = rows.map((row) => {
      runningBalance += row.in - row.out;
      if (runningBalance < 0) runningBalance = 0;
      return { ...row, balance: runningBalance };
    });

    // Date range filtering
    let openingBalance = 0;
    const beforeRows = rowsWithBalance.filter(row => fromDate && new Date(row.date) < fromDate);
    if (beforeRows.length > 0) {
      openingBalance = beforeRows[beforeRows.length - 1].balance;
    }

    const periodRows = rowsWithBalance.filter(row => {
      const rowDate = new Date(row.date);
      if (fromDate && rowDate < fromDate) return false;
      if (toDate && rowDate > toDate) return false;
      return true;
    });

    const totalIn = periodRows.reduce((s, r) => s + r.in, 0);
    const totalOut = periodRows.reduce((s, r) => s + r.out, 0);
    const closingBalance =
      periodRows.length > 0 ? periodRows[periodRows.length - 1].balance : openingBalance;

    return ok({
      rows: periodRows,
      openingBalance: initialStock,
      totalIn,
      totalOut,
      closingBalance,
      gallonsInCtn,
      litersInCtn,
    });
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
