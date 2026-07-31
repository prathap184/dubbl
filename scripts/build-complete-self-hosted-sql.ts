import fs from "node:fs";
import path from "node:path";

console.log("🛠️ Bundling complete Self-Hosted SQL initializer...");

const drizzleDir = path.resolve(process.cwd(), "drizzle");
const erpDumpPath = path.resolve(process.cwd(), "..", "Hindustan Enterprices", "precision-press-erp", "database_migration_dump_fixed.sql");
const erpDumpPathAlt = path.resolve(process.cwd(), "..", "hindustan-erp", "precision-press-erp", "database_migration_dump_fixed.sql");

let fullSql = `
-- =============================================================================
-- Complete Self-Hosted Supabase Full Database Initialization Script
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS "public";
GRANT ALL ON SCHEMA "public" TO postgres;
GRANT ALL ON SCHEMA "public" TO public;

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
    fullSql += `\n-- Migration: ${file}\n` + fs.readFileSync(p, "utf8") + "\n";
  }
}

// Step 2: Append ERP DDL Statements
let erpPath = "";
if (fs.existsSync(erpDumpPath)) erpPath = erpDumpPath;
else if (fs.existsSync(erpDumpPathAlt)) erpPath = erpDumpPathAlt;

if (erpPath) {
  const erpSql = fs.readFileSync(erpPath, "utf8");
  const ddlStatements = erpSql
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("CREATE TABLE") || l.startsWith("CREATE SEQUENCE") || l.startsWith("CREATE OR REPLACE FUNCTION"));
  fullSql += `\n-- Precision Press ERP DDL\n` + ddlStatements.join("\n") + "\n";
}

// Step 3: Append supabase_full_backup.sql Data
const backupFile = path.join(drizzleDir, "supabase_full_backup.sql");
if (fs.existsSync(backupFile)) {
  fullSql += `\n-- Backup Data Insert Statements\n` + fs.readFileSync(backupFile, "utf8") + "\n";
}

const outputPath = path.join(drizzleDir, "self_hosted_full_init.sql");
fs.writeFileSync(outputPath, fullSql, "utf8");
console.log(`✅ Generated single bundle: ${outputPath} (${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB)`);
