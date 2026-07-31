const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

const queries = [
  "UPDATE invoice SET currency_code = 'INR' WHERE currency_code = 'USD'",
  "UPDATE bill SET currency_code = 'INR' WHERE currency_code = 'USD'",
  "UPDATE quote SET currency_code = 'INR' WHERE currency_code = 'USD'",
  "UPDATE purchase_order SET currency_code = 'INR' WHERE currency_code = 'USD'",
  "UPDATE debit_note SET currency_code = 'INR' WHERE currency_code = 'USD'",
  "UPDATE credit_note SET currency_code = 'INR' WHERE currency_code = 'USD'",
  "UPDATE bank_account SET currency_code = 'INR' WHERE currency_code = 'USD'",
  "UPDATE contact SET default_currency = 'INR' WHERE default_currency = 'USD'",
  "UPDATE organization SET default_currency = 'INR' WHERE default_currency = 'USD'",
  // Some tables might use 'currency' instead of 'currency_code'
  "UPDATE deal SET currency = 'INR' WHERE currency = 'USD'"
];

client.connect().then(async () => {
  try {
    console.log('Sweeping the database for USD...');
    for (const q of queries) {
      try {
        const res = await client.query(q);
        if (res.rowCount > 0) {
          console.log(`Updated ${res.rowCount} rows with query: ${q}`);
        }
      } catch (e) {
        // Ignore errors for tables that don't exist or don't have the column
      }
    }
    console.log('Database sweep complete!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
});
