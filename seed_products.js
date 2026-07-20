// Run: node seed_products.js
require('dotenv').config();
const sequelize = require('./src/config/db');
const Category  = require('./src/models/category.model');
const Product   = require('./src/models/product.model');

// 5 products per sub-category  (price/mrp in paise)
const PRODUCTS = {
  // ── Atta & Grains ──────────────────────────────────────────
  'Atta': [
    { name: 'Aashirvaad Whole Wheat Atta 5kg',   brand: 'Aashirvaad', unit: '5 kg',  mrp: 28500, price: 25900, tag: 'bestseller' },
    { name: 'Fortune Chakki Fresh Atta 10kg',     brand: 'Fortune',    unit: '10 kg', mrp: 52000, price: 47000, tag: 'deal'       },
    { name: 'Rajdhani Atta 2kg',                  brand: 'Rajdhani',   unit: '2 kg',  mrp: 12000, price: 10500, tag: null         },
    { name: 'Patanjali Atta 5kg',                 brand: 'Patanjali',  unit: '5 kg',  mrp: 24000, price: 22000, tag: null         },
    { name: 'Pillsbury Chakki Fresh Atta 1kg',    brand: 'Pillsbury',  unit: '1 kg',  mrp:  6500, price:  5800, tag: 'new'        },
  ],
  'Besan': [
    { name: 'Rajdhani Besan 500g',                brand: 'Rajdhani',   unit: '500 g', mrp:  7500, price:  6500, tag: null         },
    { name: 'Patanjali Besan 1kg',                brand: 'Patanjali',  unit: '1 kg',  mrp: 13000, price: 11500, tag: 'bestseller' },
    { name: 'Haldiram Besan 500g',                brand: 'Haldiram',   unit: '500 g', mrp:  8000, price:  7000, tag: null         },
    { name: 'MDH Besan 200g',                     brand: 'MDH',        unit: '200 g', mrp:  3500, price:  3000, tag: 'deal'       },
    { name: 'Fortune Besan 1kg',                  brand: 'Fortune',    unit: '1 kg',  mrp: 14000, price: 12500, tag: null         },
  ],
  'Maida': [
    { name: 'Pillsbury Maida 1kg',                brand: 'Pillsbury',  unit: '1 kg',  mrp:  9000, price:  7800, tag: null         },
    { name: 'Annapurna Maida 500g',               brand: 'Annapurna',  unit: '500 g', mrp:  4500, price:  4000, tag: 'new'        },
    { name: 'Rajdhani Maida 2kg',                 brand: 'Rajdhani',   unit: '2 kg',  mrp: 16000, price: 14000, tag: null         },
    { name: 'Fortune Maida 1kg',                  brand: 'Fortune',    unit: '1 kg',  mrp:  9500, price:  8200, tag: 'deal'       },
    { name: 'Patanjali Maida 1kg',                brand: 'Patanjali',  unit: '1 kg',  mrp:  8500, price:  7500, tag: null         },
  ],
  'Rice': [
    { name: 'India Gate Basmati 1kg',             brand: 'India Gate', unit: '1 kg',  mrp: 15000, price: 13500, tag: 'bestseller' },
    { name: 'Daawat Rozana 5kg',                  brand: 'Daawat',     unit: '5 kg',  mrp: 38000, price: 34500, tag: null         },
    { name: 'Fortune Sona Masoori 5kg',           brand: 'Fortune',    unit: '5 kg',  mrp: 34000, price: 30000, tag: 'deal'       },
    { name: 'Kohinoor Extra Long Basmati 1kg',    brand: 'Kohinoor',   unit: '1 kg',  mrp: 18000, price: 16000, tag: null         },
    { name: 'Patanjali Basmati Rice 1kg',         brand: 'Patanjali',  unit: '1 kg',  mrp: 13000, price: 11500, tag: 'new'        },
  ],
  'Sooji & Rava': [
    { name: 'MTR Sooji 500g',                     brand: 'MTR',        unit: '500 g', mrp:  5000, price:  4200, tag: null         },
    { name: 'Patanjali Sooji 1kg',                brand: 'Patanjali',  unit: '1 kg',  mrp:  8000, price:  7000, tag: null         },
    { name: 'Rajdhani Sooji 500g',                brand: 'Rajdhani',   unit: '500 g', mrp:  4500, price:  3800, tag: 'deal'       },
    { name: 'Aashirvaad Suji 1kg',                brand: 'Aashirvaad', unit: '1 kg',  mrp:  9000, price:  8000, tag: 'bestseller' },
    { name: 'Fortune Rava 500g',                  brand: 'Fortune',    unit: '500 g', mrp:  4800, price:  4200, tag: null         },
  ],
  'Dals & Pulses': [
    { name: 'Tata Sampann Moong Dal 1kg',         brand: 'Tata',       unit: '1 kg',  mrp: 18000, price: 16000, tag: 'bestseller' },
    { name: 'Rajdhani Chana Dal 1kg',             brand: 'Rajdhani',   unit: '1 kg',  mrp: 14000, price: 12000, tag: null         },
    { name: 'Patanjali Masoor Dal 1kg',           brand: 'Patanjali',  unit: '1 kg',  mrp: 12000, price: 10500, tag: 'deal'       },
    { name: 'Fortune Toor Dal 1kg',               brand: 'Fortune',    unit: '1 kg',  mrp: 15000, price: 13000, tag: null         },
    { name: 'Haldiram Urad Dal 500g',             brand: 'Haldiram',   unit: '500 g', mrp:  9000, price:  7800, tag: null         },
  ],

  // ── Dairy & Eggs ───────────────────────────────────────────
  'Milk': [
    { name: 'Amul Taaza Full Cream 500ml',        brand: 'Amul',        unit: '500 ml', mrp:  3200, price:  3200, tag: 'bestseller' },
    { name: 'Mother Dairy Milk 1L',               brand: 'Mother Dairy',unit: '1 L',    mrp:  6400, price:  6400, tag: null         },
    { name: 'Amul Gold Milk 1L',                  brand: 'Amul',        unit: '1 L',    mrp:  6800, price:  6800, tag: 'deal'       },
    { name: 'Nestle Slim Milk 1L',                brand: 'Nestle',      unit: '1 L',    mrp:  6500, price:  6000, tag: null         },
    { name: 'Amul Shakti Toned 500ml',            brand: 'Amul',        unit: '500 ml', mrp:  2800, price:  2800, tag: null         },
  ],
  'Paneer': [
    { name: 'Amul Paneer 200g',                   brand: 'Amul',        unit: '200 g',  mrp:  9500, price:  8500, tag: null         },
    { name: 'Mother Dairy Paneer 500g',           brand: 'Mother Dairy',unit: '500 g',  mrp: 21000, price: 19500, tag: 'bestseller' },
    { name: 'Verka Paneer 200g',                  brand: 'Verka',       unit: '200 g',  mrp:  9000, price:  8000, tag: null         },
    { name: 'Gowardhan Paneer 400g',              brand: 'Gowardhan',   unit: '400 g',  mrp: 17000, price: 15500, tag: 'deal'       },
    { name: 'Nandini Paneer 200g',                brand: 'Nandini',     unit: '200 g',  mrp:  8500, price:  7500, tag: 'new'        },
  ],
  'Curd & Yogurt': [
    { name: 'Amul Dahi 400g',                     brand: 'Amul',        unit: '400 g',  mrp:  4500, price:  4000, tag: null         },
    { name: 'Mother Dairy Curd 1kg',              brand: 'Mother Dairy',unit: '1 kg',   mrp:  8500, price:  7500, tag: 'bestseller' },
    { name: 'Nestle A+ Curd 400g',               brand: 'Nestle',      unit: '400 g',  mrp:  5000, price:  4500, tag: null         },
    { name: 'Epigamia Greek Yogurt 400g',         brand: 'Epigamia',    unit: '400 g',  mrp:  9900, price:  8900, tag: 'new'        },
    { name: 'Gowardhan Curd 400g',                brand: 'Gowardhan',   unit: '400 g',  mrp:  4800, price:  4200, tag: 'deal'       },
  ],
  'Butter & Cream': [
    { name: 'Amul Butter Salted 100g',            brand: 'Amul',        unit: '100 g',  mrp:  5500, price:  5200, tag: 'bestseller' },
    { name: 'Amul Fresh Cream 200ml',             brand: 'Amul',        unit: '200 ml', mrp:  4500, price:  4200, tag: null         },
    { name: 'Britannia Butter 100g',              brand: 'Britannia',   unit: '100 g',  mrp:  5200, price:  4800, tag: null         },
    { name: 'Nandini Butter 500g',                brand: 'Nandini',     unit: '500 g',  mrp: 24000, price: 22000, tag: 'deal'       },
    { name: 'Milkfood Dairy Whitener 400g',       brand: 'Milkfood',    unit: '400 g',  mrp: 22000, price: 20000, tag: null         },
  ],
  'Eggs': [
    { name: 'Farm Fresh White Eggs 6pcs',         brand: 'Farm Fresh',  unit: '6 pcs',  mrp:  7500, price:  6500, tag: null         },
    { name: 'Country Eggs 12pcs',                 brand: 'Country Eggs',unit: '12 pcs', mrp: 14000, price: 12500, tag: 'deal'       },
    { name: 'Nestle Omega-3 Eggs 6pcs',           brand: 'Nestle',      unit: '6 pcs',  mrp:  9000, price:  8200, tag: 'new'        },
    { name: 'Suguna White Eggs 6pcs',             brand: 'Suguna',      unit: '6 pcs',  mrp:  7000, price:  6200, tag: 'bestseller' },
    { name: 'Brown Eggs 6pcs',                    brand: 'Organic',     unit: '6 pcs',  mrp: 10000, price:  9000, tag: null         },
  ],
  'Cheese': [
    { name: 'Amul Processed Cheese 200g',         brand: 'Amul',        unit: '200 g',  mrp: 11000, price: 10000, tag: 'bestseller' },
    { name: 'Britannia Cheese Slices 750g',       brand: 'Britannia',   unit: '750 g',  mrp: 38000, price: 35000, tag: null         },
    { name: 'Amul Mozzarella Cheese 200g',        brand: 'Amul',        unit: '200 g',  mrp: 14000, price: 12500, tag: 'new'        },
    { name: 'Kraft Cheddar Cheese 200g',          brand: 'Kraft',       unit: '200 g',  mrp: 22000, price: 19500, tag: 'deal'       },
    { name: 'Verka Cheese Spread 200g',           brand: 'Verka',       unit: '200 g',  mrp:  9500, price:  8500, tag: null         },
  ],

  // ── Fruits & Vegetables ────────────────────────────────────
  'Fresh Fruits': [
    { name: 'Banana 1 Dozen',                     brand: 'Fresh',       unit: '1 dz',   mrp:  6000, price:  4500, tag: null         },
    { name: 'Apple Shimla 500g',                  brand: 'Fresh',       unit: '500 g',  mrp: 12000, price: 10500, tag: 'new'        },
    { name: 'Mango Alphonso 500g',                brand: 'Fresh',       unit: '500 g',  mrp: 25000, price: 22000, tag: 'deal'       },
    { name: 'Grapes Black 500g',                  brand: 'Fresh',       unit: '500 g',  mrp: 10000, price:  8500, tag: null         },
    { name: 'Pomegranate 1pc',                    brand: 'Fresh',       unit: '1 pc',   mrp:  8000, price:  7000, tag: 'bestseller' },
  ],
  'Fresh Vegetables': [
    { name: 'Tomato 500g',                        brand: 'Fresh',       unit: '500 g',  mrp:  4000, price:  3000, tag: null         },
    { name: 'Onion 1kg',                          brand: 'Fresh',       unit: '1 kg',   mrp:  6000, price:  4500, tag: null         },
    { name: 'Potato 1kg',                         brand: 'Fresh',       unit: '1 kg',   mrp:  4500, price:  3500, tag: 'bestseller' },
    { name: 'Capsicum Green 250g',                brand: 'Fresh',       unit: '250 g',  mrp:  5000, price:  4000, tag: null         },
    { name: 'Cauliflower 1pc',                    brand: 'Fresh',       unit: '1 pc',   mrp:  4500, price:  3800, tag: 'deal'       },
  ],
  'Leafy Greens': [
    { name: 'Spinach 250g',                       brand: 'Fresh',       unit: '250 g',  mrp:  3000, price:  2500, tag: null         },
    { name: 'Coriander 100g',                     brand: 'Fresh',       unit: '100 g',  mrp:  1500, price:  1200, tag: null         },
    { name: 'Fenugreek (Methi) 200g',             brand: 'Fresh',       unit: '200 g',  mrp:  2500, price:  2000, tag: 'bestseller' },
    { name: 'Mint Leaves 100g',                   brand: 'Fresh',       unit: '100 g',  mrp:  2000, price:  1500, tag: null         },
    { name: 'Curry Leaves 50g',                   brand: 'Fresh',       unit: '50 g',   mrp:  1000, price:   800, tag: 'deal'       },
  ],
  'Exotic Veggies': [
    { name: 'Broccoli 500g',                      brand: 'Fresh',       unit: '500 g',  mrp:  9000, price:  7500, tag: 'new'        },
    { name: 'Zucchini 500g',                      brand: 'Fresh',       unit: '500 g',  mrp:  8000, price:  6500, tag: null         },
    { name: 'Celery 250g',                        brand: 'Fresh',       unit: '250 g',  mrp:  7000, price:  5800, tag: null         },
    { name: 'Red Cabbage 500g',                   brand: 'Fresh',       unit: '500 g',  mrp:  6500, price:  5500, tag: 'deal'       },
    { name: 'Cherry Tomato 200g',                 brand: 'Fresh',       unit: '200 g',  mrp:  7500, price:  6500, tag: 'bestseller' },
  ],

  // ── Snacks & Namkeen ───────────────────────────────────────
  'Chips & Crisps': [
    { name: "Lay's Classic Salted 26g",           brand: "Lay's",       unit: '26 g',   mrp:  2000, price:  2000, tag: 'deal'       },
    { name: "Lay's Magic Masala 78g",             brand: "Lay's",       unit: '78 g',   mrp:  3500, price:  3500, tag: null         },
    { name: 'Kurkure Masala Munch 90g',           brand: 'Kurkure',     unit: '90 g',   mrp:  3500, price:  3500, tag: 'bestseller' },
    { name: 'Bingo Mad Angles 90g',               brand: 'Bingo',       unit: '90 g',   mrp:  3500, price:  3000, tag: null         },
    { name: 'Pringles Original 107g',             brand: 'Pringles',    unit: '107 g',  mrp: 12000, price: 10500, tag: 'new'        },
  ],
  'Biscuits': [
    { name: 'Parle-G Original Glucose 250g',      brand: 'Parle',       unit: '250 g',  mrp:  1500, price:  1500, tag: 'bestseller' },
    { name: 'Oreo Original 119g',                 brand: 'Oreo',        unit: '119 g',  mrp:  4500, price:  4000, tag: null         },
    { name: 'Britannia Bourbon Cream 150g',       brand: 'Britannia',   unit: '150 g',  mrp:  3500, price:  3000, tag: 'deal'       },
    { name: 'Good Day Cashew 150g',               brand: 'Britannia',   unit: '150 g',  mrp:  4500, price:  4000, tag: null         },
    { name: 'Marie Gold 250g',                    brand: 'Britannia',   unit: '250 g',  mrp:  3000, price:  2700, tag: null         },
  ],
  'Namkeen': [
    { name: 'Haldiram Aloo Bhujia 400g',          brand: 'Haldiram',    unit: '400 g',  mrp: 18000, price: 16000, tag: 'bestseller' },
    { name: 'Haldiram Mixture 400g',              brand: 'Haldiram',    unit: '400 g',  mrp: 16000, price: 14000, tag: null         },
    { name: 'Bikaji Bikaneri Bhujia 200g',        brand: 'Bikaji',      unit: '200 g',  mrp:  9000, price:  8000, tag: 'deal'       },
    { name: 'Bikanervala Moong Dal 200g',         brand: 'Bikanervala', unit: '200 g',  mrp:  8500, price:  7500, tag: null         },
    { name: 'Haldiram Khatta Meetha 400g',        brand: 'Haldiram',    unit: '400 g',  mrp: 16000, price: 14500, tag: null         },
  ],
  'Chocolates': [
    { name: 'Dairy Milk Silk 60g',                brand: 'Cadbury',     unit: '60 g',   mrp:  9900, price:  8900, tag: 'bestseller' },
    { name: 'KitKat 4 Finger 41g',               brand: 'Nestle',      unit: '41 g',   mrp:  5000, price:  4500, tag: null         },
    { name: 'Munch Chocolate 35g',                brand: 'Nestle',      unit: '35 g',   mrp:  2000, price:  2000, tag: 'deal'       },
    { name: 'Dark Fantasy Choco Fills 75g',       brand: 'Sunfeast',    unit: '75 g',   mrp:  5500, price:  5000, tag: null         },
    { name: '5 Star Chocolate 40g',               brand: 'Cadbury',     unit: '40 g',   mrp:  2000, price:  2000, tag: 'new'        },
  ],
  'Dry Fruits': [
    { name: 'Happilo Premium Almonds 200g',       brand: 'Happilo',     unit: '200 g',  mrp: 28000, price: 25000, tag: 'bestseller' },
    { name: 'Tulsi Cashews 200g',                 brand: 'Tulsi',       unit: '200 g',  mrp: 32000, price: 28000, tag: null         },
    { name: 'Nutraj Raisins 250g',                brand: 'Nutraj',      unit: '250 g',  mrp: 12000, price: 10500, tag: 'deal'       },
    { name: 'Happilo Pistachios 200g',            brand: 'Happilo',     unit: '200 g',  mrp: 45000, price: 40000, tag: null         },
    { name: 'Orchard Walnuts 200g',               brand: 'Orchard',     unit: '200 g',  mrp: 35000, price: 31000, tag: 'new'        },
  ],

  // ── Beverages ──────────────────────────────────────────────
  'Cold Drinks': [
    { name: 'Coca Cola 750ml',                    brand: 'Coca Cola',   unit: '750 ml', mrp:  4500, price:  4000, tag: 'deal'       },
    { name: 'Sprite 500ml',                       brand: 'Sprite',      unit: '500 ml', mrp:  3500, price:  3200, tag: null         },
    { name: 'Pepsi 600ml',                        brand: 'Pepsi',       unit: '600 ml', mrp:  4000, price:  3500, tag: null         },
    { name: 'Thums Up 750ml',                     brand: 'Thums Up',    unit: '750 ml', mrp:  4500, price:  4000, tag: 'bestseller' },
    { name: 'Limca 600ml',                        brand: 'Limca',       unit: '600 ml', mrp:  4000, price:  3500, tag: null         },
  ],
  'Juices': [
    { name: 'Real Fruit Juice Mixed Fruit 1L',    brand: 'Real',        unit: '1 L',    mrp: 12000, price: 10500, tag: 'bestseller' },
    { name: 'Tropicana Orange 1L',                brand: 'Tropicana',   unit: '1 L',    mrp: 13500, price: 12000, tag: null         },
    { name: 'Paper Boat Aamras 200ml',            brand: 'Paper Boat',  unit: '200 ml', mrp:  3500, price:  3000, tag: 'new'        },
    { name: 'B Natural Apple Juice 1L',           brand: 'B Natural',   unit: '1 L',    mrp: 12000, price: 10500, tag: 'deal'       },
    { name: 'Raw Pressery Orange 250ml',          brand: 'Raw Pressery',unit: '250 ml', mrp:  7500, price:  6500, tag: null         },
  ],
  'Tea & Coffee': [
    { name: 'Tata Tea Gold 250g',                 brand: 'Tata Tea',    unit: '250 g',  mrp: 16000, price: 14500, tag: 'bestseller' },
    { name: 'Red Label Tea 250g',                 brand: 'Brooke Bond',unit: '250 g',   mrp: 15000, price: 13500, tag: null         },
    { name: 'Nescafe Classic Instant Coffee 50g', brand: 'Nescafe',    unit: '50 g',    mrp: 18000, price: 16000, tag: 'deal'       },
    { name: 'Bru Instant Coffee 50g',             brand: 'Bru',         unit: '50 g',   mrp: 16500, price: 15000, tag: null         },
    { name: 'Wagh Bakri Tea 250g',                brand: 'Wagh Bakri',  unit: '250 g',  mrp: 16000, price: 14000, tag: 'new'        },
  ],
  'Energy Drinks': [
    { name: 'Red Bull Energy Drink 250ml',        brand: 'Red Bull',    unit: '250 ml', mrp: 12500, price: 11500, tag: 'bestseller' },
    { name: 'Monster Energy 500ml',               brand: 'Monster',     unit: '500 ml', mrp: 18000, price: 16500, tag: null         },
    { name: 'Sting Energy Drink 250ml',           brand: 'Sting',       unit: '250 ml', mrp:  5000, price:  4500, tag: 'deal'       },
    { name: 'Cloud 9 Energy Drink 250ml',         brand: 'Cloud 9',     unit: '250 ml', mrp:  5500, price:  5000, tag: null         },
    { name: 'Charged Thums Up 250ml',             brand: 'Thums Up',    unit: '250 ml', mrp:  5000, price:  4500, tag: 'new'        },
  ],
  'Water & Soda': [
    { name: 'Bisleri Water 1L',                   brand: 'Bisleri',     unit: '1 L',    mrp:  2000, price:  2000, tag: 'bestseller' },
    { name: 'Kinley Water 1L',                    brand: 'Kinley',      unit: '1 L',    mrp:  2000, price:  2000, tag: null         },
    { name: 'Evian Natural Water 500ml',          brand: 'Evian',       unit: '500 ml', mrp:  9000, price:  8500, tag: null         },
    { name: 'Schweppes Soda 250ml',               brand: 'Schweppes',   unit: '250 ml', mrp:  3500, price:  3000, tag: 'deal'       },
    { name: 'SodaStream Lemon 400ml',             brand: 'SodaStream',  unit: '400 ml', mrp:  5500, price:  5000, tag: 'new'        },
  ],

  // ── Personal Care ──────────────────────────────────────────
  'Shampoo & Hair Care': [
    { name: 'Head & Shoulders Anti Dandruff 340ml', brand: 'H&S',       unit: '340 ml', mrp: 34900, price: 29900, tag: 'bestseller' },
    { name: 'Dove Intense Repair Shampoo 340ml',    brand: 'Dove',       unit: '340 ml', mrp: 31900, price: 27900, tag: null         },
    { name: 'Pantene Silky Smooth 340ml',           brand: 'Pantene',    unit: '340 ml', mrp: 30000, price: 26000, tag: 'deal'       },
    { name: 'TRESemmé Keratin Smooth 580ml',        brand: 'TRESemmé',   unit: '580 ml', mrp: 52900, price: 45900, tag: null         },
    { name: 'Mamaearth Onion Shampoo 250ml',        brand: 'Mamaearth',  unit: '250 ml', mrp: 29900, price: 27900, tag: 'new'        },
  ],
  'Soap & Bodywash': [
    { name: 'Dove Cream Beauty Bar 100g',         brand: 'Dove',        unit: '100 g',  mrp:  5500, price:  5000, tag: 'bestseller' },
    { name: 'Dettol Original Soap 75g',           brand: 'Dettol',      unit: '75 g',   mrp:  4500, price:  3900, tag: null         },
    { name: 'Lux Soft Glow Soap 100g',            brand: 'Lux',         unit: '100 g',  mrp:  4500, price:  3800, tag: 'deal'       },
    { name: 'Fiama Shower Gel 250ml',             brand: 'Fiama',       unit: '250 ml', mrp: 27500, price: 24900, tag: null         },
    { name: 'Himalaya Neem Face Wash 150ml',      brand: 'Himalaya',    unit: '150 ml', mrp: 17500, price: 15500, tag: 'new'        },
  ],
  'Oral Care': [
    { name: 'Colgate Strong Teeth 200g',          brand: 'Colgate',     unit: '200 g',  mrp:  9500, price:  8500, tag: 'bestseller' },
    { name: 'Pepsodent Germi Check 175g',         brand: 'Pepsodent',   unit: '175 g',  mrp:  8000, price:  7000, tag: null         },
    { name: 'Oral-B Toothbrush Soft',             brand: 'Oral-B',      unit: '1 pc',   mrp:  7900, price:  6900, tag: 'deal'       },
    { name: 'Listerine Cool Mint 250ml',          brand: 'Listerine',   unit: '250 ml', mrp: 24900, price: 21900, tag: null         },
    { name: 'Sensodyne Rapid Relief 70g',         brand: 'Sensodyne',   unit: '70 g',   mrp: 18500, price: 16500, tag: 'new'        },
  ],
  'Skin Care': [
    { name: 'Nivea Body Lotion 400ml',            brand: 'Nivea',       unit: '400 ml', mrp: 36900, price: 31900, tag: 'bestseller' },
    { name: 'Cetaphil Moisturizing Cream 250g',   brand: 'Cetaphil',    unit: '250 g',  mrp: 52900, price: 47900, tag: null         },
    { name: 'Ponds Light Moisturiser 100ml',      brand: "Pond's",      unit: '100 ml', mrp: 18900, price: 16900, tag: 'deal'       },
    { name: 'Mamaearth Vitamin C Cream 50ml',     brand: 'Mamaearth',   unit: '50 ml',  mrp: 39900, price: 34900, tag: 'new'        },
    { name: 'Lakme Sun Expert SPF50 100ml',       brand: 'Lakme',       unit: '100 ml', mrp: 34900, price: 29900, tag: null         },
  ],
  'Feminine Care': [
    { name: 'Whisper Ultra XL 15 Pads',          brand: 'Whisper',     unit: '15 pcs', mrp: 27900, price: 24900, tag: 'bestseller' },
    { name: 'Stayfree Dry Max All Night 7 Pads',  brand: 'Stayfree',    unit: '7 pcs',  mrp: 18900, price: 16900, tag: null         },
    { name: 'Sofy Antibacterial 15 Pads',         brand: 'Sofy',        unit: '15 pcs', mrp: 25900, price: 22900, tag: 'deal'       },
    { name: "Carefree Breathable Liners 30's",    brand: 'Carefree',    unit: '30 pcs', mrp: 15900, price: 13900, tag: null         },
    { name: 'Niine Natural Cotton Pads 6pcs',     brand: 'Niine',       unit: '6 pcs',  mrp: 12900, price: 11900, tag: 'new'        },
  ],

  // ── Household & Cleaning ───────────────────────────────────
  'Detergents': [
    { name: 'Ariel Matic Top Load 2kg',           brand: 'Ariel',       unit: '2 kg',   mrp: 48000, price: 42000, tag: 'bestseller' },
    { name: 'Surf Excel Easy Wash 2kg',           brand: 'Surf Excel',  unit: '2 kg',   mrp: 38000, price: 34000, tag: null         },
    { name: 'Tide Plus 1kg',                      brand: 'Tide',        unit: '1 kg',   mrp: 19000, price: 17000, tag: 'deal'       },
    { name: 'Rin Detergent Powder 2kg',           brand: 'Rin',         unit: '2 kg',   mrp: 24000, price: 22000, tag: null         },
    { name: 'Wheel Active Bar 1kg',               brand: 'Wheel',       unit: '1 kg',   mrp:  8500, price:  7500, tag: null         },
  ],
  'Dishwash': [
    { name: 'Vim Dishwash Bar 300g',              brand: 'Vim',         unit: '300 g',  mrp:  5500, price:  4800, tag: 'bestseller' },
    { name: 'Pril Liquid Dish Wash 500ml',        brand: 'Pril',        unit: '500 ml', mrp: 18500, price: 16500, tag: null         },
    { name: 'Exo Bar 700g',                       brand: 'Exo',         unit: '700 g',  mrp:  8000, price:  7000, tag: 'deal'       },
    { name: 'Dettol Kitchen Dish Gel 500ml',      brand: 'Dettol',      unit: '500 ml', mrp: 19500, price: 17500, tag: null         },
    { name: 'Mama Lemon 500ml',                   brand: 'Mama Lemon',  unit: '500 ml', mrp: 16000, price: 14000, tag: 'new'        },
  ],
  'Toilet Cleaners': [
    { name: 'Harpic Power Plus 500ml',            brand: 'Harpic',      unit: '500 ml', mrp: 18000, price: 16000, tag: 'bestseller' },
    { name: 'Lizol All-in-1 Floor Cleaner 500ml', brand: 'Lizol',       unit: '500 ml', mrp: 17500, price: 15500, tag: null         },
    { name: 'Colin Glass Cleaner 500ml',          brand: 'Colin',       unit: '500 ml', mrp: 17000, price: 15000, tag: 'deal'       },
    { name: 'Dettol Surface Cleaner 500ml',       brand: 'Dettol',      unit: '500 ml', mrp: 18500, price: 16500, tag: null         },
    { name: 'Domex Floor Cleaner 1L',             brand: 'Domex',       unit: '1 L',    mrp: 19500, price: 17500, tag: null         },
  ],
  'Fresheners & Repel': [
    { name: 'Odonil Bathroom Air Freshener 48g',  brand: 'Odonil',      unit: '48 g',   mrp:  9500, price:  8500, tag: 'bestseller' },
    { name: 'Good Knight Mosquito Liquid 45ml',   brand: 'Good Knight', unit: '45 ml',  mrp: 14500, price: 13000, tag: null         },
    { name: 'Mortein Crawling Insect Spray 425ml',brand: 'Mortein',     unit: '425 ml', mrp: 28500, price: 25500, tag: 'deal'       },
    { name: 'Ambi Pur Car Freshener 7.5ml',       brand: 'Ambi Pur',    unit: '7.5 ml', mrp: 29900, price: 26900, tag: null         },
    { name: 'Odomos Mosquito Repellent Cream 50g',brand: 'Odomos',      unit: '50 g',   mrp:  9500, price:  8500, tag: 'new'        },
  ],

  // ── Instant & Frozen Food ──────────────────────────────────
  'Noodles & Pasta': [
    { name: 'Maggi Masala Noodles 70g',           brand: 'Maggi',       unit: '70 g',   mrp:  1500, price:  1400, tag: 'bestseller' },
    { name: 'Top Ramen Curry Noodles 70g',        brand: 'Nissin',      unit: '70 g',   mrp:  1500, price:  1400, tag: null         },
    { name: 'Sunfeast YiPPee Magic Masala 60g',   brand: 'Sunfeast',    unit: '60 g',   mrp:  1500, price:  1400, tag: 'deal'       },
    { name: 'Borges Penne Pasta 500g',            brand: 'Borges',      unit: '500 g',  mrp: 22000, price: 19000, tag: null         },
    { name: 'Knorr Classic Pasta 70g',            brand: 'Knorr',       unit: '70 g',   mrp:  5500, price:  4800, tag: 'new'        },
  ],
  'Ready to Eat': [
    { name: 'MTR Dal Makhani 300g',               brand: 'MTR',         unit: '300 g',  mrp: 19500, price: 17500, tag: 'bestseller' },
    { name: 'Haldiram Pav Bhaji 300g',            brand: 'Haldiram',    unit: '300 g',  mrp: 18000, price: 16000, tag: null         },
    { name: 'Gits Paneer Makhani 300g',           brand: 'Gits',        unit: '300 g',  mrp: 20000, price: 18000, tag: 'deal'       },
    { name: 'ITC Kitchens of India Butter Chicken 285g', brand: 'ITC', unit: '285 g',   mrp: 24500, price: 22000, tag: null         },
    { name: 'MTR Chana Masala 300g',              brand: 'MTR',         unit: '300 g',  mrp: 19000, price: 17000, tag: 'new'        },
  ],
  'Frozen Snacks': [
    { name: "McCain Smiles Potato Snacks 415g",   brand: 'McCain',      unit: '415 g',  mrp: 28500, price: 25500, tag: 'bestseller' },
    { name: 'ITC Master Chef Veg Patties 400g',   brand: 'ITC',         unit: '400 g',  mrp: 25000, price: 22000, tag: null         },
    { name: 'Amul Pizza Base 2pcs',               brand: 'Amul',        unit: '2 pcs',  mrp: 12000, price: 10500, tag: 'deal'       },
    { name: 'Sumeru Corn Seekh Kebab 360g',       brand: 'Sumeru',      unit: '360 g',  mrp: 28000, price: 25000, tag: null         },
    { name: 'Godrej Yummiez Crispy Veg 400g',     brand: 'Godrej',      unit: '400 g',  mrp: 24000, price: 21500, tag: 'new'        },
  ],
  'Soups': [
    { name: "Knorr Classic Tomato Soup 43g",      brand: 'Knorr',       unit: '43 g',   mrp:  5500, price:  4800, tag: 'bestseller' },
    { name: 'Maggi Rich Tomato Soup 65g',         brand: 'Maggi',       unit: '65 g',   mrp:  5500, price:  4800, tag: null         },
    { name: "Knorr Creamy Chicken Soup 43g",      brand: 'Knorr',       unit: '43 g',   mrp:  6000, price:  5500, tag: 'deal'       },
    { name: "Ching's Secret Sweet Corn Soup 55g", brand: "Ching's",     unit: '55 g',   mrp:  5500, price:  4900, tag: null         },
    { name: 'Dr. McDougall Lentil Soup 46g',      brand: 'Dr. McDougall',unit: '46 g',  mrp: 12000, price: 10500, tag: 'new'        },
  ],

  // ── Masala & Spices ────────────────────────────────────────
  'Whole Spices': [
    { name: 'Tata Sampann Cumin Seeds 100g',      brand: 'Tata',        unit: '100 g',  mrp:  9500, price:  8500, tag: 'bestseller' },
    { name: 'Everest Cardamom 50g',               brand: 'Everest',     unit: '50 g',   mrp: 15000, price: 13500, tag: null         },
    { name: 'MDH Black Pepper 100g',              brand: 'MDH',         unit: '100 g',  mrp: 14000, price: 12500, tag: 'deal'       },
    { name: 'Patanjali Bay Leaves 50g',           brand: 'Patanjali',   unit: '50 g',   mrp:  4000, price:  3500, tag: null         },
    { name: 'ITC Spices Cloves 50g',              brand: 'ITC',         unit: '50 g',   mrp: 18000, price: 16000, tag: 'new'        },
  ],
  'Blended Masala': [
    { name: 'MDH Chhole Masala 100g',             brand: 'MDH',         unit: '100 g',  mrp:  9500, price:  8500, tag: 'bestseller' },
    { name: 'Everest Kitchen King 100g',          brand: 'Everest',     unit: '100 g',  mrp: 10000, price:  9000, tag: null         },
    { name: 'Catch Garam Masala 100g',            brand: 'Catch',       unit: '100 g',  mrp:  9000, price:  8000, tag: 'deal'       },
    { name: 'Patanjali Red Chilli Powder 200g',   brand: 'Patanjali',   unit: '200 g',  mrp:  9500, price:  8500, tag: null         },
    { name: 'Tata Sampann Turmeric 200g',         brand: 'Tata',        unit: '200 g',  mrp:  7500, price:  6500, tag: 'new'        },
  ],
  'Salt & Sugar': [
    { name: 'Tata Salt 1kg',                      brand: 'Tata',        unit: '1 kg',   mrp:  2800, price:  2500, tag: 'bestseller' },
    { name: 'Aashirvaad Salt 1kg',                brand: 'Aashirvaad',  unit: '1 kg',   mrp:  2900, price:  2600, tag: null         },
    { name: 'Dhampure Natural Sugar 1kg',         brand: 'Dhampure',    unit: '1 kg',   mrp:  5500, price:  5000, tag: 'deal'       },
    { name: 'Uttam Sugar 1kg',                    brand: 'Uttam',       unit: '1 kg',   mrp:  4800, price:  4500, tag: null         },
    { name: 'Catch Black Salt 100g',              brand: 'Catch',       unit: '100 g',  mrp:  2500, price:  2200, tag: null         },
  ],
  'Condiments': [
    { name: 'Kissan Sweet & Spicy Ketchup 500g',  brand: 'Kissan',      unit: '500 g',  mrp: 14000, price: 12500, tag: 'bestseller' },
    { name: "Maggi Hot & Sweet Sauce 500g",       brand: 'Maggi',       unit: '500 g',  mrp: 13500, price: 12000, tag: null         },
    { name: 'American Garden Mustard 227g',       brand: 'Ameri Garden',unit: '227 g',  mrp: 17500, price: 15500, tag: 'deal'       },
    { name: 'Del Monte Mayonnaise 275g',          brand: 'Del Monte',   unit: '275 g',  mrp: 22000, price: 19500, tag: null         },
    { name: 'Druk Honey 500g',                    brand: 'Druk',        unit: '500 g',  mrp: 28000, price: 25000, tag: 'new'        },
  ],

  // ── Baby Care ──────────────────────────────────────────────
  'Baby Food': [
    { name: 'Nestle Cerelac Wheat 300g',          brand: 'Nestle',      unit: '300 g',  mrp: 24900, price: 22900, tag: 'bestseller' },
    { name: 'Farex Rice Cereal 300g',             brand: 'Farex',       unit: '300 g',  mrp: 22000, price: 20000, tag: null         },
    { name: 'Heinz Baby Biscuits 180g',           brand: 'Heinz',       unit: '180 g',  mrp: 28000, price: 25500, tag: 'deal'       },
    { name: 'Mamy Poko Baby Food 200g',           brand: 'Mamy Poko',   unit: '200 g',  mrp: 19500, price: 17500, tag: null         },
    { name: 'Aashirvaad Baby Cereal 300g',        brand: 'Aashirvaad',  unit: '300 g',  mrp: 23500, price: 21000, tag: 'new'        },
  ],
  'Diapers & Wipes': [
    { name: 'Pampers Active Baby S 20 Pcs',       brand: 'Pampers',     unit: '20 pcs', mrp: 49900, price: 44900, tag: 'bestseller' },
    { name: 'Huggies Wonder Pants M 24 Pcs',      brand: 'Huggies',     unit: '24 pcs', mrp: 55000, price: 49000, tag: null         },
    { name: 'Mamy Poko Pants XL 36 Pcs',          brand: 'Mamy Poko',   unit: '36 pcs', mrp: 74900, price: 67900, tag: 'deal'       },
    { name: 'WaterWipes Baby Wipes 60 Pcs',       brand: 'WaterWipes',  unit: '60 pcs', mrp: 32900, price: 29900, tag: null         },
    { name: 'Pampers Fresh Clean Wipes 72 Pcs',   brand: 'Pampers',     unit: '72 pcs', mrp: 29900, price: 26900, tag: 'new'        },
  ],
  'Baby Skin Care': [
    { name: 'Johnson\'s Baby Lotion 200ml',       brand: "Johnson's",   unit: '200 ml', mrp: 21500, price: 19500, tag: 'bestseller' },
    { name: 'Himalaya Baby Cream 50ml',           brand: 'Himalaya',    unit: '50 ml',  mrp:  9900, price:  8900, tag: null         },
    { name: 'Sebamed Baby Wash 200ml',            brand: 'Sebamed',     unit: '200 ml', mrp: 39900, price: 35900, tag: 'deal'       },
    { name: 'Mamaearth Gentle Cleansing Shampoo 400ml', brand:'Mamaearth',unit:'400 ml',mrp: 34900, price: 31900, tag: null         },
    { name: 'Chicco Baby Shampoo 200ml',          brand: 'Chicco',      unit: '200 ml', mrp: 27500, price: 24900, tag: 'new'        },
  ],

  // ── Bakery & Breads ────────────────────────────────────────
  'Breads & Buns': [
    { name: 'Britannia 100% Whole Wheat Bread',   brand: 'Britannia',   unit: '400 g',  mrp:  5500, price:  5000, tag: 'bestseller' },
    { name: 'Harvest Gold Bread',                 brand: 'Harvest Gold',unit: '400 g',  mrp:  5500, price:  5000, tag: null         },
    { name: 'Modern Bread White 400g',            brand: 'Modern',      unit: '400 g',  mrp:  4500, price:  4000, tag: 'deal'       },
    { name: 'Bonn Multigrain Bread 600g',         brand: 'Bonn',        unit: '600 g',  mrp:  7500, price:  6800, tag: null         },
    { name: 'English Oven Burger Buns 6pcs',      brand: 'English Oven',unit: '6 pcs',  mrp:  6500, price:  5800, tag: 'new'        },
  ],
  'Cakes & Muffins': [
    { name: 'Britannia Fruit Cake 250g',          brand: 'Britannia',   unit: '250 g',  mrp:  8500, price:  7500, tag: 'bestseller' },
    { name: 'Monginis Chocolate Cake 500g',       brand: 'Monginis',    unit: '500 g',  mrp: 35000, price: 31000, tag: null         },
    { name: 'Pillsbury Choco Lava Cake Mix 150g', brand: 'Pillsbury',   unit: '150 g',  mrp: 14500, price: 12900, tag: 'deal'       },
    { name: 'Wingreens Farms Blueberry Muffin 4pcs',brand:'Wingreens',  unit: '4 pcs',  mrp: 18500, price: 16500, tag: null         },
    { name: 'CakeZone Chocolate Truffle 500g',    brand: 'CakeZone',    unit: '500 g',  mrp: 49900, price: 44900, tag: 'new'        },
  ],
  'Rusk & Toast': [
    { name: 'Britannia Toast Plain 385g',         brand: 'Britannia',   unit: '385 g',  mrp:  7500, price:  6800, tag: 'bestseller' },
    { name: 'Parle Rusk 300g',                    brand: 'Parle',       unit: '300 g',  mrp:  6500, price:  5800, tag: null         },
    { name: 'Unibic Toast 200g',                  brand: 'Unibic',      unit: '200 g',  mrp:  7000, price:  6200, tag: 'deal'       },
    { name: 'Olympic Jeera Rusk 300g',            brand: 'Olympic',     unit: '300 g',  mrp:  6000, price:  5500, tag: null         },
    { name: 'Bisk Farm Zeera Rusk 200g',          brand: 'Bisk Farm',   unit: '200 g',  mrp:  5500, price:  4800, tag: 'new'        },
  ],

  // ── Oils & Ghee ────────────────────────────────────────────
  'Cooking Oils': [
    { name: 'Fortune Sunlite Refined Oil 1L',     brand: 'Fortune',     unit: '1 L',    mrp: 18000, price: 16500, tag: 'bestseller' },
    { name: 'Saffola Gold Blended Oil 1L',        brand: 'Saffola',     unit: '1 L',    mrp: 23500, price: 21000, tag: null         },
    { name: 'Patanjali Mustard Oil 1L',           brand: 'Patanjali',   unit: '1 L',    mrp: 18500, price: 17000, tag: 'deal'       },
    { name: 'Dhara Refined Groundnut Oil 1L',     brand: 'Dhara',       unit: '1 L',    mrp: 21000, price: 19000, tag: null         },
    { name: 'Figaro Olive Oil 500ml',             brand: 'Figaro',      unit: '500 ml', mrp: 54900, price: 49900, tag: 'new'        },
  ],
  'Ghee': [
    { name: 'Amul Pure Ghee 500ml',               brand: 'Amul',        unit: '500 ml', mrp: 32500, price: 30000, tag: 'bestseller' },
    { name: 'Patanjali Cow Ghee 1kg',             brand: 'Patanjali',   unit: '1 kg',   mrp: 58000, price: 53000, tag: null         },
    { name: 'Mother Dairy Ghee 500ml',            brand: 'Mother Dairy',unit: '500 ml', mrp: 33500, price: 30500, tag: 'deal'       },
    { name: 'Gowardhan Ghee 1kg',                 brand: 'Gowardhan',   unit: '1 kg',   mrp: 66000, price: 60000, tag: null         },
    { name: 'Ananda Desi Ghee 500ml',             brand: 'Ananda',      unit: '500 ml', mrp: 34500, price: 31500, tag: 'new'        },
  ],
  'Mustard Oil': [
    { name: 'Patanjali Kachi Ghani Mustard Oil 1L', brand: 'Patanjali', unit: '1 L',    mrp: 19500, price: 18000, tag: 'bestseller' },
    { name: 'Dhara Mustard Oil 1L',               brand: 'Dhara',       unit: '1 L',    mrp: 18500, price: 17000, tag: null         },
    { name: 'Emami Healthy & Tasty Mustard 1L',   brand: 'Emami',       unit: '1 L',    mrp: 20500, price: 19000, tag: 'deal'       },
    { name: 'Sapat Mustard Oil 1L',               brand: 'Sapat',       unit: '1 L',    mrp: 17500, price: 16500, tag: null         },
    { name: 'Fortune Kachi Ghani 1L',             brand: 'Fortune',     unit: '1 L',    mrp: 19000, price: 17500, tag: 'new'        },
  ],
};

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('✅ DB connected\n');
    await sequelize.sync({ alter: { drop: false } });

    // Build sub-category name → id map
    const allCats = await Category.findAll();
    const subMap  = Object.fromEntries(
      allCats.filter(c => c.parentId).map(c => [c.name, c.id])
    );

    let added = 0, skipped = 0;
    for (const [subName, products] of Object.entries(PRODUCTS)) {
      const categoryId = subMap[subName];
      if (!categoryId) { console.log(`⚠  Sub-cat not found: "${subName}"`); continue; }
      for (const p of products) {
        const [, created] = await Product.findOrCreate({
          where: { name: p.name, category_id: categoryId },
          defaults: { ...p, categoryId, isActive: true },
        });
        created ? added++ : skipped++;
      }
      console.log(`✓ ${subName} (${products.length} products)`);
    }

    console.log(`\n🎉 Done! Added: ${added}  |  Already existed: ${skipped}`);
    process.exit(0);
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }
}

seed();
