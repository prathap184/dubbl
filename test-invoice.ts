import { db } from "./lib/db/index";
import { invoice } from "./lib/db/schema";
import { desc } from "drizzle-orm";

async function run() {
  const res = await db.query.invoice.findFirst({
    orderBy: desc(invoice.createdAt)
  });
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}
run();
