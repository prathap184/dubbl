const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:Powerstar%40200319@40.81.236.61:5432/postgres' });
client.connect().then(() => {
  client.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position")
    .then(res => {
      const fs = require('fs');
      fs.writeFileSync('old_schema_dump.json', JSON.stringify(res.rows, null, 2));
      const tables = [...new Set(res.rows.map(r => r.table_name))];
      console.log('TABLES FOUND:\n- ' + tables.join('\n- '));
      process.exit(0);
    }).catch(err => { console.error(err); process.exit(1); });
}).catch(err => { 
    console.error("Failed on port 5432, trying 6543...");
    const client2 = new Client({ connectionString: 'postgresql://postgres:Powerstar%40200319@40.81.236.61:6543/postgres' });
    client2.connect().then(() => {
        client2.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position")
            .then(res => {
                const fs = require('fs');
                fs.writeFileSync('old_schema_dump.json', JSON.stringify(res.rows, null, 2));
                const tables = [...new Set(res.rows.map(r => r.table_name))];
                console.log('TABLES FOUND:\n- ' + tables.join('\n- '));
                process.exit(0);
            }).catch(err => { console.error(err); process.exit(1); });
    }).catch(err2 => { console.error(err2); process.exit(1); });
});
