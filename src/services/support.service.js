const { Op } = require('sequelize');
const SupportTicket  = require('../models/support-ticket.model');
const SupportMessage = require('../models/support-message.model');
const User  = require('../models/user.model');
const Order = require('../models/order.model');

const getStats = async () => {
  const [total, open, in_progress, resolved] = await Promise.all([
    SupportTicket.count(),
    SupportTicket.count({ where: { status: 'open' } }),
    SupportTicket.count({ where: { status: 'in_progress' } }),
    SupportTicket.count({ where: { status: 'resolved' } }),
  ]);
  return { total, open, in_progress, resolved };
};

const list = async ({ status, category, search, page = 1, limit = 15 } = {}) => {
  page  = parseInt(page)  || 1;
  limit = parseInt(limit) || 15;
  const where = {};
  if (status   && status   !== 'all') where.status   = status;
  if (category && category !== 'all') where.category = category;

  const offset = (page - 1) * limit;
  const { count, rows } = await SupportTicket.findAndCountAll({
    where,
    include: [
      { model: User,  as: 'customer', attributes: ['id', 'name', 'email', 'mobile'] },
      { model: Order, as: 'order',    attributes: ['id', 'total', 'status'], required: false },
    ],
    order: [['created_at', 'DESC']],
    limit: Number(limit),
    offset: Number(offset),
  });

  let tickets = rows;
  if (search) {
    const q = search.toLowerCase();
    tickets = rows.filter(t =>
      t.customer?.name?.toLowerCase().includes(q) ||
      t.customer?.email?.toLowerCase().includes(q) ||
      String(t.id).includes(q)
    );
  }

  return { tickets, total: count, page: Number(page), pages: Math.ceil(count / limit) };
};

const getTicket = async (id) => {
  const ticket = await SupportTicket.findByPk(id, {
    include: [
      { model: User,  as: 'customer', attributes: ['id', 'name', 'email', 'mobile'] },
      { model: Order, as: 'order',    attributes: ['id', 'total', 'status'], required: false },
      { model: SupportMessage, as: 'messages', order: [['created_at', 'ASC']] },
    ],
  });
  if (!ticket) throw new Error('Ticket not found');
  return ticket;
};

const updateStatus = async (id, status) => {
  const valid = ['open', 'in_progress', 'resolved'];
  if (!valid.includes(status)) throw new Error('Invalid status');
  const ticket = await SupportTicket.findByPk(id);
  if (!ticket) throw new Error('Ticket not found');
  await ticket.update({ status });
  return ticket;
};

const reply = async (id, adminId, message) => {
  if (!message?.trim()) throw new Error('Message is required');
  const ticket = await SupportTicket.findByPk(id);
  if (!ticket) throw new Error('Ticket not found');
  const msg = await SupportMessage.create({ ticketId: id, senderType: 'admin', senderId: adminId, message: message.trim() });
  if (ticket.status === 'open') await ticket.update({ status: 'in_progress' });
  return msg;
};

module.exports = { getStats, list, getTicket, updateStatus, reply };
