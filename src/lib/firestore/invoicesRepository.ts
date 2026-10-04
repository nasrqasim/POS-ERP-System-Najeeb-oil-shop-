import { db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, querySnapToData, snapToData } from "./firestore";

const COLLECTION = "invoices";

export async function getAllInvoices(type?: string) {
  const colRef = collection(db, COLLECTION);
  if (type) {
    const q = query(colRef, where("type", "==", type));
    const snap = await getDocs(q);
    return querySnapToData(snap);
  }
  const snap = await getDocs(colRef);
  return querySnapToData(snap);
}

export async function getInvoiceById(id: string) {
  const docRef = doc(db, COLLECTION, id);
  const snap = await getDoc(docRef);
  return snapToData(snap);
}

export async function getInvoiceByNo(invoiceNo: string) {
  const colRef = collection(db, COLLECTION);
  const q = query(colRef, where("invoiceNo", "==", invoiceNo));
  const snap = await getDocs(q);
  const list = querySnapToData(snap);
  return list[0] || null;
}

export async function createInvoice(data: any) {
  const id = data._id || data.id || doc(collection(db, COLLECTION)).id;
  const docRef = doc(db, COLLECTION, String(id));
  const payload = { ...data };
  delete payload._id;
  delete payload.id;
  payload.createdAt = payload.createdAt || new Date().toISOString();
  payload.updatedAt = new Date().toISOString();
  await setDoc(docRef, payload, { merge: true });
  return { _id: id, id, ...payload };
}

export async function updateInvoice(id: string, data: any) {
  const docRef = doc(db, COLLECTION, id);
  const payload = { ...data };
  delete payload._id;
  delete payload.id;
  payload.updatedAt = new Date().toISOString();
  await updateDoc(docRef, payload);
  return getInvoiceById(id);
}

export async function deleteInvoice(id: string) {
  const docRef = doc(db, COLLECTION, id);
  await deleteDoc(docRef);
  return { success: true, id };
}
