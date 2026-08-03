const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function reset() {
  await client.connect();
  const hash = await bcrypt.hash('admin@gmail.com', 10);
  const res = await client.query(
    "UPDATE users SET password_hash = $1 WHERE email = 'admin@gmail.com' RETURNING email, id",
    [hash]
  );
  console.log('Password reset result:', res.rows);
  await client.end();
}

reset().catch(console.error);
