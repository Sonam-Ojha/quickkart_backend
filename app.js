const express = require('express');
const cors    = require('cors');
const path    = require('path');
const multer  = require('multer');

// ── Admin Panel Routes (used by react-app admin panel) ────
const adminAuthRoutes    = require('./src/routes/admin/auth.routes');
const adminProfileRoutes = require('./src/routes/admin/profile.routes');
const adminAddressRoutes = require('./src/routes/admin/address.routes');
const adminUsersRoutes   = require('./src/routes/admin/users.routes');
const adminCatalogRoutes    = require('./src/routes/admin/catalog.routes');
const adminDarkStoreRoutes  = require('./src/routes/admin/darkstore.routes');
const adminInventoryRoutes  = require('./src/routes/admin/inventory.routes');
const adminRiderRoutes      = require('./src/routes/admin/rider.routes');
const adminCustomerRoutes   = require('./src/routes/admin/customer.routes');
const adminBannerRoutes     = require('./src/routes/admin/banner.routes');
const adminCouponRoutes     = require('./src/routes/admin/coupon.routes');
const adminReferralRoutes   = require('./src/routes/admin/referral.routes');
const adminOrderRoutes      = require('./src/routes/admin/order.routes');
const adminPaymentRoutes    = require('./src/routes/admin/payment.routes');
const adminWalletRoutes     = require('./src/routes/admin/wallet.routes');
const adminSupportRoutes    = require('./src/routes/admin/support.routes');
const adminDashboardRoutes  = require('./src/routes/admin/dashboard.routes');
const adminFaqRoutes        = require('./src/routes/admin/faq.routes');
const adminSettingsRoutes   = require('./src/routes/admin/settings.routes');
const adminUploadRoutes     = require('./src/routes/admin/upload.routes');
const adminRiderOpsRoutes   = require('./src/routes/admin/rider-ops.routes');

// ── Rider App Routes (used by quickkart_rider mobile/web app) ─
const riderAuthRoutes        = require('./src/routes/rider/auth.routes');
const riderProfileRoutes     = require('./src/routes/rider/profile.routes');
const riderOrderRoutes       = require('./src/routes/rider/orders.routes');
const riderEarningsRoutes    = require('./src/routes/rider/earnings.routes');
const riderPayoutRoutes      = require('./src/routes/rider/payouts.routes');
const riderPerformanceRoutes = require('./src/routes/rider/performance.routes');
const riderNotificationRoutes= require('./src/routes/rider/notifications.routes');
const riderSupportRoutes     = require('./src/routes/rider/support.routes');
const riderDocumentRoutes    = require('./src/routes/rider/documents.routes');

// ── Customer App Routes (used by quickkart_customer web app) ─
const appAuthRoutes       = require('./src/routes/app/auth.routes');
const appHomeRoutes       = require('./src/routes/app/home.routes');
const appProductRoutes    = require('./src/routes/app/products.routes');
const appCategoryRoutes   = require('./src/routes/app/categories.routes');
const appOrderRoutes      = require('./src/routes/app/orders.routes');
const appAddressRoutes    = require('./src/routes/app/address.routes');
const appWalletRoutes     = require('./src/routes/app/wallet.routes');
const appCouponRoutes     = require('./src/routes/app/coupons.routes');
const appProfileRoutes    = require('./src/routes/app/profile.routes');
const appFaqRoutes        = require('./src/routes/app/faq.routes');
const appSettingsRoutes   = require('./src/routes/app/settings.routes');
const appBannerRoutes     = require('./src/routes/app/banners.routes');
const appWishlistRoutes   = require('./src/routes/app/wishlist.routes');
const appCartRoutes       = require('./src/routes/app/cart.routes');
const appMembershipRoutes = require('./src/routes/app/membership.routes');
const appLocationRoutes   = require('./src/routes/app/location.routes');
const appOtpRoutes        = require('./src/routes/app/otp.routes');

const app = express();

