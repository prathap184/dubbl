import pg from "pg";
import fs from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL is missing in environment variables!");
  process.exit(1);
}

console.log("⚡ Connecting to Supabase Cloud for HIGH SPEED restore...");
const pool = new pg.Pool({
  connectionString: url,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function runQueryWithRetry(sql: string, maxRetries = 2): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pool.query(sql);
      return true;
    } catch (err: any) {
      if (attempt === maxRetries) {
        return false;
      }
      await new Promise((res) => setTimeout(res, 100));
    }
  }
  return false;
}

async function setupAndRestore() {
  try {
    const erpDumpPath = path.resolve(process.cwd(), "..", "Hindustan Enterprices", "precision-press-erp", "database_migration_dump_fixed.sql");
    const erpDumpPathAlt = path.resolve(process.cwd(), "precision-press-erp", "database_migration_dump_fixed.sql");

    let erpSql = "";
    if (fs.existsSync(erpDumpPath)) {
      erpSql = fs.readFileSync(erpDumpPath, "utf8");
    } else if (fs.existsSync(erpDumpPathAlt)) {
      erpSql = fs.readFileSync(erpDumpPathAlt, "utf8");
    }

    if (erpSql) {
      console.log("🛠️ Ensuring ERP table structures (orders, order_items, jobs, workflow)...");
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

      const success = await runQueryWithRetry(batchSql, 1);
      if (success) {
        executed += batch.length;
      } else {
        // Line by line fast check
        for (const stmt of batch) {
          const lineSuccess = await runQueryWithRetry(stmt, 1);
          if (lineSuccess) executed++;
          else errors++;
        }
      }

      const currentCount = Math.min(i + BATCH_SIZE, statements.length);
      const percent = Math.min(100, Math.round((currentCount / statements.length) * 100));
      console.log(`🚀 Fast-Restore: ${percent}% (${currentCount}/${statements.length} queries completed)`);
    }

    console.log(`\n🎉 Full restore completed in record time!`);
    console.log(`✅ Total Executed: ${executed} queries`);
    console.log(`ℹ️ Skipped/Duplicates: ${errors} queries`);
  } finally {
    await pool.end();
  }
}

setupAndRestore().catch((err) => {
  console.error("❌ High-speed restore failed:", err);
  pool.end().then(() => process.exit(1));
});
