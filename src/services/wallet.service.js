const { Op } = require('sequelize');
const WalletTransaction = require('../models/wallet-transaction.model');
const User = require('../models/user.model');

const getStats = async () => {
  const sequelize = WalletTransaction.sequelize;
  const [row] = await sequelize.query(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS totalCredits,
       COALESCE(SUM(CASE WHEN type = 'debit'  THEN amount ELSE 0 END), 0) AS totalDebits,
       COUNT(*) AS txnCount
     FROM wallet_transactions`,
    { type: sequelize.QueryTypes.SELECT },
  );
  return { totalCredits: Number(row.totalCredits), totalDebits: Number(row.totalDebits), txnCount: Number(row.txnCount) };
};

const list = async ({ type, source, search, page = 1, limit = 20 } = {}) => {
  page  = parseInt(page)  || 1;
  limit = parseInt(limit) || 20;
  const where = {};
  if (type   && type   !== 'all') where.type   = type;
  if (source && source !== 'all') where.source = source;
  if (search) {
    const q = `%${search}%`;
    // Push search into SQL so pagination totals are correct
    where[Op.or] = [
      { note:           { [Op.like]: q } },
      { '$user.name$':  { [Op.like]: q } },
      { '$user.email$': { [Op.like]: q } },
    ];
  }

  const offset = (page - 1) * limit;
  const { count, rows } = await WalletTransaction.findAndCountAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'mobile'] }],
    order: [['created_at', 'DESC']],
    limit: Number(limit),
    offset: Number(offset),
    distinct: true,
  });

  return { transactions: rows, total: count, page: Number(page), pages: Math.ceil(count / limit) };
};

module.exports = { getStats, list };
