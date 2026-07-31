const { Client } = require('pg');
require('dotenv').config();
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  const userId = 'ff3cab24-93cb-404d-8183-ec52f1d3f44f';
  await client.query("INSERT INTO users (id, name, email) VALUES ($1, 'Demo User', 'demo@example.com') ON CONFLICT DO NOTHING", [userId]);
  console.log('Demo user created with ID:', userId);
  process.exit(0);
}).catch(console.error);
