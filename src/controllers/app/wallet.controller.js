const User              = require('../../models/user.model');
const WalletTransaction = require('../../models/wallet-transaction.model');

const getBalance = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: ['id', 'name', 'wallet_balance'] });
    const recent = await WalletTransaction.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']],
      limit: 5,
    });
    return res.json({ balance: user.wallet_balance, recentTransactions: recent });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getHistory = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const { rows, count } = await WalletTransaction.findAndCountAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']],
      limit: Number(limit),
      offset: Number(offset),
    });
    return res.json({ transactions: rows, total: count });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { getBalance, getHistory };
