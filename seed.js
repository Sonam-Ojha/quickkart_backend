// Run: node seed.js
require('dotenv').config();
const sequelize = require('./src/config/db');
const Category  = require('./src/models/category.model');

const MAIN_CATEGORIES = [
  { name: 'Atta & Grains',         icon: '🌾', sortOrder: 1  },
  { name: 'Dairy & Eggs',          icon: '🥛', sortOrder: 2  },
  { name: 'Fruits & Vegetables',   icon: '🥦', sortOrder: 3  },
  { name: 'Snacks & Namkeen',      icon: '🍿', sortOrder: 4  },
  { name: 'Beverages',             icon: '🥤', sortOrder: 5  },
  { name: 'Personal Care',         icon: '🧴', sortOrder: 6  },
  { name: 'Household & Cleaning',  icon: '🧹', sortOrder: 7  },
  { name: 'Instant & Frozen Food', icon: '🍜', sortOrder: 8  },
  { name: 'Masala & Spices',       icon: '🌶️', sortOrder: 9  },
  { name: 'Baby Care',             icon: '👶', sortOrder: 10 },
  { name: 'Bakery & Breads',       icon: '🍞', sortOrder: 11 },
  { name: 'Oils & Ghee',           icon: '🫙', sortOrder: 12 },
];

const SUB_CATEGORIES = {
  'Atta & Grains': [
    { name: 'Atta',          icon: '🌾' },
    { name: 'Besan',         icon: '🟡' },
    { name: 'Maida',         icon: '⚪' },
    { name: 'Rice',          icon: '🍚' },
    { name: 'Sooji & Rava',  icon: '🥣' },
    { name: 'Dals & Pulses', icon: '🫘' },
  ],
  'Dairy & Eggs': [
    { name: 'Milk',          icon: '🥛' },
    { name: 'Paneer',        icon: '🧀' },
    { name: 'Curd & Yogurt', icon: '🫙' },
    { name: 'Butter & Cream',icon: '🧈' },
    { name: 'Eggs',          icon: '🥚' },
    { name: 'Cheese',        icon: '🧀' },
  ],
  'Fruits & Vegetables': [
    { name: 'Fresh Fruits',     icon: '🍎' },
    { name: 'Fresh Vegetables', icon: '🥦' },
    { name: 'Leafy Greens',     icon: '🥬' },
    { name: 'Exotic Veggies',   icon: '🫑' },
  ],
  'Snacks & Namkeen': [
    { name: 'Chips & Crisps', icon: '🥔' },
    { name: 'Biscuits',       icon: '🍪' },
    { name: 'Namkeen',        icon: '🫘' },
    { name: 'Chocolates',     icon: '🍫' },
    { name: 'Dry Fruits',     icon: '🥜' },
  ],
  'Beverages': [
    { name: 'Cold Drinks',     icon: '🥤' },
    { name: 'Juices',          icon: '🧃' },
    { name: 'Tea & Coffee',    icon: '☕' },
    { name: 'Energy Drinks',   icon: '⚡' },
    { name: 'Water & Soda',    icon: '💧' },
  ],
  'Personal Care': [
    { name: 'Shampoo & Hair Care', icon: '🧴' },
    { name: 'Soap & Bodywash',     icon: '🧼' },
    { name: 'Oral Care',           icon: '🦷' },
    { name: 'Skin Care',           icon: '✨' },
    { name: 'Feminine Care',       icon: '🌸' },
  ],
  'Household & Cleaning': [
    { name: 'Detergents',          icon: '🫧' },
    { name: 'Dishwash',            icon: '🍽️' },
    { name: 'Toilet Cleaners',     icon: '🚽' },
    { name: 'Fresheners & Repel',  icon: '🌿' },
  ],
  'Instant & Frozen Food': [
    { name: 'Noodles & Pasta', icon: '🍜' },
    { name: 'Ready to Eat',    icon: '🍱' },
    { name: 'Frozen Snacks',   icon: '❄️' },
    { name: 'Soups',           icon: '🥣' },
  ],
  'Masala & Spices': [
    { name: 'Whole Spices',  icon: '🌶️' },
    { name: 'Blended Masala',icon: '🫙' },
    { name: 'Salt & Sugar',  icon: '🧂' },
    { name: 'Condiments',    icon: '🍯' },
  ],
  'Baby Care': [
    { name: 'Baby Food',       icon: '🍼' },
    { name: 'Diapers & Wipes', icon: '🧷' },
    { name: 'Baby Skin Care',  icon: '🧴' },
  ],
  'Bakery & Breads': [
    { name: 'Breads & Buns',  icon: '🍞' },
    { name: 'Cakes & Muffins',icon: '🧁' },
    { name: 'Rusk & Toast',   icon: '🍞' },
  ],
  'Oils & Ghee': [
    { name: 'Cooking Oils', icon: '🫙' },
    { name: 'Ghee',         icon: '🧈' },
    { name: 'Mustard Oil',  icon: '🌻' },
  ],
};

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('✅ DB connected\n');

    await sequelize.sync({ alter: { drop: false } });

    // 1. Main categories
    console.log('📁 Main categories...');
    const mainMap = {};
    for (const mc of MAIN_CATEGORIES) {
      const [row, created] = await Category.findOrCreate({
        where: { name: mc.name, parent_id: null },
        defaults: { ...mc, parentId: null, isActive: true },
      });
      mainMap[mc.name] = row.id;
      console.log(`   ${created ? '✓ Added' : '⤼ Exists'} ${mc.icon} ${mc.name}`);
    }

    // 2. Sub categories
    console.log('\n📂 Sub categories...');
    for (const [mainName, subs] of Object.entries(SUB_CATEGORIES)) {
      const parentId = mainMap[mainName];
      if (!parentId) continue;
      for (const sub of subs) {
        const [, created] = await Category.findOrCreate({
          where: { name: sub.name, parent_id: parentId },
          defaults: { ...sub, parentId, sortOrder: 0, isActive: true },
        });
        console.log(`   ${created ? '✓' : '⤼'} ${sub.icon} ${sub.name}`);
      }
    }

    const total = await Category.count();
    console.log(`\n🎉 Done! Total categories in DB: ${total}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }
}

seed();