// Any dev origin on this machine or the network it is on, on any port:
// localhost / 127.x / ::1, RFC1918 LANs (192.168.x, 10.x, 172.16-31.x),
// 192.0.0.x (iPhone USB/hotspot tethering) and 100.64-127.x (carrier CGNAT).
const DEV_ORIGIN = /^https?:\/\/(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[::1\]|192\.168\.\d{1,3}\.\d{1,3}|192\.0\.0\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    // and any dev origin on this machine or the LAN (any port)
    if (!origin || DEV_ORIGIN.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());

// Serve uploaded images as static files
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// ── Admin Panel API (/api/admin/...) ──────────────────────
app.use('/api/admin/auth',      adminAuthRoutes);
app.use('/api/admin/profile',   adminProfileRoutes);
app.use('/api/admin/addresses', adminAddressRoutes);
app.use('/api/admin/users',     adminUsersRoutes);
app.use('/api/admin/catalog',     adminCatalogRoutes);
app.use('/api/admin/dark-stores', adminDarkStoreRoutes);
app.use('/api/admin/inventory',   adminInventoryRoutes);
app.use('/api/admin/riders',      adminRiderRoutes);
app.use('/api/admin/customers',   adminCustomerRoutes);
app.use('/api/admin/banners',     adminBannerRoutes);
app.use('/api/admin/coupons',     adminCouponRoutes);
app.use('/api/admin/referrals',   adminReferralRoutes);
app.use('/api/admin/orders',      adminOrderRoutes);
app.use('/api/admin/payments',    adminPaymentRoutes);
app.use('/api/admin/wallet',      adminWalletRoutes);
app.use('/api/admin/support',     adminSupportRoutes);
app.use('/api/admin/dashboard',   adminDashboardRoutes);
app.use('/api/admin/faqs',        adminFaqRoutes);
app.use('/api/admin/settings',    adminSettingsRoutes);
app.use('/api/admin/upload',      adminUploadRoutes);
app.use('/api/admin/rider-ops',   adminRiderOpsRoutes);

// ── Customer App API (/api/app/...) ──────────────────────
app.use('/api/app/auth',       appAuthRoutes);
app.use('/api/app/home',       appHomeRoutes);
app.use('/api/app/products',   appProductRoutes);
app.use('/api/app/categories', appCategoryRoutes);
app.use('/api/app/orders',     appOrderRoutes);
app.use('/api/app/addresses',  appAddressRoutes);
app.use('/api/app/wallet',     appWalletRoutes);
app.use('/api/app/coupons',    appCouponRoutes);
app.use('/api/app/profile',    appProfileRoutes);
app.use('/api/app/faqs',       appFaqRoutes);
app.use('/api/app/settings',   appSettingsRoutes);
app.use('/api/app/banners',    appBannerRoutes);
app.use('/api/app/wishlist',   appWishlistRoutes);
app.use('/api/app/cart',       appCartRoutes);
app.use('/api/app/membership', appMembershipRoutes);
app.use('/api/app/location',  appLocationRoutes);
app.use('/api/app/otp',       appOtpRoutes);
app.use('/api/app/payments',  require('./src/routes/app/payment.routes'));

// ── Rider App API (/api/rider/...) ────────────────────────
app.use('/api/rider/auth',          riderAuthRoutes);
app.use('/api/rider/profile',       riderProfileRoutes);
app.use('/api/rider/orders',        riderOrderRoutes);
app.use('/api/rider/earnings',      riderEarningsRoutes);
app.use('/api/rider/payouts',       riderPayoutRoutes);
app.use('/api/rider/performance',   riderPerformanceRoutes);
app.use('/api/rider/notifications', riderNotificationRoutes);
app.use('/api/rider/support',       riderSupportRoutes);
app.use('/api/rider/documents',     riderDocumentRoutes);

// Unmatched /api/* paths fall through to Express's HTML 404, which clients
// can't parse. Answer in JSON like every other route.
app.use('/api', (req, res) => {
  res.status(404).json({ message: `Cannot ${req.method} ${req.baseUrl}${req.path}` });
});

// ── Error handler ─────────────────────────────────────────
// Without this, a rejected upload (multer fileFilter / size limit) falls
// through to Express's default handler, which answers with an HTML stack
// trace that leaks server paths. Clients here always expect JSON.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (res.headersSent) return;
  const isUploadError = err instanceof multer.MulterError || /files? are allowed/i.test(err.message || '');
  const status = err.status || (isUploadError ? 400 : 500);
  if (status >= 500) console.error('[UNHANDLED]', err.message);
  res.status(status).json({
    message: status >= 500 ? 'Internal server error' : err.message,
  });
});

module.exports = app;
