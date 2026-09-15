const Country = require('../../models/country.model');
const State   = require('../../models/state.model');
const City    = require('../../models/city.model');

// ─── COUNTRIES ────────────────────────────────────────────────────────────────

const listCountries = async (_req, res) => {
  try {
    const countries = await Country.findAll({ order: [['name', 'ASC']] });
    res.json({ countries });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const addCountry = async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) return res.status(400).json({ message: 'name and code are required' });
    const country = await Country.create({ name: name.trim(), code: code.trim().toUpperCase() });
    res.status(201).json({ message: 'Country added', country });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError')
      return res.status(409).json({ message: 'Country already exists' });
    res.status(400).json({ message: err.message });
  }
};

const editCountry = async (req, res) => {
  try {
    const country = await Country.findByPk(req.params.id);
    if (!country) return res.status(404).json({ message: 'Country not found' });
    const { name, code, isActive } = req.body;
    await country.update({
      ...(name     !== undefined && { name: name.trim() }),
      ...(code     !== undefined && { code: code.trim().toUpperCase() }),
      ...(isActive !== undefined && { isActive }),
    });
    res.json({ message: 'Country updated', country });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

const toggleCountry = async (req, res) => {
  try {
    const country = await Country.findByPk(req.params.id);
    if (!country) return res.status(404).json({ message: 'Country not found' });
    await country.update({ isActive: !country.isActive });
    res.json({ message: 'Country toggled', country });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

// ─── STATES ───────────────────────────────────────────────────────────────────

const listStates = async (req, res) => {
  try {
    const where = {};
    if (req.query.countryId) where.countryId = req.query.countryId;
    const states = await State.findAll({
      where,
      include: [{ model: Country, as: 'country', attributes: ['id', 'name', 'code'] }],
      order: [['name', 'ASC']],
    });
    res.json({ states });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const addState = async (req, res) => {
  try {
    const { countryId, name, code } = req.body;
    if (!countryId || !name) return res.status(400).json({ message: 'countryId and name are required' });
    const state = await State.create({ countryId, name: name.trim(), code: code?.trim().toUpperCase() || null });
    res.status(201).json({ message: 'State added', state });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError')
      return res.status(409).json({ message: 'State already exists in this country' });
    res.status(400).json({ message: err.message });
  }
};

const editState = async (req, res) => {
  try {
    const state = await State.findByPk(req.params.id);
    if (!state) return res.status(404).json({ message: 'State not found' });
    const { name, code, isActive } = req.body;
    await state.update({
      ...(name     !== undefined && { name: name.trim() }),
      ...(code     !== undefined && { code: code?.trim().toUpperCase() || null }),
      ...(isActive !== undefined && { isActive }),
    });
    res.json({ message: 'State updated', state });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

const toggleState = async (req, res) => {
  try {
    const state = await State.findByPk(req.params.id);
    if (!state) return res.status(404).json({ message: 'State not found' });
    await state.update({ isActive: !state.isActive });
    res.json({ message: 'State toggled', state });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

// ─── CITIES ───────────────────────────────────────────────────────────────────

const listCities = async (req, res) => {
  try {
    const where = {};
    if (req.query.stateId) where.stateId = req.query.stateId;
    const cities = await City.findAll({
      where,
      include: [{
        model: State, as: 'state', attributes: ['id', 'name', 'code'],
        include: [{ model: Country, as: 'country', attributes: ['id', 'name'] }],
      }],
      order: [['name', 'ASC']],
    });
    res.json({ cities });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const addCity = async (req, res) => {
  try {
    const { stateId, name } = req.body;
    if (!stateId || !name) return res.status(400).json({ message: 'stateId and name are required' });
    const city = await City.create({ stateId, name: name.trim() });
    res.status(201).json({ message: 'City added', city });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError')
      return res.status(409).json({ message: 'City already exists in this state' });
    res.status(400).json({ message: err.message });
  }
};

const editCity = async (req, res) => {
  try {
    const city = await City.findByPk(req.params.id);
    if (!city) return res.status(404).json({ message: 'City not found' });
    const { name, isActive } = req.body;
    await city.update({
      ...(name     !== undefined && { name: name.trim() }),
      ...(isActive !== undefined && { isActive }),
    });
    res.json({ message: 'City updated', city });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

const toggleCity = async (req, res) => {
  try {
    const city = await City.findByPk(req.params.id);
    if (!city) return res.status(404).json({ message: 'City not found' });
    await city.update({ isActive: !city.isActive });
    res.json({ message: 'City toggled', city });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

module.exports = {
  listCountries, addCountry, editCountry, toggleCountry,
  listStates,    addState,   editState,   toggleState,
  listCities,    addCity,    editCity,    toggleCity,
};
