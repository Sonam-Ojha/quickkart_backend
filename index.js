// Load .env only in local dev; production uses hosting panel env vars
try { require('dotenv').config(); } catch (_) {}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('[FATAL] JWT_SECRET env var is missing or too short (min 32 chars). Set it and restart.');
  process.exit(1);
}

process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err.message, err.stack);
  // Don't exit — let the process keep running so live traffic isn't dropped
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason);
});

// The DB host resolves to both IPv6 and IPv4, and the IPv4 route is currently
// blackholed. Node's happy-eyeballs races them 250ms apart by default, which
// often lets the dead IPv4 attempt win the race and fail with ETIMEDOUT.
// Give the working IPv6 address time to connect first.
require('net').setDefaultAutoSelectFamilyAttemptTimeout(2000);
const app = require('./app');
const sequelize = require('./src/config/db');

// ── Core models (no FK deps) ─────────────────────────────
require('./src/models/otp.model');
require('./src/models/account-deletion.model');
require('./src/models/user.model');
require('./src/models/country.model');
require('./src/models/state.model');
require('./src/models/city.model');
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
require('./src/models/product-store-visibility.model'); // → products, dark_stores
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
require('./src/models/print-order.model');           // → users
require('./src/models/admin-notification.model');    // standalone

const PORT = process.env.PORT || 4000;

function startServer() {
  const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  require('./src/services/realtime.service').init(server);
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} already in use. Run: kill $(lsof -ti:${PORT})`);
      process.exit(1);
    } else throw err;
  });
}

// In production: verify the connection, then only *add* missing tables/columns
// (ensureSchema) so a deploy with a new model field doesn't 500 on
// "Unknown column". In dev: sync with alter so schema changes apply fully.
// sync({ alter }) opens 50-100+ connections across all tables — this was
// exhausting Hostinger's 500-connections/hour limit on every restart.
const isProd = process.env.NODE_ENV === 'production';

const dbInit = isProd
  ? sequelize.authenticate().then(() => require('./src/config/ensure-schema')())
  : sequelize.sync({ alter: { drop: false } });

// Auto-reopen service when reopens_at time is reached
function startReopenWatcher() {
  setInterval(async () => {
    try {
      const Setting = require('./src/models/setting.model');
      const [enabledRow, reopenRow] = await Promise.all([
        Setting.findOne({ where: { key: 'service_enabled' } }),
        Setting.findOne({ where: { key: 'reopens_at' } }),
      ]);
      const isDisabled = enabledRow?.value === 'false';
      const reopensAt  = reopenRow?.value;
      if (!isDisabled || !reopensAt) return;
      if (new Date() >= new Date(reopensAt)) {
        await Promise.all([
          Setting.upsert({ key: 'service_enabled', value: 'true' }),
          Setting.upsert({ key: 'reopens_at', value: '' }),
        ]);
        console.log('[SERVICE] Auto-reopened at', new Date().toISOString());
        // Notify all users with FCM tokens
        try {
          const { Op } = require('sequelize');
          const User = require('./src/models/user.model');
          const { sendToUsers } = require('./src/services/notification.service');
          const users = await User.findAll({ where: { fcm_token: { [Op.ne]: null } }, attributes: ['id'] });
          if (users.length) await sendToUsers(users.map(u => u.id), { title: "We're back! 🎉", body: 'Jhatpats is open again. Order your groceries now!' });
        } catch (e) { console.error('[SERVICE] notify error:', e.message); }
      }
    } catch (e) {
      console.error('[SERVICE] reopen watcher error:', e.message);
    }
  }, 60 * 1000); // check every minute
}

dbInit
  .then(() => {
    console.log(isProd ? 'Database connected' : 'Database connected and synced');
    require('./src/services/rider-dispatch.service').startSweeper();
    startReopenWatcher();
    startServer();
  })
  .catch((err) => {
    console.error('⚠️  DB connection failed:', err.message);
    console.error('Starting server WITHOUT DB — only OTP/in-memory routes will work');
    startServer();
  });
