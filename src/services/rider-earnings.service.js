const { Op }       = require('sequelize');
const sequelize    = require('../config/db');
const Rider        = require('../models/rider.model');
const Order        = require('../models/order.model');
const RiderEarning = require('../models/rider-earning.model');
const RiderPayout  = require('../models/rider-payout.model');
const DutySession  = require('../models/rider-duty-session.model');

const MIN_WITHDRAWAL = 100;

const fail = (message, status) => Object.assign(new Error(message), { status });

const startOf = (range) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === 'week')  d.setDate(d.getDate() - 6);   // today + 6 back = 7 days
  if (range === 'month') d.setDate(d.getDate() - 29);
  if (range === 'all')   return new Date(0);
  return d;
};

const list = async (riderId, range = 'today') => {
  const rows = await RiderEarning.findAll({
    where: { riderId, created_at: { [Op.gte]: startOf(range) } },
    order: [['created_at', 'DESC'], ['id', 'DESC']],
    limit: 200,
  });
  const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);
  return { range, total, count: rows.length, entries: rows };
};

// Balance is derived, never stored: everything earned minus everything paid
// out or in flight. A failed payout doesn't hold money back.
const balanceOf = async (riderId) => {
  const earned = await RiderEarning.sum('amount', { where: { riderId } })          || 0;
  const paid   = await RiderPayout.sum('amount',  { where: { riderId, state: { [Op.ne]: 'failed' } } }) || 0;
  return { earned, paidOut: paid, balance: earned - paid };
};

const summary = async (riderId) => {
  const rider = await Rider.findByPk(riderId, { attributes: ['rating', 'totalDeliveries', 'totalEarnings'] });
  const [today, week, month] = await Promise.all([list(riderId, 'today'), list(riderId, 'week'), list(riderId, 'month')]);
  return {
    ...(await balanceOf(riderId)),
    rating:          rider?.rating ?? null,
    totalDeliveries: rider?.totalDeliveries ?? 0,
    today: { total: today.total, count: today.count },
    week:  { total: week.total,  count: week.count  },
    month: { total: month.total, count: month.count },
    minWithdrawal: MIN_WITHDRAWAL,
  };
};

// Single write path for money in. Every earnings row must also bump the
// cached riders.total_earnings, or the ledger and the counter drift apart —
// which is exactly what happened when a bonus row was inserted on its own.
const creditEarning = async (riderId, { orderId = null, type = 'delivery', fee = 0, incentive = 0, tip = 0, amount, dropArea = null, note = null }, transaction = null) => {
  const total = amount != null ? Math.round(Number(amount)) : (fee + incentive + tip);
  if (!Number.isFinite(total) || total === 0) throw fail('A non-zero amount is required', 400);

  const row = await RiderEarning.create(
    { riderId, orderId, type, fee, incentive, tip, amount: total, dropArea, note },
    transaction ? { transaction } : {},
  );
  await Rider.increment(
    { totalEarnings: total },
    { where: { id: riderId }, ...(transaction ? { transaction } : {}) },
  );
  return row;
};

// ── Payouts ────────────────────────────────────────────────
const listPayouts = (riderId) =>
  RiderPayout.findAll({ where: { riderId }, order: [['created_at', 'DESC']], limit: 100 });

