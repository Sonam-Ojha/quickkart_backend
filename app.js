const express = require('express');
const cors = require('cors');

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

const app = express();

const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());

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

module.exports = app;
