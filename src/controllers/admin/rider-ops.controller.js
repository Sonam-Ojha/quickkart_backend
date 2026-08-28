const { Op }              = require('sequelize');
const sequelize           = require('../../config/db');
const Rider               = require('../../models/rider.model');
const RiderPayout         = require('../../models/rider-payout.model');
const RiderNotification   = require('../../models/rider-notification.model');
const RiderSupportMessage = require('../../models/rider-support-message.model');
const earningsSvc         = require('../../services/rider-earnings.service');

const send = (res, err) => res.status(err.status || 500).json({ message: err.message });
const RIDER_ATTRS = ['id', 'name', 'mobile'];

const findRider = async (id) => {
  const rider = await Rider.findByPk(id);
  if (!rider) throw Object.assign(new Error('Rider not found'), { status: 404 });
  return rider;
};

// ── Payouts ─────────────────────────────────────────────────
const listPayouts = async (req, res) => {
  try {
    const { state, riderId } = req.query;
    const where = {};
    if (state && state !== 'all') where.state = state;
    if (riderId) where.riderId = riderId;

    const payouts = await RiderPayout.findAll({
      where,
      include: [{ model: Rider, as: 'rider', attributes: RIDER_ATTRS }],
      order: [['created_at', 'DESC']],
      limit: 200,
    });
    const pendingTotal = await RiderPayout.sum('amount', { where: { state: 'processing' } }) || 0;
    res.json({ payouts, pendingTotal });
  } catch (err) { send(res, err); }
};

// processing → paid | failed. Terminal states are final: re-marking a paid
// payout would double-count against the rider's balance.
const updatePayout = async (req, res) => {
  try {
    const { state, reference, failureReason } = req.body;
    if (!['paid', 'failed'].includes(state)) {
      return res.status(400).json({ message: "state must be 'paid' or 'failed'" });
    }
    if (state === 'failed' && !failureReason) {
      return res.status(400).json({ message: 'failureReason is required when failing a payout' });
    }

    const payout = await RiderPayout.findByPk(req.params.id);
    if (!payout) return res.status(404).json({ message: 'Payout not found' });
    if (payout.state !== 'processing') {
      return res.status(409).json({ message: `Payout is already ${payout.state}` });
    }

    await payout.update({
      state,
      reference:     state === 'paid'   ? (reference || null) : null,
      failureReason: state === 'failed' ? failureReason       : null,
      processedAt:   new Date(),
    });

    await RiderNotification.create({
      riderId: payout.riderId,
      type: 'payout',
      title: state === 'paid' ? `Rs.${payout.amount} paid out` : `Withdrawal of Rs.${payout.amount} failed`,
      body:  state === 'paid'
        ? `Sent to ${payout.destination}.${reference ? ` Ref: ${reference}` : ''}`
        : `${failureReason}. The amount is back in your balance.`,
    });

    // A failed payout is excluded from paidOut, so the balance recovers on its own.
    res.json({ message: `Payout ${state}`, payout, ...(await earningsSvc.balanceOf(payout.riderId)) });
  } catch (err) { send(res, err); }
};

// ── Support ─────────────────────────────────────────────────
// One row per rider who has ever written in, newest activity first.
const supportThreads = async (_req, res) => {
  try {
    const [rows] = await sequelize.query(`
      SELECT m.rider_id AS riderId, r.name, r.mobile,
             COUNT(*) AS messages,
             MAX(m.created_at) AS lastAt,
             SUM(m.sender = 'rider') AS fromRider
        FROM rider_support_messages m
        JOIN riders r ON r.id = m.rider_id
       GROUP BY m.rider_id, r.name, r.mobile
       ORDER BY lastAt DESC
       LIMIT 100`);
    res.json({ threads: rows });
  } catch (err) { send(res, err); }
};

const supportThread = async (req, res) => {
  try {
    await findRider(req.params.riderId);
    const messages = await RiderSupportMessage.findAll({
      where: { riderId: req.params.riderId },
      order: [['created_at', 'ASC'], ['id', 'ASC']],
      limit: 500,
    });
    res.json({ messages });
  } catch (err) { send(res, err); }
};

const supportReply = async (req, res) => {
  try {
    const rider = await findRider(req.params.riderId);
    const text = String(req.body?.message ?? '').trim();
    if (!text) return res.status(400).json({ message: 'message is required' });
    if (text.length > 2000) return res.status(400).json({ message: 'message must be under 2000 characters' });

    const message = await RiderSupportMessage.create({ riderId: rider.id, sender: 'agent', message: text });
    await RiderNotification.create({
      riderId: rider.id, type: 'announcement',
      title: 'Support replied', body: text.slice(0, 160),
    });
    res.status(201).json({ message });
  } catch (err) { send(res, err); }
};

// ── Manual credit / debit ───────────────────────────────────
const addEarning = async (req, res) => {
  try {
    const rider = await findRider(req.params.riderId);
    const { amount, type = 'bonus', note } = req.body;
    if (!['bonus', 'adjustment'].includes(type)) {
      return res.status(400).json({ message: "type must be 'bonus' or 'adjustment'" });
    }
    // Adjustments may be negative (clawback); a bonus may not.
    const amt = Math.round(Number(amount));
    if (!Number.isFinite(amt) || amt === 0) return res.status(400).json({ message: 'A non-zero amount is required' });
    if (type === 'bonus' && amt < 0) return res.status(400).json({ message: 'A bonus cannot be negative' });

    if (amt < 0) {
      const { balance } = await earningsSvc.balanceOf(rider.id);
      if (balance + amt < 0) return res.status(400).json({ message: `Adjustment would push the balance negative (balance Rs.${balance})` });
    }

    const entry = await earningsSvc.creditEarning(rider.id, { type, amount: amt, note: note || null });
    await RiderNotification.create({
      riderId: rider.id, type: 'payout',
      title: amt > 0 ? `Rs.${amt} added` : `Rs.${Math.abs(amt)} deducted`,
      body:  note || (amt > 0 ? 'A bonus has been credited to your earnings.' : 'An adjustment was applied to your earnings.'),
    });
    res.status(201).json({ message: 'Earning recorded', entry, ...(await earningsSvc.balanceOf(rider.id)) });
  } catch (err) { send(res, err); }
};

// ── Push a notification ─────────────────────────────────────
const notify = async (req, res) => {
  try {
    const { title, body, type = 'announcement', riderIds } = req.body;
    if (!title || !body) return res.status(400).json({ message: 'title and body are required' });
    if (!['new_order', 'payout', 'announcement'].includes(type)) {
      return res.status(400).json({ message: 'Invalid notification type' });
    }

    // No riderIds -> broadcast to every active rider.
    const targets = Array.isArray(riderIds) && riderIds.length
      ? await Rider.findAll({ where: { id: { [Op.in]: riderIds } }, attributes: ['id'] })
      : await Rider.findAll({ where: { status: 'active' }, attributes: ['id'] });
    if (!targets.length) return res.status(404).json({ message: 'No matching riders' });

    await RiderNotification.bulkCreate(targets.map(r => ({ riderId: r.id, type, title, body })));
    res.status(201).json({ message: 'Notification sent', sent: targets.length });
  } catch (err) { send(res, err); }
};

module.exports = { listPayouts, updatePayout, supportThreads, supportThread, supportReply, addEarning, notify };
