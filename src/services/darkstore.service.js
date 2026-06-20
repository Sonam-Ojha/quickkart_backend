const { Op } = require('sequelize');
const DarkStore  = require('../models/darkstore.model');
const Rider      = require('../models/rider.model');
const Inventory  = require('../models/inventory.model');

const getAll = async () => {
  return DarkStore.findAll({ order: [['id', 'ASC']] });
};

const getById = async (id) => {
  const store = await DarkStore.findByPk(id);
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

const create = async ({ name, address, city, lat, lng, isActive }) => {
  return DarkStore.create({ name, address, city, lat, lng, isActive });
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

module.exports = { getAll, getById, getStats, create, update, toggle, remove };
