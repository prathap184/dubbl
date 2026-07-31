import fs from "node:fs";
import path from "node:path";

console.log("🛠️ Building self-hosted master initializer with robust auto-patching & session_replication_role...");

const drizzleDir = path.resolve(process.cwd(), "drizzle");
const erpDumpPath1 = path.resolve(process.cwd(), "..", "Hindustan Enterprices", "precision-press-erp", "database_migration_dump_fixed.sql");
const erpDumpPath2 = path.resolve(process.cwd(), "..", "hindustan-erp", "precision-press-erp", "database_migration_dump_fixed.sql");
const backupPath = path.join(drizzleDir, "supabase_full_backup.sql");

let fullSql = `-- =============================================================================
-- Master Self-Hosted Supabase Full Database Initialization Script
-- =============================================================================

-- 1. Disable Foreign Key Checks for fast, clean out-of-order data restore
SET session_replication_role = 'replica';
SET CONSTRAINTS ALL DEFERRED;

DROP SCHEMA IF EXISTS "public" CASCADE;
CREATE SCHEMA "public";
GRANT ALL ON SCHEMA "public" TO postgres;
GRANT ALL ON SCHEMA "public" TO public;

CREATE SCHEMA IF NOT EXISTS "auth";
GRANT ALL ON SCHEMA "auth" TO postgres;
GRANT ALL ON SCHEMA "auth" TO public;

`;

// Step 1: Append Drizzle Migrations (0000-0007)
const migrationFiles = [
  "0000_baseline.sql",
  "0001_parity_build.sql",
  "0002_old_nightcrawler.sql",
  "0003_same_frog_thor.sql",
  "0004_faithful_paper_doll.sql",
  "0005_sleepy_albert_cleary.sql",
  "0006_normal_doctor_spectrum.sql",
  "0007_marvelous_boom_boom.sql",
];

for (const file of migrationFiles) {
  const p = path.join(drizzleDir, file);
  if (fs.existsSync(p)) {
    console.log(`Adding Drizzle migration: ${file}`);
    fullSql += `\n-- Migration: ${file}\n` + fs.readFileSync(p, "utf8") + "\n";
  }
}

// Step 2: Append ERP DDL Statements
let erpPath = "";
if (fs.existsSync(erpDumpPath1)) erpPath = erpDumpPath1;
else if (fs.existsSync(erpDumpPath2)) erpPath = erpDumpPath2;

if (erpPath) {
  console.log(`Adding ERP DDL from: ${erpPath}`);
  const erpSql = fs.readFileSync(erpPath, "utf8");
  fullSql += `\n-- Precision Press ERP DDL\n` + erpSql + "\n";
}

