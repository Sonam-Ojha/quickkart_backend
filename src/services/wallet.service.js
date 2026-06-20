const { Op } = require('sequelize');
const WalletTransaction = require('../models/wallet-transaction.model');
const User = require('../models/user.model');

const getStats = async () => {
  const [totalCredits, totalDebits, txnCount] = await Promise.all([
    WalletTransaction.sum('amount', { where: { type: 'credit' } }),
    WalletTransaction.sum('amount', { where: { type: 'debit'  } }),
    WalletTransaction.count(),
  ]);
  return { totalCredits: totalCredits || 0, totalDebits: totalDebits || 0, txnCount };
};

const list = async ({ type, source, search, page = 1, limit = 20 } = {}) => {
  page  = parseInt(page)  || 1;
  limit = parseInt(limit) || 20;
  const where = {};
  if (type   && type   !== 'all') where.type   = type;
  if (source && source !== 'all') where.source = source;

  const offset = (page - 1) * limit;
  const { count, rows } = await WalletTransaction.findAndCountAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'mobile'] }],
    order: [['created_at', 'DESC']],
    limit: Number(limit),
    offset: Number(offset),
  });

  let txns = rows;
  if (search) {
    const q = search.toLowerCase();
    txns = rows.filter(t =>
      t.user?.name?.toLowerCase().includes(q) ||
      t.user?.email?.toLowerCase().includes(q) ||
      t.note?.toLowerCase().includes(q)
    );
  }

  return { transactions: txns, total: count, page: Number(page), pages: Math.ceil(count / limit) };
};

module.exports = { getStats, list };
