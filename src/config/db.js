const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'u427661378_jhatpaths',
  process.env.DB_USER || 'u427661378_jhatpaths',
  process.env.DB_PASSWORD || 'Jhatpaths@123',
  {
    host:    process.env.DB_HOST || 'auth-db674.hstgr.io',
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
