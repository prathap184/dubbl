import { db } from './lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Truncating all tables...');
  await db.execute(sql`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
  console.log('Done!');
  process.exit(0);
}

main();