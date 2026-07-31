const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const OLD_URL = 'https://arffwmwpimdmhgmylpzi.supabase.co';
const OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyZmZ3bXdwaW1kbWhnbXlscHppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDE0MjY0NywiZXhwIjoyMDk1NzE4NjQ3fQ.IH_qMkLpAMz-elc9nZSaUPH4G-7tWieWpRg_tnrBrT8';

// New DB connection string (the one we are restoring INTO)
const NEW_DB_URL = 'postgresql://postgres.eeqqiylszgrbkfcdrftv:Powerstar%40200319@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';

const tablesToMigrate = [
  'activity_logs', 'anomalies', 'audit_logs', 'audit_stats', 'cart',
  'categories', 'design_comments', 'design_proofs', 'design_revisions',
  'designs', 'dispatch_details', 'dispatches', 'document_jobs',
  'hsn_gst_rates', 'hsn_master', 'idempotency_keys', 'jobs', 'order_items',
  'orders', 'products', 'product_audit_logs', 'profiles', 'quotations',
  'role_history', 'settings', 'staff_users', 'stats', 'tally_sync_queue',
  'tax_templates', 'transactions', 'users', 'wishlist', 'worker_health',
  'workflow', 'workflow_departments', 'workflow_department_settings',
  'workflow_events', 'workflow_stage_history'
];

async function migrate() {
  const supabase = createClient(OLD_URL, OLD_KEY);
  const pgClient = new Client({ connectionString: NEW_DB_URL });
  await pgClient.connect();

  const openapi = require('./schema_rest.json');
  
  for (const table of tablesToMigrate) {
    console.log(`\n============================`);
    console.log(`Migrating table: ${table}`);
    
    // 1. Create table
    const definition = openapi.definitions[table];
    if (!definition) {
      console.log(`Schema for ${table} not found in REST API, skipping.`);
      continue;
    }
    
    const columns = [];
    let hasId = false;
    for (const [colName, colDef] of Object.entries(definition.properties)) {
      let type = 'TEXT';
      if (colDef.type === 'integer' || colDef.type === 'number' || colDef.format === 'numeric' || colDef.format === 'integer') {
        type = 'NUMERIC';
      } else if (colDef.type === 'boolean' || colDef.format === 'boolean') {
        type = 'BOOLEAN';
      } else if (colDef.format === 'jsonb' || colDef.format === 'json') {
        type = 'JSONB';
      } else if (colDef.format && colDef.format.includes('timestamp')) {
        type = 'TIMESTAMPTZ';
      } else if (colDef.format === 'date') {
        type = 'DATE';
      } else if (colDef.format === 'uuid') {
        type = 'UUID';
      }
      
      let colStr = `"${colName}" ${type}`;
      if (colName === 'id' || colName === 'uid') {
         colStr += ' PRIMARY KEY';
         hasId = true;
      }
      columns.push(colStr);
    }
    
    const createSql = `CREATE TABLE IF NOT EXISTS "${table}" (${columns.join(', ')});`;
    try {
      await pgClient.query(createSql);
      console.log(`Table ${table} created/verified.`);
    } catch(e) {
      console.error(`Error creating table ${table}:`, e.message);
      continue;
    }
    
    // 2. Fetch data (handling pagination just in case it's huge)
    let allData = [];
    let from = 0;
    let to = 999;
    let hasMore = true;
    
    while (hasMore) {
        const { data, error } = await supabase.from(table).select('*').range(from, to);
        if (error) {
            console.error(`Error fetching data for ${table}:`, error.message);
            break;
        }
        if (data && data.length > 0) {
            allData = allData.concat(data);
            from += 1000;
            to += 1000;
        } else {
            hasMore = false;
        }
    }
    
    if (allData.length === 0) {
      console.log(`No data in ${table}`);
      continue;
    }
    
    // 3. Insert data
    console.log(`Found ${allData.length} rows for ${table}, inserting...`);
    let inserted = 0;
    for (const row of allData) {
      const keys = Object.keys(row);
      const values = Object.values(row);
      
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      
      // If table has a primary key, we can use ON CONFLICT DO NOTHING
      // For safety on tables without primary keys, we just insert.
      const conflictClause = hasId ? 'ON CONFLICT DO NOTHING' : '';
      const insertSql = `INSERT INTO "${table}" ("${keys.join('", "')}") VALUES (${placeholders}) ${conflictClause};`;
      
      try {
        await pgClient.query(insertSql, values);
        inserted++;
      } catch (e) {
        if (!e.message.includes('already exists') && !e.message.includes('unique constraint')) {
            console.error(`Error inserting row into ${table}:`, e.message);
        }
      }
    }
    console.log(`Successfully inserted ${inserted} rows into ${table}`);
  }
  
  await pgClient.end();
  console.log("\nALL DONE! MIGRATION COMPLETE.");
}

migrate();
