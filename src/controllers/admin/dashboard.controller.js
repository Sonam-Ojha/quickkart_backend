const svc = require('../../services/dashboard.service');
const getData = async (req, res) => {
  try {
    const [kpis, statusDist, weeklyChart, recentOrders, topProducts] = await Promise.all([
      svc.getKpis(),
      svc.getOrderStatusDist(),
      svc.getWeeklyChart(),
      svc.getRecentOrders(),
      svc.getTopProducts(),
    ]);
    res.json({ kpis, statusDist, weeklyChart, recentOrders, topProducts });
  } catch (e) { res.status(500).json({ message: e.message }); }
};
module.exports = { getData };
