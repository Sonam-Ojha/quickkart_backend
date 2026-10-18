/**
 * Run once: node src/migrations/add_product_images.js
 * Adds products.images (JSON array in TEXT) for the swipeable gallery and
 * seeds it from the existing single image_url.
 */
const sequelize = require('../config/db');
const { DataTypes } = require('sequelize');

(async () => {
  const qi = sequelize.getQueryInterface();
  try {
    await qi.addColumn('products', 'images', { type: DataTypes.TEXT, allowNull: true });
    console.log('✅  images column added to products');
  } catch (e) {
    if (e.original?.code === 'ER_DUP_FIELDNAME') console.log('⚠️   images already exists — skipped');
    else { console.error('❌', e.message); await sequelize.close(); return; }
  }
  const [, meta] = await sequelize.query(
    `UPDATE products SET images = JSON_ARRAY(image_url)
      WHERE images IS NULL AND image_url IS NOT NULL AND image_url <> ''`,
  );
  console.log(`✅  seeded gallery for ${meta?.affectedRows ?? 0} product(s)`);
  await sequelize.close();
})();
