const Banner = require('../models/banner.model');

const list = () =>
  Banner.findAll({ order: [['sort_order', 'ASC'], ['created_at', 'DESC']] });

const PLATFORMS = ['both', 'web', 'app'];
const normalizePlatform = (p) => (PLATFORMS.includes(p) ? p : 'both');

const create = async ({ title, subtitle, bannerImage, mobileImage, platform, section, emoji, bgType, deeplink, sortOrder, validTo, isActive }) => {
  if (!bannerImage) throw new Error('Banner image URL is required');
  return Banner.create({
    title: title ?? '', subtitle: subtitle ?? '', bannerImage,
    mobileImage: mobileImage || null, platform: normalizePlatform(platform),
    section, emoji, bgType, deeplink, sortOrder, validTo, isActive,
  });
};

const update = async (id, data) => {
  const banner = await Banner.findByPk(id);
  if (!banner) throw new Error('Banner not found');
  const { title, subtitle, bannerImage, mobileImage, platform, section, emoji, bgType, deeplink, sortOrder, validTo, isActive } = data;
  await banner.update({
    title:    title    ?? '',
    subtitle: subtitle ?? '',
    // Leave fields an older admin client doesn't send untouched.
    ...(mobileImage !== undefined && { mobileImage: mobileImage || null }),
    ...(platform    !== undefined && { platform: normalizePlatform(platform) }),
    bannerImage, section, emoji, bgType, deeplink, sortOrder, validTo, isActive,
  });
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
