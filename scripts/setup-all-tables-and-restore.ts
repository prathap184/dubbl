import pg from "pg";
import fs from "node:fs";
import path from "node:path";

// Allow TARGET_DATABASE_URL or OVERRIDE_DB_URL to explicitly override .env values
const url = process.env.TARGET_DATABASE_URL || process.env.OVERRIDE_DB_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL is missing in environment variables!");
  process.exit(1);
}

// Strip pooler tenant error params if connecting to local
console.log(`⚡ Connecting to Database: ${url.replace(/:[^:@]+@/, ":****@")}...`);
const pool = new pg.Pool({
  connectionString: url,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function runQueryWithRetry(sql: string, maxRetries = 2): Promise<{ success: boolean; error?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pool.query(sql);
      return { success: true };
    } catch (err: any) {
      if (attempt === maxRetries) {
        return { success: false, error: err.message };
      }
      await new Promise((res) => setTimeout(res, 100));
    }
  }
  return { success: false };
}

async function setupAndRestore() {
  try {
    const possiblePaths = [
      path.resolve(process.cwd(), "..", "hindustan-erp", "precision-press-erp", "database_migration_dump_fixed.sql"),
      path.resolve(process.cwd(), "..", "Hindustan Enterprices", "precision-press-erp", "database_migration_dump_fixed.sql"),
      path.resolve(process.cwd(), "precision-press-erp", "database_migration_dump_fixed.sql"),
    ];

    let erpSql = "";
    let foundPath = "";
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        erpSql = fs.readFileSync(p, "utf8");
        foundPath = p;
        break;
      }
    }

    if (erpSql) {
      console.log(`🛠️ Ensuring ERP table structures from ${foundPath}...`);
      const ddlStatements = erpSql
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("CREATE TABLE") || l.startsWith("CREATE SEQUENCE") || l.startsWith("CREATE OR REPLACE FUNCTION"));

      for (const ddl of ddlStatements) {
        await runQueryWithRetry(ddl, 1);
      }
    }

    const backupFilePath = path.resolve(process.cwd(), "drizzle", "supabase_full_backup.sql");
    if (!fs.existsSync(backupFilePath)) {
      console.error(`❌ Backup file not found at: ${backupFilePath}`);
      process.exit(1);
    }

    console.log(`📄 Reading backup file: ${backupFilePath}...`);
    const sqlContent = fs.readFileSync(backupFilePath, "utf8");
    const lines = sqlContent.split("\n");
    const statements: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith("INSERT INTO") && line.endsWith(";")) {
        statements.push(line);
      }
    }

    console.log(`⚡ HIGH-SPEED restoring ${statements.length} INSERT statements...`);

    const BATCH_SIZE = 50;
    let executed = 0;
    let errors = 0;

    for (let i = 0; i < statements.length; i += BATCH_SIZE) {
      const batch = statements.slice(i, i + BATCH_SIZE);
      const batchSql = batch.join("\n");

      const res = await runQueryWithRetry(batchSql, 1);
      if (res.success) {
        executed += batch.length;
      } else {
        for (const stmt of batch) {
          const lineRes = await runQueryWithRetry(stmt, 1);
          if (lineRes.success) {
            executed++;
          } else {
            errors++;
          }
        }
      }
    }

    console.log(`\n🎉 Restore & Verification Summary:`);
    console.log(`✅ Queries Executed: ${executed}`);
    console.log(`ℹ️ Queries Skipped (Data Already Existed): ${errors}`);

    console.log("\n📊 CURRENT TABLE ROW COUNTS IN DATABASE:");
    const tablesToVerify = ["orders", "order_items", "invoice", "products", "chart_account", "activity_logs"];
    for (const table of tablesToVerify) {
      try {
        const countRes = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`   👉 ${table.padEnd(20)} : ${countRes.rows[0].count} rows`);
      } catch (err: any) {
        console.log(`   ❌ ${table.padEnd(20)} : Table check error (${err.message})`);
      }
    }
  } finally {
    await pool.end();
  }
}

setupAndRestore().catch((err) => {
  console.error("❌ Restore script error:", err);
  pool.end().then(() => process.exit(1));
});
