const svc = require('../../services/customer.service');

const list = async (req, res) => {
  try {
    const { search, status, page, limit } = req.query;
    const data = await svc.listCustomers({ search, status, page, limit });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const detail = async (req, res) => {
  try {
    const customer = await svc.getCustomer(req.params.id);
    res.json({ customer });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const toggleBlock = async (req, res) => {
  try {
    const result = await svc.toggleBlock(req.params.id);
    res.json({ ...result, message: result.isActive ? 'Customer unblocked' : 'Customer blocked' });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

module.exports = { list, detail, toggleBlock };
