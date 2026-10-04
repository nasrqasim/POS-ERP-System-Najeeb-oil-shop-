import { ok } from "@/lib/api";
import { getDocuments } from "@/lib/firestore/genericRepository";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    const fromTime = fromDate ? new Date(fromDate).getTime() : 0;
    const toTime = toDate ? new Date(toDate).getTime() : Infinity;

    const invoices = await getDocuments("invoices");
    const filtered = invoices.filter((inv: any) => {
      if (inv.status !== "posted" && inv.status !== "Posted") return false;
      const t = new Date(inv.date || 0).getTime();
      return t >= fromTime && t <= toTime;
    });

    const monthlySummary: Record<string, any> = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (const inv of filtered) {
      const dt = new Date(inv.date || inv.createdAt || Date.now());
      const period = `${monthNames[dt.getMonth()]} ${dt.getFullYear()}`;

      if (!monthlySummary[period]) {
        monthlySummary[period] = {
          period,
          sales: 0,
          output: 0,
          purchase: 0,
          input: 0,
          net: 0,
          wht: 0
        };
      }

      const invType = String(inv.type || "");
      const subTotal = Number(inv.subTotal || inv.totalAmount || 0);
      const taxAmount = Number(inv.taxAmount || 0);
      const whtAmount = Number(inv.whtAmount || inv.wht || 0);

      if (["sale", "non_tax_sale"].includes(invType)) {
        monthlySummary[period].sales += subTotal;
      }
      if (["purchase", "non_tax_purchase", "import_purchase"].includes(invType)) {
        monthlySummary[period].purchase += subTotal;
      }
      if (invType === "sale") {
        monthlySummary[period].output += taxAmount;
      }
      if (["purchase", "import_purchase"].includes(invType)) {
        monthlySummary[period].input += taxAmount;
      }
      monthlySummary[period].wht += whtAmount;
    }

    const finalRows = Object.values(monthlySummary).map((row: any) => ({
      ...row,
      net: row.output - row.input
    }));

    const totals = finalRows.reduce((acc: any, curr: any) => ({
      sales: acc.sales + curr.sales,
      output: acc.output + curr.output,
      purchase: acc.purchase + curr.purchase,
      input: acc.input + curr.input,
      net: acc.net + curr.net,
      wht: acc.wht + curr.wht
    }), { sales: 0, output: 0, purchase: 0, input: 0, net: 0, wht: 0 });

    return ok({
      rows: finalRows,
      totals
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
