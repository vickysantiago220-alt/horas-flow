require('dotenv').config();

const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
  });

  const [rows] = await connection.query(
    "SHOW COLUMNS FROM users LIKE 'role'"
  );

  console.log(rows);

  await connection.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});