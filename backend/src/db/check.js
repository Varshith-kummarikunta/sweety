const { pool } = require('../config/db');

async function checkConnection() {
  console.log('Checking PostgreSQL database connection...');
  try {
    const res = await pool.query('SELECT NOW() as current_time, current_database() as database, version() as version');
    const { current_time, database, version } = res.rows[0];
    console.log('Connection successful!');
    console.log(`- Database: ${database}`);
    console.log(`- Server Time: ${current_time}`);
    console.log(`- Version: ${version.split(',')[0]}`);
  } catch (err) {
    console.error('Database connection failed:', err.message);
    if (err.code) {
      console.error(`PostgreSQL Error Code: ${err.code}`);
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  checkConnection();
}

module.exports = { checkConnection };
