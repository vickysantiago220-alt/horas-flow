const mysql = require('mysql2/promise');

async function main() {
  const pool = await mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'HoraFlow@2026',
    database: 'horaflow',
    charset: 'utf8mb4',
  });

  const [rows] = await pool.query(
    "SHOW COLUMNS FROM users LIKE 'role'"
  );

  console.log(rows);

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});