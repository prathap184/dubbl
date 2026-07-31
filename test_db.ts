import { db } from "./lib/db/index";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const res = await db.execute(sql`
      SELECT 
        m.hsn_code as code, 
        m.description, 
        r.gst_rate as gst
      FROM hsn_master m
      JOIN LATERAL (
        SELECT gst_rate 
        FROM hsn_gst_rates 
        WHERE hsn_id = m.id 
        ORDER BY effective_from DESC NULLS LAST 
        LIMIT 1
      ) r ON true
      WHERE m.is_active = true
      ORDER BY m.hsn_code ASC
      LIMIT 3
    `);
    console.log(res.rows);
  } catch(e) {
    console.error("DB Error:", e);
  }
  process.exit(0);
}
main();
