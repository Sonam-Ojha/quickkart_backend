/**
 * Run once: node src/migrations/add_geo_masters.js
 * Creates countries, states, cities tables and seeds India data.
 * Also adds city_id FK column to dark_stores.
 */
const sequelize = require('../config/db');
const { DataTypes, QueryInterface } = require('sequelize');

const INDIA_STATES = [
  { name: 'Andhra Pradesh',        code: 'AP' },
  { name: 'Arunachal Pradesh',     code: 'AR' },
  { name: 'Assam',                 code: 'AS' },
  { name: 'Bihar',                 code: 'BR' },
  { name: 'Chhattisgarh',         code: 'CG' },
  { name: 'Goa',                   code: 'GA' },
  { name: 'Gujarat',               code: 'GJ' },
  { name: 'Haryana',               code: 'HR' },
  { name: 'Himachal Pradesh',      code: 'HP' },
  { name: 'Jharkhand',             code: 'JH' },
  { name: 'Karnataka',             code: 'KA' },
  { name: 'Kerala',                code: 'KL' },
  { name: 'Madhya Pradesh',        code: 'MP' },
  { name: 'Maharashtra',           code: 'MH' },
  { name: 'Manipur',               code: 'MN' },
  { name: 'Meghalaya',             code: 'ML' },
  { name: 'Mizoram',               code: 'MZ' },
  { name: 'Nagaland',              code: 'NL' },
  { name: 'Odisha',                code: 'OD' },
  { name: 'Punjab',                code: 'PB' },
  { name: 'Rajasthan',             code: 'RJ' },
  { name: 'Sikkim',                code: 'SK' },
  { name: 'Tamil Nadu',            code: 'TN' },
  { name: 'Telangana',             code: 'TG' },
  { name: 'Tripura',               code: 'TR' },
  { name: 'Uttar Pradesh',         code: 'UP' },
  { name: 'Uttarakhand',           code: 'UK' },
  { name: 'West Bengal',           code: 'WB' },
  // Union Territories
  { name: 'Andaman and Nicobar Islands', code: 'AN' },
  { name: 'Chandigarh',            code: 'CH' },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', code: 'DN' },
  { name: 'Delhi',                 code: 'DL' },
  { name: 'Jammu and Kashmir',     code: 'JK' },
  { name: 'Ladakh',                code: 'LA' },
  { name: 'Lakshadweep',           code: 'LD' },
  { name: 'Puducherry',            code: 'PY' },
];

(async () => {
  const qi = sequelize.getQueryInterface();

  // 1. countries
  try {
    await qi.createTable('countries', {
      id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name:       { type: DataTypes.STRING(100), allowNull: false, unique: true },
      code:       { type: DataTypes.STRING(3),   allowNull: false, unique: true },
      is_active:  { type: DataTypes.BOOLEAN, defaultValue: true },
      created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    });
    console.log('✅  countries table created');
  } catch (e) {
    console.log('⚠️   countries:', e.message.includes('already exists') ? 'already exists' : e.message);
  }

  // 2. states
  try {
    await qi.createTable('states', {
      id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      country_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'countries', key: 'id' } },
      name:       { type: DataTypes.STRING(100), allowNull: false },
      code:       { type: DataTypes.STRING(10), allowNull: true },
      is_active:  { type: DataTypes.BOOLEAN, defaultValue: true },
      created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    });
    console.log('✅  states table created');
  } catch (e) {
    console.log('⚠️   states:', e.message.includes('already exists') ? 'already exists' : e.message);
  }

  // 3. cities
  try {
    await qi.createTable('cities', {
      id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      state_id:   { type: DataTypes.INTEGER, allowNull: false, references: { model: 'states', key: 'id' } },
      name:       { type: DataTypes.STRING(100), allowNull: false },
      is_active:  { type: DataTypes.BOOLEAN, defaultValue: true },
      created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    });
    console.log('✅  cities table created');
  } catch (e) {
    console.log('⚠️   cities:', e.message.includes('already exists') ? 'already exists' : e.message);
  }

  // 4. city_id in dark_stores
  try {
    await qi.addColumn('dark_stores', 'city_id', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'cities', key: 'id' },
    });
    console.log('✅  city_id added to dark_stores');
  } catch (e) {
    console.log('⚠️   dark_stores city_id:', e.original?.code === 'ER_DUP_FIELDNAME' ? 'already exists' : e.message);
  }

  // 5. Seed India
  const [india] = await sequelize.query(
    `INSERT IGNORE INTO countries (name, code, is_active, created_at, updated_at)
     VALUES ('India', 'IN', 1, NOW(), NOW())`,
  );
  const [row] = await sequelize.query(`SELECT id FROM countries WHERE code='IN' LIMIT 1`);
  const indiaId = row[0]?.id;
  console.log(`✅  India seeded (id=${indiaId})`);

  // 6. Seed all states
  for (const s of INDIA_STATES) {
    await sequelize.query(
      `INSERT IGNORE INTO states (country_id, name, code, is_active, created_at, updated_at)
       VALUES (${indiaId}, '${s.name.replace(/'/g, "\\'")}', '${s.code}', 1, NOW(), NOW())`,
    );
  }
  console.log(`✅  ${INDIA_STATES.length} states seeded`);

  await sequelize.close();
  console.log('\n🎉  Geo migration complete!');
})();
