const { Client } = require('pg');
require('dotenv').config();
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  try {
    const res = await client.query("UPDATE payment SET currency_code = 'INR' WHERE currency_code = 'USD'");
    console.log('Updated payments: ' + res.rowCount);
    
    // Check if journal_line has currencyCode
    try {
      const res2 = await client.query("UPDATE journal_line SET currency_code = 'INR' WHERE currency_code = 'USD'");
      console.log('Updated journal_lines: ' + res2.rowCount);
    } catch(e) {}
    
  } catch(e) { console.error(e) }
  process.exit(0);
});
