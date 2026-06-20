require('./src/config/env');
const app = require('./app');
const sequelize = require('./src/config/db');

// ── Core models (no FK deps) ─────────────────────────────
require('./src/models/user.model');
require('./src/models/darkstore.model');
require('./src/models/category.model');
require('./src/models/coupon.model');
require('./src/models/banner.model');
require('./src/models/notification.model');

// ── Models with single FK deps ───────────────────────────
require('./src/models/address.model');          // → users
require('./src/models/rider.model');            // → dark_stores
require('./src/models/product.model');          // → categories
require('./src/models/referral.model');         // → users

// ── Models with multiple FK deps ────────────────────────
require('./src/models/inventory.model');        // → products, dark_stores
require('./src/models/order.model');            // → users, dark_stores, riders, addresses, coupons
require('./src/models/order-item.model');       // → orders, products
require('./src/models/order-timeline.model');   // → orders
require('./src/models/coupon-usage.model');     // → coupons, users, orders
require('./src/models/payment.model');          // → orders
require('./src/models/wallet-transaction.model'); // → users
require('./src/models/support-ticket.model');   // → users, orders
require('./src/models/support-message.model');  // → support_tickets

const PORT = process.env.PORT || 4000;

sequelize
  .sync({ alter: { drop: false } })
  .then(() => {
    console.log('Database connected and synced');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  });
