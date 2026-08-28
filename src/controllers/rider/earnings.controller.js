const svc = require('../../services/rider-earnings.service');

const send = (res, err) => res.status(err.status || 500).json({ message: err.message });

const list = async (req, res) => {
  try { res.json(await svc.list(req.rider.id, req.query.range)); }
  catch (err) { send(res, err); }
};

const summary = async (req, res) => {
  try { res.json(await svc.summary(req.rider.id)); }
  catch (err) { send(res, err); }
};

const performance = async (req, res) => {
  try { res.json(await svc.performance(req.rider.id)); }
  catch (err) { send(res, err); }
};

const listPayouts = async (req, res) => {
  try { res.json({ payouts: await svc.listPayouts(req.rider.id), ...(await svc.balanceOf(req.rider.id)) }); }
  catch (err) { send(res, err); }
};

const requestPayout = async (req, res) => {
  try {
    const payout = await svc.requestPayout(req.rider.id, req.body);
    res.status(201).json({ message: 'Withdrawal requested', payout, ...(await svc.balanceOf(req.rider.id)) });
  } catch (err) { send(res, err); }
};

module.exports = { list, summary, performance, listPayouts, requestPayout };
