import { createClient } from "@supabase/supabase-js";
import { PixelOrdersClient } from "./pixel-orders-client";

export const dynamic = "force-dynamic";

export default async function PixelOrdersPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return <div className="p-6">Supabase credentials missing.</div>;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch orders from the shared Supabase DB
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .order("createdAt", { ascending: false });

  if (error) {
    return <div className="p-6">Failed to load orders: {error.message}</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pixel Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Read-only view of Global Orders from Pixel Marketing.
        </p>
      </div>
      <PixelOrdersClient initialOrders={orders || []} />
    </div>
  );
}
