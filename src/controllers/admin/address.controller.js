const svc = require('../../services/address.service');

const getAll = async (req, res) => {
  try {
    const addresses = await svc.getAll(req.user.id);
    res.status(200).json({ addresses });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const add = async (req, res) => {
  try {
    const address = await svc.add(req.user.id, req.body);
    res.status(201).json({ message: 'Address added successfully', address });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const edit = async (req, res) => {
  try {
    const address = await svc.edit(req.user.id, req.params.id, req.body);
    res.status(200).json({ message: 'Address updated successfully', address });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    await svc.remove(req.user.id, req.params.id);
    res.status(200).json({ message: 'Address deleted successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const checkServiceability = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const result = await svc.checkServiceability(lat, lng);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

module.exports = { getAll, add, edit, remove, checkServiceability };
