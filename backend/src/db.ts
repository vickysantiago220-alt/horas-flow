import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME!,

  charset: 'utf8mb4',

  connectTimeout: 15000,

  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,

  ...(process.env.DB_CA
    ? {
        ssl: {
          ca: process.env.DB_CA,
          rejectUnauthorized: true,
        },
      }
    : {}),
};

export const pool = mysql.createPool(dbConfig);
