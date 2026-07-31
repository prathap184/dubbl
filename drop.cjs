const { Client } = require('pg');
require('dotenv').config();
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(() => c.query('DROP TABLE IF EXISTS "profiles" CASCADE')).then(() => {
  console.log('Dropped');
  process.exit(0);
});
