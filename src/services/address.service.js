const Address = require('../models/address.model');

const getAll = async (userId) => {
  return Address.findAll({ where: { userId } });
};

const add = async (userId, { label, line1, line2, city, pincode, lat, lng, isDefault }) => {
  return Address.create({ userId, label, line1, line2, city, pincode, lat, lng, isDefault });
};

const edit = async (userId, addressId, data) => {
  const address = await Address.findOne({ where: { id: addressId, userId } });
  if (!address) throw new Error('Address not found');
  await address.update(data);
  return address;
};

const remove = async (userId, addressId) => {
  const address = await Address.findOne({ where: { id: addressId, userId } });
  if (!address) throw new Error('Address not found');
  await address.destroy();
};

const checkServiceability = async (lat, lng) => {
  return { serviceable: true, message: 'Delivery available in this area' };
};

module.exports = { getAll, add, edit, remove, checkServiceability };
