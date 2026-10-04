import { db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, querySnapToData, snapToData } from "./firestore";

export async function getAllCashReceipts(partyId?: string) {
  const colRef = collection(db, "cashreceipts");
  if (partyId) {
    const q = query(colRef, where("partyId", "==", partyId));
    const snap = await getDocs(q);
    return querySnapToData(snap);
  }
  const snap = await getDocs(colRef);
  return querySnapToData(snap);
}

export async function createCashReceipt(data: any) {
  const id = data._id || data.id || doc(collection(db, "cashreceipts")).id;
  const docRef = doc(db, "cashreceipts", String(id));
  const payload = { ...data };
  delete payload._id;
  delete payload.id;
  payload.createdAt = payload.createdAt || new Date().toISOString();
  payload.updatedAt = new Date().toISOString();
  await setDoc(docRef, payload, { merge: true });
  return { _id: id, id, ...payload };
}

export async function getAllCashPayments(partyId?: string) {
  const colRef = collection(db, "cashpayments");
  if (partyId) {
    const q = query(colRef, where("partyId", "==", partyId));
    const snap = await getDocs(q);
    return querySnapToData(snap);
  }
  const snap = await getDocs(colRef);
  return querySnapToData(snap);
}

export async function createCashPayment(data: any) {
  const id = data._id || data.id || doc(collection(db, "cashpayments")).id;
  const docRef = doc(db, "cashpayments", String(id));
  const payload = { ...data };
  delete payload._id;
  delete payload.id;
  payload.createdAt = payload.createdAt || new Date().toISOString();
  payload.updatedAt = new Date().toISOString();
  await setDoc(docRef, payload, { merge: true });
  return { _id: id, id, ...payload };
}

export async function getAllOpeningBalances() {
  const colRef = collection(db, "openingbalances");
  const snap = await getDocs(colRef);
  return querySnapToData(snap);
}

export async function createOpeningBalance(data: any) {
  const id = data._id || data.id || doc(collection(db, "openingbalances")).id;
  const docRef = doc(db, "openingbalances", String(id));
  const payload = { ...data };
  delete payload._id;
  delete payload.id;
  payload.createdAt = payload.createdAt || new Date().toISOString();
  payload.updatedAt = new Date().toISOString();
  await setDoc(docRef, payload, { merge: true });
  return { _id: id, id, ...payload };
}

export async function getAllBankReceipts(partyId?: string) {
  const colRef = collection(db, "bankreceipts");
  if (partyId) {
    const q = query(colRef, where("partyId", "==", partyId));
    const snap = await getDocs(q);
    return querySnapToData(snap);
  }
  const snap = await getDocs(colRef);
  return querySnapToData(snap);
}

export async function createBankReceipt(data: any) {
  const id = data._id || data.id || doc(collection(db, "bankreceipts")).id;
  const docRef = doc(db, "bankreceipts", String(id));
  const payload = { ...data };
  delete payload._id;
  delete payload.id;
  payload.createdAt = payload.createdAt || new Date().toISOString();
  payload.updatedAt = new Date().toISOString();
  await setDoc(docRef, payload, { merge: true });
  return { _id: id, id, ...payload };
}

export async function getAllBankPayments(partyId?: string) {
  const colRef = collection(db, "bankpayments");
  if (partyId) {
    const q = query(colRef, where("partyId", "==", partyId));
    const snap = await getDocs(q);
    return querySnapToData(snap);
  }
  const snap = await getDocs(colRef);
  return querySnapToData(snap);
}

export async function createBankPayment(data: any) {
  const id = data._id || data.id || doc(collection(db, "bankpayments")).id;
  const docRef = doc(db, "bankpayments", String(id));
  const payload = { ...data };
  delete payload._id;
  delete payload.id;
  payload.createdAt = payload.createdAt || new Date().toISOString();
  payload.updatedAt = new Date().toISOString();
  await setDoc(docRef, payload, { merge: true });
  return { _id: id, id, ...payload };
}
