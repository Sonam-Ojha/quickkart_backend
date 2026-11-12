const Restaurant   = require('../models/restaurant.model');
const MenuCategory = require('../models/menu-category.model');
const MenuItem     = require('../models/menu-item.model');
const DarkStore    = require('../models/darkstore.model');
const { findNearestStore } = require('./darkstore.service');

// ── Opening hours (IST) ───────────────────────────────────

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMins = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

const nowMinsIST = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t) => Number(parts.find(p => p.type === t)?.value ?? 0);
  return (get('hour') % 24) * 60 + get('minute');
};

// Open when switched on and inside today's hours (hours may run past midnight).
const isOpenNow = (r, nowMins = nowMinsIST()) => {
  if (!r.isOpen || !r.isActive) return false;
  if (!r.openTime || !r.closeTime) return true;
  const open = toMins(r.openTime), close = toMins(r.closeTime);
  return open <= close ? nowMins >= open && nowMins < close : nowMins >= open || nowMins < close;
};

// ── Validation helpers ────────────────────────────────────

const pick = (src, keys) =>
  Object.fromEntries(keys.filter(k => src[k] !== undefined).map(k => [k, src[k]]));

const RESTAURANT_FIELDS = [
  'storeId', 'name', 'description', 'cuisines', 'imageUrl', 'address', 'lat', 'lng', 'phone',
  'isPureVeg', 'commissionPct', 'prepTimeMins', 'openTime', 'closeTime', 'isOpen', 'isActive', 'sortOrder',
];
const CATEGORY_FIELDS = ['name', 'sortOrder', 'isActive'];
const ITEM_FIELDS = [
  'menuCategoryId', 'name', 'description', 'imageUrl', 'price', 'mrp', 'unit',
  'isVeg', 'isAvailable', 'isActive', 'sortOrder',
];

const cleanRestaurant = (data) => {
  const d = pick(data, RESTAURANT_FIELDS);
  for (const k of ['openTime', 'closeTime']) {
    if (d[k] === '' ) d[k] = null;
    if (d[k] != null && !HHMM.test(d[k])) throw new Error(`${k} must be HH:MM (24-hour)`);
  }
  if (d.commissionPct != null && (Number(d.commissionPct) < 0 || Number(d.commissionPct) > 100)) {
    throw new Error('Commission must be between 0 and 100');
  }
  for (const k of ['lat', 'lng']) if (d[k] === '') d[k] = null;
  return d;
};

const cleanItem = (data) => {
  const d = pick(data, ITEM_FIELDS);
  if (d.price != null && !(Number.isInteger(Number(d.price)) && Number(d.price) >= 0)) {
    throw new Error('Price must be a whole number of rupees');
  }
  if (d.mrp === '' || d.mrp === 0) d.mrp = null;
  if (d.menuCategoryId === '') d.menuCategoryId = null;
  return d;
};

// ── Admin: restaurants ────────────────────────────────────

const listRestaurants = async ({ storeId } = {}) => {
  const where = storeId ? { storeId } : {};
  const rows = await Restaurant.findAll({
    where,
    include: [{ model: DarkStore, as: 'store', attributes: ['id', 'name', 'city', 'foodEnabled'] }],
    order: [['sort_order', 'ASC'], ['id', 'ASC']],
  });
  const counts = await MenuItem.count({ where: { isActive: true }, group: ['restaurant_id'] });
  const byId = Object.fromEntries(counts.map(c => [c.restaurant_id, Number(c.count)]));
  return rows.map(r => ({ ...r.toJSON(), itemCount: byId[r.id] ?? 0, openNow: isOpenNow(r) }));
};

const getRestaurant = async (id) => {
  const r = await Restaurant.findByPk(id, {
    include: [{ model: DarkStore, as: 'store', attributes: ['id', 'name', 'city', 'foodEnabled'] }],
  });
  if (!r) throw new Error('Restaurant not found');
  return r;
};

const createRestaurant = async (data) => {
  const d = cleanRestaurant(data);
  if (!d.name?.trim())    throw new Error('Name is required');
  if (!d.address?.trim()) throw new Error('Address is required');
  if (!d.storeId)         throw new Error('Store / area is required');
  if (!(await DarkStore.findByPk(d.storeId))) throw new Error('Store not found');
  return Restaurant.create(d);
};

const updateRestaurant = async (id, data) => {
  const r = await getRestaurant(id);
  const d = cleanRestaurant(data);
  if (d.storeId && !(await DarkStore.findByPk(d.storeId))) throw new Error('Store not found');
  await r.update(d);
  return r;
};

const toggleRestaurant = async (id, field = 'isActive') => {
  if (!['isActive', 'isOpen'].includes(field)) throw new Error('Unknown toggle');
  const r = await getRestaurant(id);
  await r.update({ [field]: !r[field] });
  return r;
};

const deleteRestaurant = async (id) => {
  const r = await getRestaurant(id);
  await MenuItem.destroy({ where: { restaurantId: r.id } });
  await MenuCategory.destroy({ where: { restaurantId: r.id } });
  await r.destroy();
};

// ── Admin: menu ───────────────────────────────────────────

const getMenu = async (restaurantId) => {
  await getRestaurant(restaurantId);
  const [categories, items] = await Promise.all([
    MenuCategory.findAll({ where: { restaurantId }, order: [['sort_order', 'ASC'], ['id', 'ASC']] }),
    MenuItem.findAll({ where: { restaurantId }, order: [['sort_order', 'ASC'], ['id', 'ASC']] }),
  ]);
  return { categories, items };
};

