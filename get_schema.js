const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.eeqqiylszgrbkfcdrftv:Powerstar%40200319@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres' });
client.connect().then(() => {
  client.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position")
    .then(res => {
      const fs = require('fs');
      fs.writeFileSync('schema_dump.json', JSON.stringify(res.rows, null, 2));
      const tables = [...new Set(res.rows.map(r => r.table_name))];
      console.log('TABLES FOUND:\n- ' + tables.join('\n- '));
      process.exit(0);
    }).catch(err => { console.error(err); process.exit(1); });
}).catch(err => { console.error(err); process.exit(1); });
