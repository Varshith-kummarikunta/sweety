const path = require('path');
const { Pool } = require('pg');

// Centralized environment loading: resolves backend/.env relative to backend root
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const isTest = process.env.NODE_ENV === 'test';
const dbName = isTest
  ? (process.env.TEST_DB_NAME || 'sweety_test_db')
  : (process.env.DB_NAME || 'sweety_db');

const poolConfig = process.env.DATABASE_URL && !isTest
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      database: dbName,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
