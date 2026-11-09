const { Sequelize } = require('sequelize');

if (!process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_HOST) {
  throw new Error('Missing required DB environment variables: DB_NAME, DB_USER, DB_PASSWORD, DB_HOST');
}

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host:    process.env.DB_HOST,
    port:    Number(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: false,
    dialectOptions: { connectTimeout: 30000, ssl: { rejectUnauthorized: false } },
    pool: {
      max:     5,
      min:     0,
      acquire: 10000,  // fail fast — 10s max wait instead of 30s
      idle:    20000,
      evict:   10000,
    },
  }
);

module.exports = sequelize;
