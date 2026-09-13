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
    dialectOptions: { connectTimeout: 30000, ssl: false },
    pool: {
      max: 2,          // max 2 connections total — stay well under Hostinger's limit
      min: 1,          // keep 1 alive so requests don't reconnect every time
      acquire: 30000,  // wait up to 30s for a free connection
      idle: 600000,    // keep idle connection alive for 10 min before closing
      evict: 60000,    // check for stale connections every 60s
    },
  }
);

module.exports = sequelize;