const requestPayout = async (riderId, { amount, method }) => {
  const amt = Math.floor(Number(amount));
  if (!amt || amt <= 0)         throw fail('A positive amount is required', 400);
  if (amt < MIN_WITHDRAWAL)     throw fail(`Minimum withdrawal is Rs.${MIN_WITHDRAWAL}`, 400);
  if (!['bank', 'upi'].includes(method)) throw fail("method must be 'bank' or 'upi'", 400);

  const rider = await Rider.findByPk(riderId);
  if (!rider) throw fail('Rider not found', 404);

  // Snapshot a masked label now so changing bank details later doesn't
  // rewrite the history shown against old payouts.
  let destination;
  if (method === 'bank') {
    if (!rider.bankAccountNo || !rider.bankIfsc) throw fail('Add your bank details before withdrawing', 400);
    destination = `Bank ****${String(rider.bankAccountNo).slice(-4)}`;
  } else {
    if (!rider.upiId) throw fail('Add your UPI ID before withdrawing', 400);
    destination = rider.upiId;
  }

  // Re-check inside the transaction so two taps can't both pass the balance check.
  return sequelize.transaction(async (t) => {
    const earned = await RiderEarning.sum('amount', { where: { riderId }, transaction: t, lock: t.LOCK.UPDATE }) || 0;
    const paid   = await RiderPayout.sum('amount',  { where: { riderId, state: { [Op.ne]: 'failed' } }, transaction: t, lock: t.LOCK.UPDATE }) || 0;
    const balance = earned - paid;
    if (amt > balance) throw fail(`Insufficient balance — you have Rs.${balance}`, 400);

    return RiderPayout.create(
      { riderId, amount: amt, method, destination, state: 'processing' },
      { transaction: t },
    );
  });
};

// ── Performance ────────────────────────────────────────────
const onlineMinutes = async (riderId, since) => {
  const closed = await DutySession.sum('durationMins', {
    where: { riderId, startedAt: { [Op.gte]: since }, endedAt: { [Op.ne]: null } },
  }) || 0;
  // An in-progress session has no duration yet — count it up to now.
  const open = await DutySession.findOne({ where: { riderId, endedAt: null }, order: [['started_at', 'DESC']] });
  const live = open ? Math.max(0, Math.round((Date.now() - new Date(open.startedAt)) / 60000)) : 0;
  return closed + live;
};

const performance = async (riderId) => {
  const rider = await Rider.findByPk(riderId, {
    attributes: ['rating', 'totalDeliveries', 'offeredCount', 'acceptedCount', 'rejectedCount', 'cancelledCount'],
  });
  if (!rider) throw fail('Rider not found', 404);

  const offered   = rider.offeredCount || 0;
  const delivered = await Order.count({ where: { riderId, status: 'delivered' } });
  const cancelled = await Order.count({ where: { riderId, status: 'cancelled' } });
  const finished  = delivered + cancelled;

  // Last 7 days of deliveries + money, one row per day that had activity.
  const [daily] = await sequelize.query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS earnings
       FROM rider_earnings
      WHERE rider_id = :riderId AND type = 'delivery' AND created_at >= :since
      GROUP BY DATE(created_at) ORDER BY day ASC`,
    { replacements: { riderId, since: startOf('week') } },
  );
  const byDay = new Map(daily.map(r => [String(r.day), r]));

  // Emit all 7 days so the app's bar chart never has gaps.
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const weeklyDeliveries = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const hit = byDay.get(key);
    weeklyDeliveries.push({
      date: key, dayLabel: DAYS[d.getDay()],
      count: hit ? Number(hit.count) : 0,
      earnings: hit ? Number(hit.earnings) : 0,
    });
  }

  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const [minsToday, minsWeek] = await Promise.all([
    onlineMinutes(riderId, todayStart),
    onlineMinutes(riderId, startOf('week')),
  ]);

  return {
    rating:           rider.rating,
    totalDeliveries:  rider.totalDeliveries,
    // Null rather than a fake 1.0 when there is nothing to average yet — the
    // app should show "—", not a perfect score the rider hasn't earned.
    acceptanceRate:   offered   ? +(rider.acceptedCount / offered).toFixed(3) : null,
    completionRate:   finished  ? +(delivered / finished).toFixed(3)          : null,
    offeredCount:     offered,
    acceptedCount:    rider.acceptedCount,
    rejectedCount:    rider.rejectedCount,
    cancelledCount:   cancelled,
    onlineHoursToday: +(minsToday / 60).toFixed(2),
    onlineHoursWeek:  +(minsWeek  / 60).toFixed(2),
    weeklyDeliveries,
  };
};

module.exports = { MIN_WITHDRAWAL, list, summary, balanceOf, creditEarning, listPayouts, requestPayout, performance };
