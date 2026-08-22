import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'HoraFlow@2026',
  database: 'horaflow',
  charset: 'utf8mb4',
});