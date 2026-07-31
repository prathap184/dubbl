const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const OLD_URL = 'https://arffwmwpimdmhgmylpzi.supabase.co';
const OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyZmZ3bXdwaW1kbWhnbXlscHppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDE0MjY0NywiZXhwIjoyMDk1NzE4NjQ3fQ.IH_qMkLpAMz-elc9nZSaUPH4G-7tWieWpRg_tnrBrT8';

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

async function backup() {
  const supabase = createClient(OLD_URL, OLD_KEY);
  const backupData = {};
  
  console.log("Starting backup process...");

  for (const table of tablesToMigrate) {
    console.log(`Downloading table: ${table}...`);
    
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
    
    backupData[table] = allData;
    console.log(`-> Saved ${allData.length} rows for ${table}`);
  }
  
  fs.writeFileSync('database_backup.json', JSON.stringify(backupData, null, 2));
  console.log("\nBACKUP COMPLETE. All data saved to database_backup.json");
}

backup();
