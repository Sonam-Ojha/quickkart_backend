// Load .env only in local dev; production uses hosting panel env vars
try { require('dotenv').config(); } catch (_) {}

// The DB host resolves to both IPv6 and IPv4, and the IPv4 route is currently
// blackholed. Node's happy-eyeballs races them 250ms apart by default, which
// often lets the dead IPv4 attempt win the race and fail with ETIMEDOUT.
// Give the working IPv6 address time to connect first.
require('net').setDefaultAutoSelectFamilyAttemptTimeout(2000);
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
require('./src/models/wishlist.model');         // → products, users
require('./src/models/cart-item.model');        // → users
require('./src/models/info-page.model');
require('./src/models/membership.model');       // → users

// ── Rider app models ─────────────────────────────────────
require('./src/models/rider-document.model');     // → riders
require('./src/models/rider-duty-session.model'); // → riders
require('./src/models/rider-notification.model'); // → riders
require('./src/models/rider-payout.model');       // → riders
require('./src/models/rider-order-offer.model');  // → riders, orders
require('./src/models/rider-earning.model');      // → riders, orders
require('./src/models/rider-support-message.model'); // → riders

const PORT = process.env.PORT || 4000;

function startServer() {
  const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} already in use. Run: kill $(lsof -ti:${PORT})`);
      process.exit(1);
    } else throw err;
  });
}

sequelize
  .sync({ alter: { drop: false } })
  .then(() => {
    console.log('Database connected and synced');
    require('./src/services/rider-dispatch.service').startSweeper();
    startServer();
  })
  .catch((err) => {
    console.error('⚠️  DB connection failed:', err.message);
    console.error('Starting server WITHOUT DB — only OTP/in-memory routes will work');
    startServer();
  });
