const svc = require('../../services/dashboard.service');
const getData = async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : null;
    const toDate   = to   ? new Date(to)   : null;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    const [kpis, statusDist, chart, recentOrders, topProducts] = await Promise.all([
      svc.getKpis(fromDate, toDate),
      svc.getOrderStatusDist(fromDate, toDate),
      fromDate ? svc.getRangeChart(fromDate, toDate) : svc.getWeeklyChart(),
      svc.getRecentOrders(fromDate, toDate),
      svc.getTopProducts(fromDate, toDate),
    ]);
    res.json({ kpis, statusDist, weeklyChart: chart, recentOrders, topProducts });
  } catch (e) { res.status(500).json({ message: e.message }); }
};
module.exports = { getData };
