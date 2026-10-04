import { fail, ok } from "@/lib/api";
import { createDocument } from "@/lib/firestore/genericRepository";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const hashed = await bcrypt.hash(body.password, 10);
    const user = await createDocument("users", {
      username: body.username,
      password: hashed,
      role: body.role ?? "admin",
      financialYear: body.financialYear ?? "2025-2026",
    });
    return ok(user, 201);
  } catch (e) {
    return fail((e as Error).message);
  }
}
