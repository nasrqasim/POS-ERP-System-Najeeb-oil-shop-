import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { isRouteAllowed } from "./lib/rolePermissions";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname, searchParams } = req.nextUrl;
    const method = req.method;

    if (token) {
      const role = token.role as string;
      const normalizedRole = (role || "").toLowerCase().replace(/\s+/g, "");

      if (normalizedRole === "sales_user" || normalizedRole === "salesuser") {
        const isApi = pathname.startsWith("/api/");

        if (isApi) {
          // 1. Check if the general route is allowed
          const allowedApiRegexes = [
            /^\/api\/invoices(\/.*)?$/,
            /^\/api\/parties(\/.*)?$/,
            /^\/api\/items(\/.*)?$/,
            /^\/api\/categories(\/.*)?$/,
            /^\/api\/cash-receipts(\/.*)?$/,
            /^\/api\/bank-receipts(\/.*)?$/,
            /^\/api\/whatsapp(\/.*)?$/,
            /^\/api\/shop-profile(\/.*)?$/,
            /^\/api\/settings\/print-formats(\/.*)?$/,
            /^\/api\/auth(\/.*)?$/,
            /^\/api\/dashboard(\/.*)?$/,
            /^\/api\/sales(\/.*)?$/,
            /^\/api\/purchases(\/.*)?$/,
          ];

          const isAllowedApi = allowedApiRegexes.some(regex => regex.test(pathname));
          if (!isAllowedApi) {
            return new NextResponse(JSON.stringify({ ok: false, message: "Permission denied" }), {
              status: 403,
              headers: { "Content-Type": "application/json" },
            });
          }

          // 2. HTTP Method constraints - items, categories, shop-profile, dashboard, sales, purchases are read-only
          if (
            pathname.startsWith("/api/items") || 
            pathname.startsWith("/api/categories") || 
            pathname.startsWith("/api/shop-profile") ||
            pathname.startsWith("/api/dashboard") ||
            pathname.startsWith("/api/sales") ||
            pathname.startsWith("/api/purchases")
          ) {
            if (method !== "GET" && method !== "HEAD") {
              return new NextResponse(JSON.stringify({ ok: false, message: "Permission denied (Read-only module)" }), {
                status: 403,
                headers: { "Content-Type": "application/json" },
              });
            }
          }

          // 3. GET parameters constraints
          if (pathname.startsWith("/api/invoices")) {
            const type = searchParams.get("type");
            if (type && type !== "sale" && type !== "sale_return" && type !== "pos") {
              return new NextResponse(JSON.stringify({ ok: false, message: "Permission denied (Restricted invoice type)" }), {
                status: 403,
                headers: { "Content-Type": "application/json" },
              });
            }
          }
          if (pathname.startsWith("/api/parties")) {
            const type = searchParams.get("type");
            if (type && type !== "customer" && type !== "Customer") {
              return new NextResponse(JSON.stringify({ ok: false, message: "Permission denied (Restricted party type)" }), {
                status: 403,
                headers: { "Content-Type": "application/json" },
              });
            }
          }
        } else {
          // Frontend page protection
          if (!isRouteAllowed(pathname, role)) {
            const url = req.nextUrl.clone();
            url.pathname = "/sales/sale-invoice";
            url.searchParams.set("error", "permission_denied");
            return NextResponse.redirect(url);
          }
        }
      }
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/maintain/:path*",
    "/purchases/:path*",
    "/sales/:path*",
    "/store/:path*",
    "/receipts/:path*",
    "/payments/:path*",
    "/salary/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/ai-studio/:path*",
    "/journal/:path*",
    "/inventory/:path*",
    "/items/:path*",
    "/parties/:path*",
    "/api/((?!auth|public).*)"
  ],
};