// Step 3: Parse Backup SQL and Generate Fallback DDL & Column Patching
if (fs.existsSync(backupPath)) {
  console.log(`Analyzing Backup SQL from: ${backupPath}`);
  let backupSql = fs.readFileSync(backupPath, "utf8");

  const insertHeaderRegex = /INSERT INTO\s+(?:"?([a-zA-Z0-9_]+)"?\.)?"?([a-zA-Z0-9_]+)"?\s*\(([^)]+)\)/gi;

  const tableMap = new Map<string, { schema: string; table: string; columns: Set<string> }>();
  let match: RegExpExecArray | null;

  while ((match = insertHeaderRegex.exec(backupSql)) !== null) {
    const schema = (match[1] || "public").toLowerCase();
    const table = match[2].toLowerCase();
    const rawCols = match[3];
    const cols = rawCols.split(",").map(c => c.trim().replace(/^"|"$/g, ""));

    const key = `${schema}.${table}`;
    if (!tableMap.has(key)) {
      tableMap.set(key, { schema, table, columns: new Set() });
    }
    const spec = tableMap.get(key)!;
    for (const c of cols) {
      spec.columns.add(c);
    }
  }

  console.log(`Generating Fallback DDL for ${tableMap.size} backup tables...`);
  fullSql += `\n-- =============================================================================\n`;
  fullSql += `-- Auto-Generated Fallback DDL & Missing Column Patching\n`;
  fullSql += `-- =============================================================================\n`;

  for (const [key, spec] of tableMap.entries()) {
    const fullTableName = `"${spec.schema}"."${spec.table}"`;
    fullSql += `CREATE TABLE IF NOT EXISTS ${fullTableName} ("id" text);\n`;
    for (const col of spec.columns) {
      let colType = "text";
      const lowerCol = col.toLowerCase();
      if (lowerCol === "id") continue;
      if (lowerCol.includes("metadata") || lowerCol.includes("details") || lowerCol.includes("specs") || lowerCol.includes("items") || lowerCol.includes("snapshot") || lowerCol.includes("payload") || lowerCol.includes("addresses") || lowerCol.includes("workflow") || lowerCol.includes("config") || lowerCol.includes("data") || lowerCol.includes("logistics")) {
        colType = "jsonb";
      } else if (lowerCol.endsWith("_at") || lowerCol.endsWith("at") || lowerCol.endsWith("_date") || lowerCol.endsWith("date") || lowerCol === "timestamp") {
        colType = "timestamp with time zone";
      } else if (lowerCol.includes("amount") || lowerCol.includes("total") || lowerCol.includes("price") || lowerCol.includes("cost") || lowerCol.includes("quantity") || lowerCol.includes("count") || lowerCol.includes("percent") || lowerCol.includes("rate") || lowerCol.includes("limit") || lowerCol.includes("credit")) {
        colType = "numeric";
      }
      fullSql += `ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS "${col}" ${colType};\n`;
    }
  }

  // Step 4: Transform Backup Inserts (Fix auth.users generated column confirmed_at & prioritize parent tables)
  console.log("Transforming backup data insert statements...");
  fullSql += `\n-- =============================================================================\n`;
  fullSql += `-- Backup Data Insert Statements\n`;
  fullSql += `-- =============================================================================\n`;
  fullSql += `SET session_replication_role = 'replica';\n\n`;

  const lines = backupSql.split("\n");
  const parentInserts: string[] = [];
  const childInserts: string[] = [];

  const parentTableNames = new Set([
    "public.organization",
    "public.users",
    "auth.users",
    "public.team",
    "public.contact",
    "public.warehouse",
    "public.categories",
    "public.pipeline",
    "public.inventory_category",
    "public.fiscal_year",
    "public.chart_account",
    "public.cost_center",
    "public.custom_role"
  ]);

  let fixedAuthUsersCount = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (!line.trim() || line.trim().startsWith("--")) continue;

    if (line.includes('INSERT INTO "auth"."users"')) {
      const match = line.match(/INSERT INTO "auth"\."users"\s*\(([^)]+)\)\s*VALUES\s*\((.+)\)(\s+ON CONFLICT[^;]+)?;?$/i);
      if (match) {
        const rawColsStr = match[1];
        const rawValuesStr = match[2];
        const onConflictStr = match[3] || "";

        const cols = rawColsStr.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        const confirmedIdx = cols.indexOf("confirmed_at");
        if (confirmedIdx !== -1) {
          cols.splice(confirmedIdx, 1);
          const newColsStr = cols.map(c => `"${c}"`).join(", ");

          const valTokens = parseSqlValuesTuple(rawValuesStr);
          if (valTokens.length === cols.length + 1) {
            valTokens.splice(confirmedIdx, 1);
            const newValuesStr = valTokens.join(", ");
            line = `INSERT INTO "auth"."users" (${newColsStr}) VALUES (${newValuesStr})${onConflictStr};`;
            fixedAuthUsersCount++;
          }
        }
      }
    }

    // Determine target table for ordering
    const matchInsert = line.match(/INSERT INTO\s+(?:"?([a-zA-Z0-9_]+)"?\.)?"?([a-zA-Z0-9_]+)"?/i);
    if (matchInsert) {
      const schema = (matchInsert[1] || "public").toLowerCase();
      const table = matchInsert[2].toLowerCase();
      const targetName = `${schema}.${table}`;

      if (parentTableNames.has(targetName)) {
        parentInserts.push(line);
      } else {
        childInserts.push(line);
      }
    } else {
      childInserts.push(line);
    }
  }

  console.log(`Transformed backup data: ${fixedAuthUsersCount} auth.users inserts fixed. ${parentInserts.length} parent inserts, ${childInserts.length} child inserts.`);

  fullSql += `-- Parent Table Inserts\n` + parentInserts.join("\n") + "\n\n";
  fullSql += `-- Child Table Inserts\n` + childInserts.join("\n") + "\n";
}

// Step 5: Re-enable Foreign Key Constraints
fullSql += `
-- Re-enable Foreign Key Constraints
SET session_replication_role = 'origin';
`;

const outputPath = path.join(drizzleDir, "self_hosted_full_init.sql");
fs.writeFileSync(outputPath, fullSql, "utf8");
console.log(`✅ Successfully generated master bundle: ${outputPath} (${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB)`);

function parseSqlValuesTuple(str: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inString = false;
  let quoteChar = "";

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (inString) {
      current += char;
      if (char === quoteChar) {
        if (i + 1 < str.length && str[i + 1] === quoteChar) {
          current += str[i + 1];
          i++;
        } else {
          inString = false;
        }
      }
    } else {
      if (char === "'" || char === '"') {
        inString = true;
        quoteChar = char;
        current += char;
      } else if (char === ",") {
        tokens.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  if (current.trim()) {
    tokens.push(current.trim());
  }
  return tokens;
}
