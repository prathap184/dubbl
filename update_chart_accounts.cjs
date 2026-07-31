const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect().then(async () => {
  try {
    const res = await client.query("UPDATE chart_account SET currency_code = 'INR' WHERE currency_code = 'USD'");
    console.log(`Successfully updated ${res.rowCount} accounts from USD to INR!`);
  } catch (err) {
    console.error('Error updating chart accounts:', err);
  } finally {
    process.exit(0);
  }
});
