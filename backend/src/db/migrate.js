const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function runMigration() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  console.log(`Starting database migration using schema: ${schemaPath}`);

  try {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Acquire a client from the pool to run in a single transaction
    const client = await pool.connect();
    try {
      console.log('Connected to PostgreSQL successfully.');
      await client.query('BEGIN');
      await client.query(schemaSql);
      await client.query('COMMIT');
      console.log('Database migration completed successfully.');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Migration execution failed, transaction rolled back.');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database migration error:', err.message);
    if (err.code) {
      console.error(`PostgreSQL Error Code: ${err.code}`);
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
    console.log('Database connection pool closed.');
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
