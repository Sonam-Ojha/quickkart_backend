const Banner = require('../models/banner.model');

const list = () =>
  Banner.findAll({ order: [['sort_order', 'ASC'], ['created_at', 'DESC']] });

const create = async ({ title, subtitle, bannerImage, bgType, deeplink, sortOrder, validTo, isActive }) => {
  if (!title) throw new Error('Title is required');
  if (!bannerImage) throw new Error('Banner image URL is required');
  return Banner.create({ title, subtitle, bannerImage, bgType, deeplink, sortOrder, validTo, isActive });
};

const update = async (id, data) => {
  const banner = await Banner.findByPk(id);
  if (!banner) throw new Error('Banner not found');
  await banner.update(data);
  return banner;
};

const toggle = async (id) => {
  const banner = await Banner.findByPk(id);
  if (!banner) throw new Error('Banner not found');
  await banner.update({ isActive: !banner.isActive });
  return banner;
};

const remove = async (id) => {
  const banner = await Banner.findByPk(id);
  if (!banner) throw new Error('Banner not found');
  await banner.destroy();
};

module.exports = { list, create, update, toggle, remove };
