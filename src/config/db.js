const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'u427661378_jhatpaths',
  process.env.DB_USER || 'u427661378_jhatpaths',
  process.env.DB_PASSWORD || 'Jhatpaths@123',
  {
    host: process.env.DB_HOST || 'auth-db674.hstgr.io',
    dialect: 'mysql',
    logging: false,
  }
);

module.exports = sequelize;
