const svc = require('../services/admin-users.service');

const list = async (req, res) => {
  try {
    const users = await svc.listAdminUsers();
    res.status(200).json({ users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const invite = async (req, res) => {
  try {
    const result = await svc.inviteAdmin(req.body);
    res.status(201).json({ message: 'Admin invited successfully', ...result });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const update = async (req, res) => {
  try {
    const user = await svc.updateAdminUser(req.params.id, req.body);
    res.status(200).json({ message: 'Admin updated successfully', user });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

module.exports = { list, invite, update };
