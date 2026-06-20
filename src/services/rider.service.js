const { Op } = require('sequelize');
const Rider     = require('../models/rider.model');
const DarkStore = require('../models/darkstore.model');

const getAll = async ({ storeId, status, search } = {}) => {
  const where = {};
  if (storeId) where.storeId = storeId;
  if (status && status !== 'all') where.status = status;
  if (search) where.name = { [Op.like]: `%${search}%` };

  return Rider.findAll({
    where,
    include: [{ model: DarkStore, as: 'store', attributes: ['id', 'name', 'city'] }],
    order: [['id', 'DESC']],
  });
};

const getById = async (id) => {
  const rider = await Rider.findByPk(id, {
    include: [{ model: DarkStore, as: 'store', attributes: ['id', 'name', 'city'] }],
  });
  if (!rider) throw new Error('Rider not found');
  return rider;
};

const create = async ({ name, mobile, storeId, rating, status }) => {
  return Rider.create({ name, mobile, storeId, rating, status });
};

const update = async (id, data) => {
  const rider = await Rider.findByPk(id);
  if (!rider) throw new Error('Rider not found');
  await rider.update(data);
  return rider;
};

const toggle = async (id) => {
  const rider = await Rider.findByPk(id);
  if (!rider) throw new Error('Rider not found');
  const next = rider.status === 'active' ? 'inactive' : 'active';
  await rider.update({ status: next });
  return rider;
};

const remove = async (id) => {
  const rider = await Rider.findByPk(id);
  if (!rider) throw new Error('Rider not found');
  await rider.destroy();
};

module.exports = { getAll, getById, create, update, toggle, remove };
