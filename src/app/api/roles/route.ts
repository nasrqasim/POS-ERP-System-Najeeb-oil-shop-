import { fail, ok } from "@/lib/api";
import { getDocuments, createDocument } from "@/lib/firestore/genericRepository";

export async function GET() {
  try {
    const roles = await getDocuments("roles");
    roles.sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    return ok(roles);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, description, permissions } = body;

    if (!name) return fail("Role name is required");

    const existingRoles = await getDocuments("roles");
    const existing = existingRoles.find((r: any) => String(r.name).toLowerCase() === String(name).toLowerCase());
    if (existing) return fail("Role name already exists");

    const newRole = await createDocument("roles", {
      name,
      description: description || "",
      permissions: permissions || [],
      userCount: 0
    });

    return ok(newRole);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export const dynamic = "force-dynamic";
