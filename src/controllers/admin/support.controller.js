const svc  = require('../../services/support.service');
const { sendToUser } = require('../../services/notification.service');
const SupportTicket  = require('../../models/support-ticket.model');

const stats = async (req, res) => {
  try { res.json(await svc.getStats()); } catch (e) { res.status(500).json({ message: e.message }); }
};
const list = async (req, res) => {
  try { res.json(await svc.list(req.query)); } catch (e) { res.status(500).json({ message: e.message }); }
};
const detail = async (req, res) => {
  try { res.json({ ticket: await svc.getTicket(req.params.id) }); } catch (e) { res.status(404).json({ message: e.message }); }
};
const updateStatus = async (req, res) => {
  try { res.json({ ticket: await svc.updateStatus(req.params.id, req.body.status) }); } catch (e) { res.status(400).json({ message: e.message }); }
};
const reply = async (req, res) => {
  try {
    const msg = await svc.reply(req.params.id, req.user.id, req.body.message);
    res.status(201).json({ message: msg });
    // Notify customer async
    const ticket = await SupportTicket.findByPk(req.params.id, { attributes: ['customerId', 'subject'] });
    if (ticket?.customerId) {
      sendToUser(ticket.customerId, {
        title: 'Support reply received',
        body:  req.body.message.slice(0, 100),
        data:  { ticketId: String(req.params.id), screen: 'support' },
      }).catch(() => {});
    }
  } catch (e) { res.status(400).json({ message: e.message }); }
};
module.exports = { stats, list, detail, updateStatus, reply };
