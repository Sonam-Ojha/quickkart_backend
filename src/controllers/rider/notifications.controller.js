const RiderNotification = require('../../models/rider-notification.model');

const list = async (req, res) => {
  try {
    const notifications = await RiderNotification.findAll({
      where: { riderId: req.rider.id },
      order: [['created_at', 'DESC'], ['id', 'DESC']],
      limit: 100,
    });
    const unread = await RiderNotification.count({ where: { riderId: req.rider.id, read: false } });
    res.json({ notifications, unread });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const markRead = async (req, res) => {
  try {
    const n = await RiderNotification.findOne({ where: { id: req.params.id, riderId: req.rider.id } });
    if (!n) return res.status(404).json({ message: 'Notification not found' });
    if (!n.read) await n.update({ read: true, readAt: new Date() });
    res.json({ id: n.id, read: n.read });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

const markAllRead = async (req, res) => {
  try {
    const [updated] = await RiderNotification.update(
      { read: true, readAt: new Date() },
      { where: { riderId: req.rider.id, read: false } },
    );
    res.json({ message: 'All marked read', updated });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

module.exports = { list, markRead, markAllRead };
