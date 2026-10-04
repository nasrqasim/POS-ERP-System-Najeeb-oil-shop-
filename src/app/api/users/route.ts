import { fail, ok } from "@/lib/api";
import { getDocuments, createDocument } from "@/lib/firestore/genericRepository";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const users = await getDocuments("users");
    const sanitized = users.map((u: any) => {
      const { password, ...rest } = u;
      return rest;
    });
    sanitized.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return ok(sanitized);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, username, password, role, financialYear } = body;

    if (!name || !email || !username || !password || !role || !financialYear) {
      return fail("Missing required fields");
    }

    const allUsers = await getDocuments("users");
    const existing = allUsers.find((u: any) => 
      String(u.email || "").toLowerCase() === String(email).toLowerCase() ||
      String(u.username || "").toLowerCase() === String(username).toLowerCase()
    );

    if (existing) {
      return fail("Email or Username already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await createDocument("users", {
      name,
      email,
      username,
      password: hashedPassword,
      role,
      financialYear,
      isActive: true
    });

    const { password: _, ...userWithoutPassword } = newUser;
    return ok(userWithoutPassword);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
