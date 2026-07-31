const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:Powerstar%40200319@db.arffwmwpimdmhgmylpzi.supabase.co:5432/postgres' });
client.connect().then(() => {
  client.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position")
    .then(res => {
      const fs = require('fs');
      fs.writeFileSync('schema_dump_old.json', JSON.stringify(res.rows, null, 2));
      const tables = [...new Set(res.rows.map(r => r.table_name))];
      console.log('TABLES FOUND:\n- ' + tables.join('\n- '));
      process.exit(0);
    }).catch(err => { console.error(err); process.exit(1); });
}).catch(err => { 
    console.error("Failed to connect on 5432. Error:", err.message);
    process.exit(1);
});
