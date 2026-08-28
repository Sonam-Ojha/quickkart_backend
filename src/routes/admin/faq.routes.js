const router = require('express').Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin }  = require('../../middlewares/admin.middleware');
const ctrl = require('../../controllers/admin/faq.controller');

// GET    /api/admin/faqs          — list (optional ?page=print)
// POST   /api/admin/faqs          — create
// PUT    /api/admin/faqs/:id      — update
// PATCH  /api/admin/faqs/:id/toggle — toggle active
// DELETE /api/admin/faqs/:id      — delete

router.get('/',               authenticate, requireAdmin, ctrl.list);
router.post('/',              authenticate, requireAdmin, ctrl.create);
router.put('/:id',            authenticate, requireAdmin, ctrl.update);
router.patch('/:id/toggle',   authenticate, requireAdmin, ctrl.toggle);
router.delete('/:id',         authenticate, requireAdmin, ctrl.remove);

module.exports = router;
