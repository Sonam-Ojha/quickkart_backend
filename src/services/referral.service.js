const { Op } = require('sequelize');
const Referral = require('../models/referral.model');
const User     = require('../models/user.model');

const USER_ATTRS = ['id', 'name', 'email', 'mobile'];

const getStats = async () => {
  const [total, approved, pending, rejected] = await Promise.all([
    Referral.count(),
    Referral.count({ where: { status: 'approved' } }),
    Referral.count({ where: { status: 'pending' } }),
    Referral.count({ where: { status: 'rejected' } }),
  ]);
  const rewardResult = await Referral.sum('rewardAmount', { where: { status: 'approved' } });
  return { total, approved, pending, rejected, totalRewards: rewardResult || 0 };
};

const list = async ({ status, search, page = 1, limit = 20 } = {}) => {
  page  = parseInt(page)  || 1;
  limit = parseInt(limit) || 20;
  const where = {};
  if (status && status !== 'all') where.status = status;

  const offset = (page - 1) * limit;

  const { count, rows } = await Referral.findAndCountAll({
    where,
    include: [
      { model: User, as: 'referrer', attributes: USER_ATTRS },
      { model: User, as: 'referee',  attributes: USER_ATTRS },
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });

  // client-side search filter on names/emails
  let filtered = rows;
  if (search) {
    const q = search.toLowerCase();
    filtered = rows.filter(r =>
      r.referrer?.name?.toLowerCase().includes(q) ||
      r.referrer?.email?.toLowerCase().includes(q) ||
      r.referee?.name?.toLowerCase().includes(q) ||
      r.referralCode?.toLowerCase().includes(q)
    );
  }

  return { referrals: filtered, total: count, page: Number(page), pages: Math.ceil(count / limit) };
};

const updateStatus = async (id, status, rewardAmount) => {
  if (!['pending', 'approved', 'rejected'].includes(status)) throw new Error('Invalid status');
  const referral = await Referral.findByPk(id);
  if (!referral) throw new Error('Referral not found');
  await referral.update({ status, ...(rewardAmount !== undefined ? { rewardAmount } : {}) });
  return referral;
};

module.exports = { getStats, list, updateStatus };