const createMenuCategory = async (restaurantId, data) => {
  await getRestaurant(restaurantId);
  const d = pick(data, CATEGORY_FIELDS);
  if (!d.name?.trim()) throw new Error('Name is required');
  return MenuCategory.create({ ...d, restaurantId });
};

const updateMenuCategory = async (restaurantId, id, data) => {
  const c = await MenuCategory.findOne({ where: { id, restaurantId } });
  if (!c) throw new Error('Menu section not found');
  await c.update(pick(data, CATEGORY_FIELDS));
  return c;
};

// Items in a deleted section stay on the menu, under "Other".
const deleteMenuCategory = async (restaurantId, id) => {
  const c = await MenuCategory.findOne({ where: { id, restaurantId } });
  if (!c) throw new Error('Menu section not found');
  await MenuItem.update({ menuCategoryId: null }, { where: { menuCategoryId: c.id } });
  await c.destroy();
};

const assertCategory = async (restaurantId, menuCategoryId) => {
  if (menuCategoryId == null) return;
  const c = await MenuCategory.findOne({ where: { id: menuCategoryId, restaurantId } });
  if (!c) throw new Error('Menu section not found for this restaurant');
};

const createMenuItem = async (restaurantId, data) => {
  await getRestaurant(restaurantId);
  const d = cleanItem(data);
  if (!d.name?.trim())  throw new Error('Name is required');
  if (d.price == null)  throw new Error('Price is required');
  await assertCategory(restaurantId, d.menuCategoryId);
  return MenuItem.create({ ...d, restaurantId });
};

const updateMenuItem = async (restaurantId, id, data) => {
  const item = await MenuItem.findOne({ where: { id, restaurantId } });
  if (!item) throw new Error('Menu item not found');
  const d = cleanItem(data);
  await assertCategory(restaurantId, d.menuCategoryId);
  await item.update(d);
  return item;
};

const toggleMenuItem = async (restaurantId, id) => {
  const item = await MenuItem.findOne({ where: { id, restaurantId } });
  if (!item) throw new Error('Menu item not found');
  await item.update({ isAvailable: !item.isAvailable });
  return item;
};

const deleteMenuItem = async (restaurantId, id) => {
  const item = await MenuItem.findOne({ where: { id, restaurantId } });
  if (!item) throw new Error('Menu item not found');
  await item.destroy();
};

// ── Customer app ──────────────────────────────────────────

// Food is available where the serving store has it switched on.
const foodStoreFor = async (lat, lng) => {
  const { store } = await findNearestStore(lat, lng);
  return store && store.foodEnabled ? store : null;
};

const publicRestaurant = (r) => ({
  id:           r.id,
  name:         r.name,
  description:  r.description ?? '',
  cuisines:     r.cuisines ?? '',
  imageUrl:     r.imageUrl ?? null,
  address:      r.address,
  isPureVeg:    r.isPureVeg,
  prepTimeMins: r.prepTimeMins,
  openTime:     r.openTime,
  closeTime:    r.closeTime,
  openNow:      isOpenNow(r),
});

const getFoodStatus = async (lat, lng) => {
  const store = await foodStoreFor(lat, lng);
  if (!store) return { enabled: false };
  const restaurantCount = await Restaurant.count({ where: { storeId: store.id, isActive: true } });
  return { enabled: restaurantCount > 0, storeId: store.id, restaurantCount };
};

// Open restaurants first, then by admin sort order.
const listPublicRestaurants = async (lat, lng) => {
  const store = await foodStoreFor(lat, lng);
  if (!store) return { enabled: false, restaurants: [] };
  const rows = await Restaurant.findAll({
    where: { storeId: store.id, isActive: true },
    order: [['sort_order', 'ASC'], ['id', 'ASC']],
  });
  const restaurants = rows.map(publicRestaurant)
    .sort((a, b) => Number(b.openNow) - Number(a.openNow));
  return { enabled: true, restaurants };
};

const getPublicMenu = async (id) => {
  const r = await Restaurant.findOne({ where: { id, isActive: true } });
  if (!r) throw new Error('Restaurant not found');
  const store = await DarkStore.findByPk(r.storeId);
  if (!store?.foodEnabled) throw new Error('Restaurant not found');

  const [categories, items] = await Promise.all([
    MenuCategory.findAll({ where: { restaurantId: r.id, isActive: true }, order: [['sort_order', 'ASC'], ['id', 'ASC']] }),
    MenuItem.findAll({ where: { restaurantId: r.id, isActive: true }, order: [['sort_order', 'ASC'], ['id', 'ASC']] }),
  ]);
  const toItem = (i) => ({
    id: i.id, name: i.name, description: i.description ?? '', imageUrl: i.imageUrl ?? null,
    price: i.price, mrp: i.mrp ?? null, unit: i.unit ?? '', isVeg: i.isVeg, isAvailable: i.isAvailable,
  });
  const sections = categories
    .map(c => ({ id: c.id, name: c.name, items: items.filter(i => i.menuCategoryId === c.id).map(toItem) }))
    .filter(s => s.items.length > 0);
  // Items without a (live) section go last under "Other".
  const liveIds = new Set(categories.map(c => c.id));
  const other = items.filter(i => !liveIds.has(i.menuCategoryId)).map(toItem);
  if (other.length) sections.push({ id: null, name: 'Other', items: other });

  return { restaurant: publicRestaurant(r), sections };
};

module.exports = {
  isOpenNow,
  listRestaurants, getRestaurant, createRestaurant, updateRestaurant, toggleRestaurant, deleteRestaurant,
  getMenu, createMenuCategory, updateMenuCategory, deleteMenuCategory,
  createMenuItem, updateMenuItem, toggleMenuItem, deleteMenuItem,
  getFoodStatus, listPublicRestaurants, getPublicMenu,
};
