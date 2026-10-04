import { db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, querySnapToData, snapToData } from "./firestore";

const ITEMS_COLLECTION = "items";
const CATS_COLLECTION = "categories";

export async function getAllItems() {
  const colRef = collection(db, ITEMS_COLLECTION);
  const snap = await getDocs(colRef);
  return querySnapToData(snap);
}

export async function getItemById(id: string) {
  const docRef = doc(db, ITEMS_COLLECTION, id);
  const snap = await getDoc(docRef);
  return snapToData(snap);
}

export async function getItemByCode(code: string) {
  const colRef = collection(db, ITEMS_COLLECTION);
  const q = query(colRef, where("code", "==", code));
  const snap = await getDocs(q);
  const list = querySnapToData(snap);
  return list[0] || null;
}

export async function createItem(data: any) {
  const id = data._id || data.id || doc(collection(db, ITEMS_COLLECTION)).id;
  const docRef = doc(db, ITEMS_COLLECTION, String(id));
  const payload = { ...data };
  delete payload._id;
  delete payload.id;
  payload.createdAt = payload.createdAt || new Date().toISOString();
  payload.updatedAt = new Date().toISOString();
  await setDoc(docRef, payload, { merge: true });
  return { _id: id, id, ...payload };
}

export async function updateItem(id: string, data: any) {
  const docRef = doc(db, ITEMS_COLLECTION, id);
  const payload = { ...data };
  delete payload._id;
  delete payload.id;
  payload.updatedAt = new Date().toISOString();
  await updateDoc(docRef, payload);
  return getItemById(id);
}

export async function deleteItem(id: string) {
  const docRef = doc(db, ITEMS_COLLECTION, id);
  await deleteDoc(docRef);
  return { success: true, id };
}

// Category Repository functions
export async function getAllCategories() {
  const colRef = collection(db, CATS_COLLECTION);
  const snap = await getDocs(colRef);
  return querySnapToData(snap);
}

export async function getCategoryById(id: string) {
  const docRef = doc(db, CATS_COLLECTION, id);
  const snap = await getDoc(docRef);
  return snapToData(snap);
}

export async function createCategory(data: any) {
  const id = data._id || data.id || doc(collection(db, CATS_COLLECTION)).id;
  const docRef = doc(db, CATS_COLLECTION, String(id));
  const payload = { ...data };
  delete payload._id;
  delete payload.id;
  payload.createdAt = payload.createdAt || new Date().toISOString();
  payload.updatedAt = new Date().toISOString();
  await setDoc(docRef, payload, { merge: true });
  return { _id: id, id, ...payload };
}
