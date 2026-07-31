import fs from "node:fs";
import path from "node:path";

console.log("🛠️ Building self-hosted master initializer with session_replication_role = 'replica'...");

const drizzleDir = path.resolve(process.cwd(), "drizzle");
const erpDumpPath1 = path.resolve(process.cwd(), "..", "Hindustan Enterprices", "precision-press-erp", "database_migration_dump_fixed.sql");
const erpDumpPath2 = path.resolve(process.cwd(), "..", "hindustan-erp", "precision-press-erp", "database_migration_dump_fixed.sql");

let fullSql = `-- =============================================================================
-- Master Self-Hosted Supabase Full Database Initialization Script
-- =============================================================================

-- 1. Disable Foreign Key Checks for fast, clean out-of-order data restore
SET session_replication_role = 'replica';

DROP SCHEMA IF EXISTS "public" CASCADE;
CREATE SCHEMA "public";
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
    console.log(`Adding Drizzle migration: ${file}`);
    fullSql += `\n-- Migration: ${file}\n` + fs.readFileSync(p, "utf8") + "\n";
  }
}

// Step 2: Fallback definitions for non-drizzle tables found in backup
fullSql += `
-- Fallback table definitions for backup tables
CREATE TABLE IF NOT EXISTS "public"."activity_logs" ("id" text PRIMARY KEY, "action" text, "actor" text, "metadata" jsonb, "created_at" timestamp with time zone DEFAULT now());
CREATE TABLE IF NOT EXISTS "public"."audit_logs" ("id" text PRIMARY KEY, "action_type" text, "actor" text, "metadata" jsonb, "created_at" timestamp with time zone DEFAULT now());
`;

// Step 3: Append ERP DDL Statements
let erpPath = "";
if (fs.existsSync(erpDumpPath1)) erpPath = erpDumpPath1;
else if (fs.existsSync(erpDumpPath2)) erpPath = erpDumpPath2;

if (erpPath) {
  console.log(`Adding ERP DDL from: ${erpPath}`);
  const erpSql = fs.readFileSync(erpPath, "utf8");
  fullSql += `\n-- Precision Press ERP DDL\n` + erpSql + "\n";
}

// Step 4: Append Backup Data Insert Statements
const backupFile = path.join(drizzleDir, "supabase_full_backup.sql");
if (fs.existsSync(backupFile)) {
  console.log(`Adding Backup Data from: ${backupFile}`);
  const backupSql = fs.readFileSync(backupFile, "utf8");
  fullSql += `\n-- Backup Data Insert Statements\n` + backupSql + "\n";
}

// Step 5: Re-enable Foreign Key Constraints
fullSql += `
-- Re-enable Foreign Key Constraints
SET session_replication_role = 'origin';
`;

const outputPath = path.join(drizzleDir, "self_hosted_full_init.sql");
fs.writeFileSync(outputPath, fullSql, "utf8");
console.log(`✅ Successfully generated master bundle: ${outputPath} (${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB)`);
