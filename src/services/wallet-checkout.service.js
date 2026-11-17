const crypto = require('crypto');
const User = require('../models/user.model');
const Order = require('../models/order.model');
const Payment = require('../models/payment.model');
const WalletTransaction = require('../models/wallet-transaction.model');
const checkout = require('./checkout-payment.service');

async function begin(userId, body, kind, transaction) {
  if (typeof body.request_id !== 'string' || !/^[a-zA-Z0-9_-]{16,64}$/.test(body.request_id))
    throw checkout.fail('A valid wallet checkout request ID is required');
  const hash = crypto.createHash('sha256').update(checkout.fingerprint(body, kind) + '|' + String(body.coupon_code ?? '')).digest('hex');
  const txnId = `wallet:${userId}:${body.request_id}`;
  const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!user || !user.isActive) throw checkout.fail('Customer account is unavailable', 403);
  const prior = await Payment.findOne({ where: { gateway: 'wallet', txnId }, transaction });
  if (prior) {
    const order = await Order.findByPk(prior.orderId, { transaction });
    const entry = await WalletTransaction.findOne({ where: { userId, referenceId: prior.orderId, source: 'order_payment', type: 'debit' }, transaction });
    if (!order || order.customerId !== userId || entry?.note !== `Wallet checkout ${hash}`)
      throw checkout.fail('This checkout request was already used for another cart', 409);
    if (prior.status === 'refunded' || order.status === 'cancelled')
      throw checkout.fail('The earlier wallet order was cancelled and refunded. You can place a new order.', 409);
    return { existing: order };
  }
  return { user, txnId, hash };
}

async function debit(checkoutState, order, total, transaction) {
  const amount = Math.round(total * 100); // Order totals are rupees, wallet ledger is paise.
  const balance = Number(checkoutState.user.walletBalance);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw checkout.fail('Invalid order total');
  if (!Number.isSafeInteger(balance) || balance < amount) throw checkout.fail('Insufficient wallet balance. Choose another payment method.', 409);
  const balanceAfter = balance - amount;
  await checkoutState.user.update({ walletBalance: balanceAfter }, { transaction });
  await WalletTransaction.create({
    userId: checkoutState.user.id, type: 'debit', amount, source: 'order_payment', balanceAfter,
    referenceId: order.id, referenceType: 'order', note: `Wallet checkout ${checkoutState.hash}`, createdAt: new Date(),
  }, { transaction });
  await Payment.create({ orderId: order.id, gateway: 'wallet', txnId: checkoutState.txnId, amount: total, status: 'paid' }, { transaction });
}

async function refund(order, transaction) {
  // Lock the balance before checking payment status to serialize simultaneous refunds.
  const user = await User.findByPk(order.customerId, { transaction, lock: transaction.LOCK.UPDATE });
  const payment = await Payment.findOne({ where: { orderId: order.id, gateway: 'wallet' }, transaction, lock: transaction.LOCK.UPDATE });
  if (!payment || payment.status !== 'paid') return;
  if (!user) throw checkout.fail('Customer account not found');
  const amount = Math.round(Number(payment.amount) * 100);
  const balanceAfter = Number(user.walletBalance) + amount;
  if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(balanceAfter)) throw checkout.fail('Invalid wallet refund');
  await user.update({ walletBalance: balanceAfter }, { transaction });
  await WalletTransaction.create({ userId: user.id, type: 'credit', amount, source: 'refund', balanceAfter,
    referenceId: order.id, referenceType: 'order', note: `Refund for cancelled order #${order.id}`, createdAt: new Date(),
  }, { transaction });
  await payment.update({ status: 'refunded', refundedAt: new Date() }, { transaction });
}

module.exports = { begin, debit, refund };
