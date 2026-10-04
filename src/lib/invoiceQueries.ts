import { getDocumentById, getDocuments } from "@/lib/firestore/genericRepository";

export async function getPopulatedInvoice(id: string) {
  const inv = await getDocumentById("invoices", id);
  if (!inv) return null;

  if (inv.partyId) {
    const p = await getDocumentById("parties", String(inv.partyId));
    if (p) inv.partyId = { _id: p._id, id: p._id, companyName: p.companyName, name: p.name, type: p.type };
  }

  if (inv.employeeId) {
    const emp = await getDocumentById("employees", String(inv.employeeId));
    if (emp) inv.employeeId = { _id: emp._id, id: emp._id, name: emp.name };
  }

  if (inv.jobId) {
    const job = await getDocumentById("jobs", String(inv.jobId));
    if (job) inv.jobId = { _id: job._id, id: job._id, title: job.title, name: job.name };
  }

  if (inv.locationId) {
    const loc = await getDocumentById("locations", String(inv.locationId));
    if (loc) inv.locationId = { _id: loc._id, id: loc._id, name: loc.name };
  }

  if (inv.paymentAccountId) {
    const acc = await getDocumentById("accounts", String(inv.paymentAccountId));
    if (acc) inv.paymentAccountId = { _id: acc._id, id: acc._id, title: acc.title, code: acc.code };
  }

  if (inv.linkedInvoiceId) {
    const linked = await getDocumentById("invoices", String(inv.linkedInvoiceId));
    if (linked) inv.linkedInvoiceId = { _id: linked._id, id: linked._id, invoiceNo: linked.invoiceNo };
  }

  if (Array.isArray(inv.lines) && inv.lines.length > 0) {
    const allItems = await getDocuments("items");
    const itemMap = new Map(allItems.map((i: any) => [String(i._id), i]));
    inv.lines = inv.lines.map((line: any) => {
      const itemObj = line.itemId ? itemMap.get(String(line.itemId)) : null;
      return {
        ...line,
        itemId: itemObj ? { _id: itemObj._id, id: itemObj._id, name: itemObj.name, code: itemObj.code } : line.itemId
      };
    });
  }

  return inv;
}
