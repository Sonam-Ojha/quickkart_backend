const { Op } = require('sequelize');
const Inventory = require('../models/inventory.model');
const DarkStore = require('../models/darkstore.model');
const { findNearestStore } = require('./darkstore.service');

const ProductStoreVisibility = require('../models/product-store-visibility.model');

// What the customer app should show for a given location.
//
//   - Location inside a store's radius → the whole catalogue, minus products the
//     admin switched OFF for that store (Products → Store Visibility)
//   - Location outside every radius    → the full catalogue, marked unavailable
//   - No location yet                  → the full catalogue, marked unavailable
//
// Returns { storeId, hasLocation, serviceable } — serviceable is null when the
// customer hasn't set a location yet (unknown, not "no").
async function resolveStorefront(lat, lng) {
  const hasLocation = lat != null && lat !== '' && lng != null && lng !== '';
  if (!hasLocation) return { storeId: null, hasLocation: false, serviceable: null };
  const { store } = await findNearestStore(lat, lng);
  return { storeId: store?.id ?? null, hasLocation: true, serviceable: Boolean(store) };
}

// Per-store catalogue rules:
//   hidden — product ids switched OFF for this store (visibility defaults to ON)
//   stock  — productId → stockQty for products whose stock the store tracks in
//            Inventory. Untracked products are always orderable.
async function storeCatalog(storeId) {
  if (!storeId) return { storeId: null, hidden: [], stock: {} };
  const [off, inv] = await Promise.all([
    ProductStoreVisibility.findAll({ where: { storeId, isEnabled: false }, attributes: ['productId'] }),
    Inventory.findAll({ where: { storeId }, attributes: ['productId', 'stockQty'] }),
  ]);
  const stock = {};
  for (const r of inv) stock[r.productId] = r.stockQty;
  return { storeId, hidden: off.map(r => r.productId), stock };
}

// Drops the store's switched-off products from a Product `where` clause.
function scopeToStore(where, catalog) {
  if (!catalog.storeId || !catalog.hidden.length) return where;
  return { ...where, id: { [Op.notIn]: catalog.hidden } };
}

const formatProduct = (p, catalog) => {
  const available = Boolean(catalog.storeId);
  const tracked   = p.id in catalog.stock;
  const qty       = tracked ? catalog.stock[p.id] : null;
  return {
    id:            p.id,
    name:          p.name,
    weight:        p.unit     ?? '',
    price:         Math.round(p.price / 100),
    originalPrice: Math.round(p.mrp   / 100),
    img:           p.imageUrl ?? '',
    badge:         p.tag      ?? null,
    category:      p.category?.name ?? '',
    available,
    inStock:       available && p.isActive && (!tracked || qty > 0),
    stock:         qty,
  };
};

// Store an order is fulfilled from, picked by the delivery coordinates the
// customer confirmed at checkout. Older app builds don't send coordinates, so
// those keep the previous "first active store" behaviour.
// Returns { store, located } — store is null when located and nothing covers it.
async function storeForDelivery(lat, lng) {
  const hasLocation = lat != null && lat !== '' && lng != null && lng !== '';
  if (!hasLocation) {
    return { store: await DarkStore.findOne({ where: { is_active: true } }), located: false };
  }
  const { store } = await findNearestStore(lat, lng);
  return { store, located: true };
}

const NOT_SERVICEABLE = 'Delivery is not available at this address yet. Please choose a different address.';

module.exports = { resolveStorefront, storeCatalog, scopeToStore, formatProduct, storeForDelivery, NOT_SERVICEABLE };
