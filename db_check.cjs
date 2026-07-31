const { Client } = require('pg'); 
const client = new Client({ connectionString: 'postgresql://postgres.dijmmkbfdgevnxbbnmbj:Powerstar%40200319@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres' }); 
client.connect()
  .then(() => client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'inventory_item'"))
  .then(res => { 
    console.log('Columns in inventory_item:', res.rows.map(r => r.column_name).join(', ')); 
    process.exit(0); 
  })
  .catch(console.error);
