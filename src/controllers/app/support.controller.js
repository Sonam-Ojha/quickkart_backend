const SupportTicket  = require('../../models/support-ticket.model');
const SupportMessage = require('../../models/support-message.model');
const { Op } = require('sequelize');

const createTicket = async (req, res) => {
  try {
    const { subject, category = 'other', message, orderId } = req.body;
    if (!message?.trim()) return res.status(400).json({ message: 'Message is required' });
    const ticket = await SupportTicket.create({
      customerId: req.user.id,
      orderId: orderId || null,
      subject: subject?.trim() || null,
      category,
      status: 'open',
    });
    await SupportMessage.create({
      ticketId: ticket.id,
      senderType: 'user',
      senderId: req.user.id,
      message: message.trim(),
    });
    res.status(201).json({ ticket });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

const listTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.findAll({
      where: { customerId: req.user.id },
      order: [['created_at', 'DESC']],
    });
    res.json({ tickets });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

const getTicket = async (req, res) => {
  try {
    const ticket = await SupportTicket.findOne({
      where: { id: req.params.id, customerId: req.user.id },
      include: [{ model: SupportMessage, as: 'messages', order: [['created_at', 'ASC']] }],
    });
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    res.json({ ticket });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

const sendMessage = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ message: 'Message is required' });
    const ticket = await SupportTicket.findOne({ where: { id: req.params.id, customerId: req.user.id } });
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (ticket.status === 'resolved') return res.status(400).json({ message: 'Ticket is resolved' });
    const msg = await SupportMessage.create({
      ticketId: ticket.id,
      senderType: 'user',
      senderId: req.user.id,
      message: message.trim(),
    });
    res.status(201).json({ message: msg });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

module.exports = { createTicket, listTickets, getTicket, sendMessage };
