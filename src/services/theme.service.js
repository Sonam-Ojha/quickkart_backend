const { Op } = require('sequelize');
const AppTheme = require('../models/app-theme.model');
const DarkStore = require('../models/darkstore.model');
const Product  = require('../models/product.model');
const Category = require('../models/category.model');
const { resolveStorefront, storeCatalog, scopeToStore, formatProduct } = require('./storefront.service');

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

// ── What a theme can change ───────────────────────────────────
// The customer app + website read exactly these keys. Adding a new key needs
// an app update once; changing values never does.
//
//   headerColor        "#RRGGBB"  background of the top header
//   headerTextColor    "light" | "dark"  text/icons on the header
//   headerImage        url | null  pattern / photo behind the header (cover)
//   decorationImage    url | null  transparent PNG hanging from the header's top edge
//   animationUrl       url | null  Lottie JSON (fireworks, snow…)
//   animationMode      "header" (loops in the header) | "once" (full screen, once per launch)
//   accentColor        "#RRGGBB"  active category tab / highlights
//   greeting           text | null  e.g. "Happy Diwali 🪔"
//   searchPlaceholder  text | null  e.g. "Search for diyas, sweets…"
//   pageTint           "#RRGGBB" | null  light colour the page fades from under the header (tiles too)
//   pageImage          url | null  faint pattern behind the top of the page
//   section            { enabled, title, subtitle, bgColor, bgImage, bannerImage,
//                        tiles[{ label, image, query }] ("Shop by" cards → search), productIds[] }

const HEX = /^#[0-9a-fA-F]{6}$/;
const URL_RE = /^https?:\/\/\S+$/i;

const str = (v, max) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};
const url = (v, field) => {
  const s = str(v, 500);
  if (s && !URL_RE.test(s)) throw fail(`${field} must be a web link (https://…)`);
  return s;
};
const color = (v, field, fallback) => {
  const s = str(v, 7);
  if (!s) return fallback;
  if (!HEX.test(s)) throw fail(`${field} must be a colour like #EA580C`);
  return s.toUpperCase();
};

