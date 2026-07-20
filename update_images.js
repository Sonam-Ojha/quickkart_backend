// Run: node update_images.js
// Sets imageUrl on all products using per-subcategory Unsplash photos
require('dotenv').config();
const sequelize = require('./src/config/db');
const Category  = require('./src/models/category.model');
const Product   = require('./src/models/product.model');

// One stable Unsplash photo per subcategory (300x300 crop)
const SUB_IMAGES = {
  'Atta':               'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=300&h=300&fit=crop&q=80',
  'Besan':              'https://images.unsplash.com/photo-1612257998531-a3f89c66c0ee?w=300&h=300&fit=crop&q=80',
  'Maida':              'https://images.unsplash.com/photo-1568660655886-6f5b7c8fce7b?w=300&h=300&fit=crop&q=80',
  'Rice':               'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?w=300&h=300&fit=crop&q=80',
  'Sooji & Rava':       'https://images.unsplash.com/photo-1597581742468-0b7a6f4c8db5?w=300&h=300&fit=crop&q=80',
  'Dals & Pulses':      'https://images.unsplash.com/photo-1610725664285-7c57e6eeac3f?w=300&h=300&fit=crop&q=80',

  'Milk':               'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=300&h=300&fit=crop&q=80',
  'Paneer':             'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=300&h=300&fit=crop&q=80',
  'Curd & Yogurt':      'https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=300&h=300&fit=crop&q=80',
  'Butter & Cream':     'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=300&h=300&fit=crop&q=80',
  'Eggs':               'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=300&h=300&fit=crop&q=80',
  'Cheese':             'https://images.unsplash.com/photo-1552767059-ce182ead6c1b?w=300&h=300&fit=crop&q=80',

  'Fresh Fruits':       'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=300&h=300&fit=crop&q=80',
  'Fresh Vegetables':   'https://images.unsplash.com/photo-1540420773420-3450ad71a4ca?w=300&h=300&fit=crop&q=80',
  'Leafy Greens':       'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=300&h=300&fit=crop&q=80',
  'Exotic Veggies':     'https://images.unsplash.com/photo-1598511796432-32a9b25e8966?w=300&h=300&fit=crop&q=80',

  'Chips & Crisps':     'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=300&h=300&fit=crop&q=80',
  'Biscuits':           'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=300&h=300&fit=crop&q=80',
  'Namkeen':            'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=300&h=300&fit=crop&q=80',
  'Chocolates':         'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=300&h=300&fit=crop&q=80',
  'Dry Fruits':         'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=300&h=300&fit=crop&q=80',

  'Cold Drinks':        'https://images.unsplash.com/photo-1527960669566-f882ba85ae8a?w=300&h=300&fit=crop&q=80',
  'Juices':             'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=300&h=300&fit=crop&q=80',
  'Tea & Coffee':       'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=300&h=300&fit=crop&q=80',
  'Energy Drinks':      'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300&h=300&fit=crop&q=80',
  'Water & Soda':       'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=300&h=300&fit=crop&q=80',

  'Shampoo & Hair Care':'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300&h=300&fit=crop&q=80',
  'Soap & Bodywash':    'https://images.unsplash.com/photo-1607582544956-7dc48e31d70a?w=300&h=300&fit=crop&q=80',
  'Oral Care':          'https://images.unsplash.com/photo-1559589689-577aabd1db4f?w=300&h=300&fit=crop&q=80',
  'Skin Care':          'https://images.unsplash.com/photo-1571781926291-c7a09de43f0e?w=300&h=300&fit=crop&q=80',
  'Feminine Care':      'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=300&h=300&fit=crop&q=80',

  'Detergents':         'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=300&h=300&fit=crop&q=80',
  'Dishwash':           'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300&h=300&fit=crop&q=80',
  'Toilet Cleaners':    'https://images.unsplash.com/photo-1585842378054-ee2e52f94ba2?w=300&h=300&fit=crop&q=80',
  'Fresheners & Repel': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=300&fit=crop&q=80',

  'Noodles & Pasta':    'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=300&h=300&fit=crop&q=80',
  'Ready to Eat':       'https://images.unsplash.com/photo-1585325701956-60dd9c8553bc?w=300&h=300&fit=crop&q=80',
  'Frozen Snacks':      'https://images.unsplash.com/photo-1573246123716-6b1782bfc499?w=300&h=300&fit=crop&q=80',
  'Soups':              'https://images.unsplash.com/photo-1547592180-85f173990554?w=300&h=300&fit=crop&q=80',

  'Whole Spices':       'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=300&h=300&fit=crop&q=80',
  'Blended Masala':     'https://images.unsplash.com/photo-1532336414038-cf19250c5757?w=300&h=300&fit=crop&q=80',
  'Salt & Sugar':       'https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?w=300&h=300&fit=crop&q=80',
  'Condiments':         'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=300&h=300&fit=crop&q=80',

  'Baby Food':          'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=300&h=300&fit=crop&q=80',
  'Diapers & Wipes':    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=300&h=300&fit=crop&q=80',
  'Baby Skin Care':     'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=300&h=300&fit=crop&q=80',

  'Breads & Buns':      'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=300&h=300&fit=crop&q=80',
  'Cakes & Muffins':    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=300&fit=crop&q=80',
  'Rusk & Toast':       'https://images.unsplash.com/photo-1506459225024-1428097a7e18?w=300&h=300&fit=crop&q=80',

  'Cooking Oils':       'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300&h=300&fit=crop&q=80',
  'Ghee':               'https://images.unsplash.com/photo-1628191080869-4a0e00efea28?w=300&h=300&fit=crop&q=80',
  'Mustard Oil':        'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300&h=300&fit=crop&q=80',
};

async function run() {
  try {
    await sequelize.authenticate();
    console.log('✅ DB connected\n');
    await sequelize.sync({ alter: { drop: false } });

    const subs = await Category.findAll({ where: { parent_id: { [require('sequelize').Op.ne]: null } } });
    const subMap = Object.fromEntries(subs.map(s => [s.name, s.id]));

    let updated = 0;
    for (const [subName, imgUrl] of Object.entries(SUB_IMAGES)) {
      const catId = subMap[subName];
      if (!catId) { console.log(`⚠  Sub not found: ${subName}`); continue; }
      const [count] = await Product.update(
        { imageUrl: imgUrl },
        { where: { category_id: catId } }
      );
      console.log(`✓ ${subName} → ${count} products updated`);
      updated += count;
    }

    console.log(`\n🎉 Done! Total updated: ${updated}`);
    process.exit(0);
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }
}

run();
