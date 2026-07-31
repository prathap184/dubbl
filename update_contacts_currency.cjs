const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect().then(async () => {
  try {
    const res = await client.query("UPDATE contact SET currency_code = 'INR' WHERE currency_code = 'USD'");
    console.log(`Successfully updated ${res.rowCount} contacts from USD to INR!`);
  } catch (err) {
    console.error('Error updating contacts:', err);
  } finally {
    process.exit(0);
  }
});
