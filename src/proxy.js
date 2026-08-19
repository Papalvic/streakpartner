import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request) {
  // Build a base response that cookie changes will attach to.
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If the Supabase env vars are missing (e.g., not deployed on this platform),
  // never crash — just pass the request through. Auth-dependent pages will
  // handle the missing-config case gracefully downstream.
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh the session if it's expired. Wrap in try/catch so transient
  // network/auth failures never crash the routing proxy.
  try {
    await supabase.auth.getUser();
  } catch {
    // Ignore and let the request continue with whatever session exists.
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run the proxy for all requests except:
     * - _next/static, _next/image
     * - favicon.ico
     * - public assets (svg, png, jpg, jpeg, gif, webp, ico)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};