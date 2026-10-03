const Address = require('../../models/address.model');

const list = async (req, res) => {
  try {
    const addresses = await Address.findAll({
      where: { userId: req.user.id },
      order: [['created_at', 'DESC']],
    });
    return res.json(addresses);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const create = async (req, res) => {
  try {
    const { label, line1, line2, city, state, pincode, lat, lng, is_default } = req.body;
    const address = await Address.create({
      userId: req.user.id,
      label,
      line1,
      line2,
      city,
      state,
      pincode: pincode ?? '',
      lat,
      lng,
      isDefault: is_default ?? false,
    });
    return res.status(201).json(address);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const update = async (req, res) => {
  try {
    const address = await Address.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!address) return res.status(404).json({ message: 'Address not found' });
    await address.update(req.body);
    return res.json(address);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const address = await Address.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!address) return res.status(404).json({ message: 'Address not found' });
    await address.destroy();
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { list, create, update, remove };
