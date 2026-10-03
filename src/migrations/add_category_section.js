/**
 * Run once: node src/migrations/add_category_section.js [--flatten]
 *
 * 1. Adds `section` ENUM('grocery','fresh') to categories (default 'grocery').
 * 2. Marks the old keyword-matched "Fresh" main categories (and their
 *    sub-categories) as section = 'fresh' — this is what the app's Fresh tab
 *    used to guess from the name.
 * 3. With --flatten: the sub-categories under a fresh main category (e.g.
 *    Fresh → Sabji, Fruits) become main categories themselves, so the Fresh
 *    tab rail shows Sabji / Fruits directly. The old parent is deactivated
 *    only if it has no products of its own.
 */
const sequelize = require('../config/db');
const { DataTypes } = require('sequelize');
const Category = require('../models/category.model');
const Product  = require('../models/product.model');

const FRESH_KEYWORDS = ['fresh', 'fruit', 'vegetable', 'sabzi', 'sabji', 'produce'];
const flatten = process.argv.includes('--flatten');

(async () => {
  const qi = sequelize.getQueryInterface();
  try {
    await qi.addColumn('categories', 'section', {
      type: DataTypes.ENUM('grocery', 'fresh'),
      allowNull: false,
      defaultValue: 'grocery',
    });
    console.log('✅  section column added to categories (default grocery)');
  } catch (e) {
    if (e.original?.code === 'ER_DUP_FIELDNAME') console.log('⚠️   section already exists — skipped');
    else { console.error('❌', e.message); await sequelize.close(); return; }
  }

  const roots = await Category.findAll({ where: { parentId: null } });
  const freshRoots = roots.filter((c) => FRESH_KEYWORDS.some((kw) => c.name.toLowerCase().includes(kw)));

  for (const root of freshRoots) {
    await root.update({ section: 'fresh' });
    const [n] = await Category.update({ section: 'fresh' }, { where: { parentId: root.id } });
    console.log(`✅  "${root.name}" + ${n} sub-categories → fresh`);

    if (!flatten || n === 0) continue;
    await Category.update({ parentId: null }, { where: { parentId: root.id } });
    const own = await Product.count({ where: { categoryId: root.id } });
    if (own === 0) {
      await root.update({ isActive: false });
      console.log(`   ↳ sub-categories promoted to main; "${root.name}" deactivated (no own products)`);
    } else {
      console.log(`   ↳ sub-categories promoted to main; "${root.name}" kept active (${own} products on it)`);
    }
  }

  if (freshRoots.length === 0) console.log('ℹ️   No fresh-looking main category found — mark them from Admin → Catalog → Fresh');
  await sequelize.close();
})();
