const svc      = require('../../services/order.service');
const Order    = require('../../models/order.model');
const Rider    = require('../../models/rider.model');
const dispatch = require('../../services/rider-dispatch.service');

const stats = async (req, res) => {
  try { res.json(await svc.getStats()); }
  catch (err) { res.status(500).json({ message: err.message }); }
};

const list = async (req, res) => {
  try { res.json(await svc.list(req.query)); }
  catch (err) { res.status(500).json({ message: err.message }); }
};

const detail = async (req, res) => {
  try { res.json({ order: await svc.getById(req.params.id) }); }
  catch (err) { res.status(404).json({ message: err.message }); }
};

const updateStatus = async (req, res) => {
  try {
    const order = await svc.updateStatus(req.params.id, req.body.status, req.body.note);

    // Confirming an order is what puts it in front of riders. Best-effort: a
    // dispatch failure (no online riders, say) must not fail the status change.
    let dispatched;
    if (req.body.status === 'confirmed' && !order.riderId) {
      dispatched = await dispatch.offerOrder(order.id).catch(err => ({ offered: 0, reason: err.message }));
    }
    res.json({ order, ...(dispatched ? { dispatched } : {}) });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

// Push an order to riders again — for when the first round all lapsed.
const redispatch = async (req, res) => {
  try { res.json(await dispatch.offerOrder(req.params.id)); }
  catch (err) { res.status(400).json({ message: err.message }); }
};

const assignRider = async (req, res) => {
  try {
    const { riderId } = req.body;
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (riderId) {
      const rider = await Rider.findByPk(riderId);
      if (!rider) return res.status(404).json({ message: 'Rider not found' });
      if (rider.status !== 'active') return res.status(400).json({ message: 'Rider is not active' });
    }

    await order.update(riderId
      ? { riderId, riderStage: 'accepted', assignedAt: new Date(), acceptedAt: new Date(), ...dispatch.computePayout(order) }
      : { riderId: null, riderStage: null });
    const updated = await svc.getById(order.id);
    res.json({ message: riderId ? 'Rider assigned' : 'Rider unassigned', order: updated });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

module.exports = { stats, list, detail, updateStatus, assignRider, redispatch };