const cleanConfig = (c = {}) => {
  const sec = c.section ?? {};
  const productIds = Array.isArray(sec.productIds)
    ? [...new Set(sec.productIds.map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, 30)
    : [];
  return {
    headerColor:       color(c.headerColor, 'Header colour', '#EA580C'),
    headerTextColor:   c.headerTextColor === 'dark' ? 'dark' : 'light',
    headerImage:       url(c.headerImage, 'Header picture'),
    decorationImage:   url(c.decorationImage, 'Decoration picture'),
    animationUrl:      url(c.animationUrl, 'Animation'),
    animationMode:     c.animationMode === 'once' ? 'once' : 'header',
    accentColor:       color(c.accentColor, 'Highlight colour', '#EA580C'),
    greeting:          str(c.greeting, 60),
    searchPlaceholder: str(c.searchPlaceholder, 60),
    pageTint:          color(c.pageTint, 'Page colour', null),
    pageImage:         url(c.pageImage, 'Page picture'),
    section: {
      enabled:  Boolean(sec.enabled),
      title:    str(sec.title, 60),
      subtitle: str(sec.subtitle, 120),
      bgColor:  color(sec.bgColor, 'Section colour', '#FFF7ED'),
      bgImage:  url(sec.bgImage, 'Section picture'),
      bannerImage: url(sec.bannerImage, 'Section banner'),
      tiles: (Array.isArray(sec.tiles) ? sec.tiles : []).slice(0, 8).map((t, i) => ({
        label: str(t?.label, 24),
        image: url(t?.image, `Tile ${i + 1} picture`),
        query: str(t?.query, 40),
      })).filter(t => t.label && t.image),
      productIds,
    },
  };
};

const cleanTheme = (body = {}, { partial = false } = {}) => {
  const out = {};
  if (!partial || body.name !== undefined) {
    const name = str(body.name, 80);
    if (!name) throw fail('Give the theme a name, e.g. "Diwali 2026"');
    out.name = name;
  }
  if (body.isActive !== undefined) out.isActive = Boolean(body.isActive);
  for (const k of ['startsAt', 'endsAt']) {
    if (body[k] === undefined) continue;
    if (body[k] === null || body[k] === '') { out[k] = null; continue; }
    const d = new Date(body[k]);
    if (Number.isNaN(d.getTime())) throw fail(`${k === 'startsAt' ? 'Start' : 'End'} date is not valid`);
    out[k] = d;
  }
  if (body.storeIds !== undefined) {
    out.storeIds = Array.isArray(body.storeIds) ? body.storeIds.map(Number).filter(n => n > 0) : null;
  }
  if (body.priority !== undefined) out.priority = Math.max(0, Math.min(100, Number(body.priority) || 0));
  if (!partial || body.config !== undefined) out.config = cleanConfig(body.config);
  return out;
};

const checkDates = (t) => {
  if (t.startsAt && t.endsAt && new Date(t.endsAt) <= new Date(t.startsAt)) {
    throw fail('End date must be after the start date');
  }
};

// ── Live theme lookup (cached per area) ───────────────────────

const _cache = new Map(); // storeId|'none' → { theme, at }
const TTL = 60_000;
const invalidate = () => _cache.clear();

const isLive = (t, now = new Date()) =>
  t.isActive && (!t.startsAt || new Date(t.startsAt) <= now) && (!t.endsAt || new Date(t.endsAt) > now);

// Area-specific themes beat "all areas" ones; then higher priority; then newest start.
const pickTheme = (themes, storeId, now = new Date()) => themes
  .filter(t => isLive(t, now))
  .filter(t => !t.storeIds || (storeId != null && t.storeIds.includes(Number(storeId))))
  .sort((a, b) =>
    (b.storeIds ? 1 : 0) - (a.storeIds ? 1 : 0) ||
    b.priority - a.priority ||
    new Date(b.startsAt ?? 0) - new Date(a.startsAt ?? 0))[0] ?? null;

// The theme payload apps receive. `version` changes on every edit so apps can
// refresh cached pictures/animations.
const publicTheme = (t) => t && ({
  id: t.id,
  name: t.name,
  version: new Date(t.updatedAt ?? t.updated_at ?? Date.now()).getTime(),
  endsAt: t.endsAt,
  ...t.config,
});

const sectionProducts = async (productIds, storeId) => {
  if (!productIds?.length) return [];
  const catalog = await storeCatalog(storeId);
  const rows = await Product.findAll({
    where: scopeToStore({ id: { [Op.in]: productIds }, isActive: true }, catalog),
    include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
  });
  const byId = new Map(rows.map(p => [p.id, formatProduct(p, catalog)]));
  return productIds.map(id => byId.get(id)).filter(Boolean); // admin's order
};

/** GET /api/app/theme?lat&lng — the live theme for this location, or null. */
const liveThemeFor = async (lat, lng) => {
  const { storeId } = await resolveStorefront(lat, lng);
  const key = storeId ?? 'none';
  const hit = _cache.get(key);
  let theme;
  if (hit && Date.now() - hit.at < TTL) theme = hit.theme;
  else {
    const candidates = await AppTheme.findAll({ where: { isActive: true } });
    theme = pickTheme(candidates, storeId);
    _cache.set(key, { theme, at: Date.now() });
  }
  if (!theme) return { theme: null };
  const payload = publicTheme(theme);
  // Theme may run past its end date while cached — re-check before answering.
  if (!isLive(theme)) return { theme: null };
  if (payload.section?.enabled) {
    payload.section = { ...payload.section, products: await sectionProducts(payload.section.productIds, storeId) };
    if (!payload.section.products.length && !payload.section.tiles?.length && !payload.section.bannerImage) payload.section.enabled = false;
  }
  return { theme: payload };
};

// ── Admin ─────────────────────────────────────────────────────

const status = (t, now = new Date()) => {
  if (!t.isActive) return 'off';
  if (t.startsAt && new Date(t.startsAt) > now) return 'scheduled';
  if (t.endsAt && new Date(t.endsAt) <= now) return 'ended';
  return 'live';
};
const adminView = (t) => ({ ...t.toJSON(), status: status(t) });

const list = async () => {
  const rows = await AppTheme.findAll({ order: [['created_at', 'DESC']] });
  return rows.map(adminView);
};
const get = async (id) => {
  const t = await AppTheme.findByPk(id);
  if (!t) throw fail('Theme not found', 404);
  return adminView(t);
};
const create = async (body) => {
  const data = cleanTheme(body);
  checkDates(data);
  const t = await AppTheme.create(data);
  invalidate();
  return adminView(t);
};
const update = async (id, body) => {
  const t = await AppTheme.findByPk(id);
  if (!t) throw fail('Theme not found', 404);
  const data = cleanTheme(body, { partial: true });
  checkDates({ startsAt: data.startsAt ?? t.startsAt, endsAt: data.endsAt ?? t.endsAt });
  await t.update(data);
  invalidate();
  return adminView(t);
};
const toggle = async (id) => {
  const t = await AppTheme.findByPk(id);
  if (!t) throw fail('Theme not found', 404);
  await t.update({ isActive: !t.isActive });
  invalidate();
  return adminView(t);
};
const remove = async (id) => {
  const t = await AppTheme.findByPk(id);
  if (!t) throw fail('Theme not found', 404);
  await t.destroy();
  invalidate();
};

/** Products for the section picker (admin search). */
const searchProducts = async (q) => {
  const where = { isActive: true };
  if (q) where.name = { [Op.like]: `%${String(q).slice(0, 60)}%` };
  const rows = await Product.findAll({ where, attributes: ['id', 'name', 'imageUrl', 'price', 'unit'], limit: 20, order: [['name', 'ASC']] });
  return rows.map(p => ({ id: p.id, name: p.name, imageUrl: p.imageUrl, price: Math.round(p.price / 100), unit: p.unit }));
};
const productsByIds = async (ids) => {
  if (!ids?.length) return [];
  const rows = await Product.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'name', 'imageUrl', 'price', 'unit'] });
  const byId = new Map(rows.map(p => [p.id, { id: p.id, name: p.name, imageUrl: p.imageUrl, price: Math.round(p.price / 100), unit: p.unit }]));
  return ids.map(id => byId.get(id)).filter(Boolean);
};

const storeOptions = async () =>
  (await DarkStore.findAll({ attributes: ['id', 'name', 'city'], order: [['name', 'ASC']] })).map(s => s.toJSON());

module.exports = {
  liveThemeFor, list, get, create, update, toggle, remove,
  searchProducts, productsByIds, storeOptions, invalidate,
  // exported for tests
  cleanConfig, pickTheme, isLive,
};
