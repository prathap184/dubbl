import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// This endpoint is called by precision-press-erp to hand off the Supabase
// session to Pixel Marketing. It verifies the token against Supabase, finds the matching
// user in Pixel Marketing's own users table by email, and returns a one-time token that
// the auto-login page exchanges for a full NextAuth session.

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { access_token } = await request.json();

    if (!access_token) {
      return NextResponse.json({ error: "Missing access_token" }, { status: 400 });
    }

    // Verify the Supabase token and get the user's email
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(access_token);

    if (error || !supabaseUser?.email) {
      return NextResponse.json({ error: "Invalid or expired Supabase token" }, { status: 401 });
    }

    // Find the matching Pixel Marketing user by email
    const dubblUser = await db.query.users.findFirst({
      where: eq(users.email, supabaseUser.email),
      columns: { id: true, email: true, name: true },
    });

    if (!dubblUser) {
      return NextResponse.json(
        { error: `No Pixel Marketing account found for ${supabaseUser.email}. Please sign up in Pixel Marketing first.` },
        { status: 404 }
      );
    }

    // Return the user's email so the client can use it with the dev-login
    // credentials flow — we re-use the existing sign-in infrastructure.
    return NextResponse.json({
      ok: true,
      email: dubblUser.email,
      name: dubblUser.name,
      userId: dubblUser.id,
    });
  } catch (err) {
    console.error("[supabase-sso]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
