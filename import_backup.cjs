const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config();

const BATCH_SIZE = 500;

function inferType(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return 'BOOLEAN';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'INTEGER' : 'NUMERIC';
  }
  if (typeof value === 'object') return 'JSONB';
  if (typeof value === 'string') {
    if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)) {
      return 'UUID';
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return 'TIMESTAMP WITH TIME ZONE';
      }
    }
    return 'TEXT';
  }
  return 'TEXT';
}

function getTableSchema(data) {
  const schema = {};
  for (const row of data) {
    for (const key of Object.keys(row)) {
      const type = inferType(row[key]);
      if (!type) continue;
      
      if (!schema[key]) {
        schema[key] = type;
      } else if (schema[key] !== type) {
        // Upgrade logic
        if (schema[key] === 'INTEGER' && type === 'NUMERIC') {
          schema[key] = 'NUMERIC';
        } else if (schema[key] === 'NUMERIC' && type === 'INTEGER') {
          // Keep NUMERIC
        } else {
          schema[key] = 'TEXT';
        }
      }
    }
  }
  
  // Set defaults for empty columns
  for (const key of Object.keys(schema)) {
    if (!schema[key]) schema[key] = 'TEXT';
  }
  
  return schema;
}

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    console.log('Loading database_backup.json...');
    const data = JSON.parse(fs.readFileSync('database_backup.json', 'utf8'));
    
    for (const tableName of Object.keys(data)) {
      const rows = data[tableName];
      if (rows.length === 0) {
        console.log(`Skipping ${tableName} (0 rows)`);
        continue;
      }
      
      const targetTableName = tableName === 'users' ? 'u_users' : tableName;
      
      console.log(`\nProcessing ${tableName} as ${targetTableName} (${rows.length} rows)...`);
      const schema = getTableSchema(rows);
      
      // Build CREATE TABLE query
      const cols = Object.entries(schema).map(([col, type]) => `"${col}" ${type}`).join(',\n  ');
      
      const createQuery = `
        CREATE TABLE IF NOT EXISTS "${targetTableName}" (
          ${cols}
        );
      `;
      
      console.log(`Creating table ${targetTableName}...`);
      await client.query(createQuery);
      
      // Build INSERT query
      const keys = Object.keys(schema);
      const colNames = keys.map(k => `"${k}"`).join(', ');
      
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const values = [];
        const params = [];
        let paramIdx = 1;
        
        for (const row of batch) {
          const rowVals = [];
          for (const key of keys) {
            let val = row[key];
            if (typeof val === 'object' && val !== null) {
              val = JSON.stringify(val);
            }
            params.push(val);
            rowVals.push(`$${paramIdx++}`);
          }
          values.push(`(${rowVals.join(', ')})`);
        }
        
        const insertQuery = `
          INSERT INTO "${targetTableName}" (${colNames}) 
          VALUES ${values.join(', ')}
          ON CONFLICT DO NOTHING
        `;
        
        await client.query(insertQuery, params);
        console.log(`Inserted rows ${i + 1} to ${Math.min(i + BATCH_SIZE, rows.length)}`);
      }
    }
    
    console.log('\nMigration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await client.end();
  }
}

run();
