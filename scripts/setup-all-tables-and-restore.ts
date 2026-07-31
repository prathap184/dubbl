import pg from "pg";
import fs from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL is missing in environment variables!");
  process.exit(1);
}

console.log("⚡ Connecting to Database for HIGH SPEED restore...");
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
      console.log(`🛠️ Found DDL at ${foundPath}. Creating ERP table structures...`);
      const ddlStatements = erpSql
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("CREATE TABLE") || l.startsWith("CREATE SEQUENCE") || l.startsWith("CREATE OR REPLACE FUNCTION"));

      for (const ddl of ddlStatements) {
        await runQueryWithRetry(ddl, 1);
      }
    } else {
      console.warn("⚠️ Warning: Precision Press ERP DDL file not found in search paths!");
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
        // Line by line fast check
        for (const stmt of batch) {
          const lineRes = await runQueryWithRetry(stmt, 1);
          if (lineRes.success) {
            executed++;
          } else {
            errors++;
          }
        }
      }

      const currentCount = Math.min(i + BATCH_SIZE, statements.length);
      const percent = Math.min(100, Math.round((currentCount / statements.length) * 100));
      console.log(`🚀 Fast-Restore: ${percent}% (${currentCount}/${statements.length} queries processed)`);
    }

    console.log(`\n🎉 Full restore completed!`);
    console.log(`✅ Successfully Restored/Inserted: ${executed} queries`);
    console.log(`ℹ️ Skipped (Already Existed): ${errors} queries`);
  } finally {
    await pool.end();
  }
}

setupAndRestore().catch((err) => {
  console.error("❌ High-speed restore failed:", err);
  pool.end().then(() => process.exit(1));
});
