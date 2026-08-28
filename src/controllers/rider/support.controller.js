const RiderSupportMessage = require('../../models/rider-support-message.model');

const MAX_LEN = 2000;

const list = async (req, res) => {
  try {
    const messages = await RiderSupportMessage.findAll({
      where: { riderId: req.rider.id },
      order: [['created_at', 'ASC'], ['id', 'ASC']],
      limit: 200,
    });
    res.json({ messages });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const send = async (req, res) => {
  try {
    const text = String(req.body?.message ?? '').trim();
    if (!text)               return res.status(400).json({ message: 'message is required' });
    if (text.length > MAX_LEN) return res.status(400).json({ message: `message must be under ${MAX_LEN} characters` });

    const message = await RiderSupportMessage.create({ riderId: req.rider.id, sender: 'rider', message: text });
    res.status(201).json({ message });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

module.exports = { list, send };
