const sequelize = require('../config/db');
const { DataTypes } = require('sequelize');

(async () => {
  const qi = sequelize.getQueryInterface();
  try {
    await qi.createTable('otps', {
      id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      key:        { type: DataTypes.STRING(150), allowNull: false },
      otp:        { type: DataTypes.STRING(6), allowNull: false },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await qi.addIndex('otps', ['key'], { name: 'otps_key_idx' });
    console.log('✅  otps table created');
  } catch (e) {
    if (e.original?.code === 'ER_TABLE_EXISTS_ERROR') console.log('⚠️   otps table already exists — skipped');
    else console.error('❌', e.message);
  }
  await sequelize.close();
})();
