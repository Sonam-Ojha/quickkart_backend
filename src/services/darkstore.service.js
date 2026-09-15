const { Op } = require('sequelize');
const DarkStore = require('../models/darkstore.model');
const Rider     = require('../models/rider.model');
const Inventory = require('../models/inventory.model');
const City      = require('../models/city.model');
const State     = require('../models/state.model');
const Country   = require('../models/country.model');

const GEO_INCLUDE = [{
  model: City, as: 'cityMaster', attributes: ['id', 'name'],
  include: [{ model: State, as: 'state', attributes: ['id', 'name', 'code'],
    include: [{ model: Country, as: 'country', attributes: ['id', 'name'] }] }],
}];

// Haversine formula — returns distance in km between two lat/lng points
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getAll = async () => {
  return DarkStore.findAll({ include: GEO_INCLUDE, order: [['id', 'ASC']] });
};

const getById = async (id) => {
  const store = await DarkStore.findByPk(id, { include: GEO_INCLUDE });
  if (!store) throw new Error('Store not found');
  return store;
};

const getStats = async (id) => {
  const [riderCount, skuCount] = await Promise.all([
    Rider.count({ where: { storeId: id, status: 'active' } }),
    Inventory.count({ where: { storeId: id } }),
  ]);
  return { activeRiders: riderCount, totalSKUs: skuCount };
};

// Find the nearest active store that covers the given coordinates.
// Returns the store object or null if none covers this location.
const findNearestStore = async (lat, lng) => {
  if (!lat || !lng) {
    // Fallback: first active store
    return DarkStore.findOne({ where: { isActive: true } });
  }
  const stores = await DarkStore.findAll({ where: { isActive: true } });
  let nearest = null;
  let minDist = Infinity;
  for (const store of stores) {
    if (!store.lat || !store.lng) continue;
    const dist = haversineKm(Number(lat), Number(lng), Number(store.lat), Number(store.lng));
    if (dist <= Number(store.radius) && dist < minDist) {
      minDist = dist;
      nearest = store;
    }
  }
  return nearest;
};

const create = async ({ name, address, cityId, city, lat, lng, radius, isActive }) => {
  return DarkStore.create({ name, address, cityId: cityId || null, city: city || '', lat, lng, radius: radius ?? 5, isActive });
};

const update = async (id, data) => {
  const store = await DarkStore.findByPk(id);
  if (!store) throw new Error('Store not found');
  await store.update(data);
  return store;
};

const toggle = async (id) => {
  const store = await DarkStore.findByPk(id);
  if (!store) throw new Error('Store not found');
  await store.update({ isActive: !store.isActive });
  return store;
};

const remove = async (id) => {
  const store = await DarkStore.findByPk(id);
  if (!store) throw new Error('Store not found');
  await store.destroy();
};

module.exports = { getAll, getById, getStats, create, update, toggle, remove, findNearestStore, haversineKm };
