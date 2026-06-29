const router = require('express').Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const ctrl = require('../../controllers/admin/faq.controller');

// GET    /api/admin/faqs          — list (optional ?page=print)
// POST   /api/admin/faqs          — create
// PUT    /api/admin/faqs/:id      — update
// PATCH  /api/admin/faqs/:id/toggle — toggle active
// DELETE /api/admin/faqs/:id      — delete

router.get('/',               authenticate, ctrl.list);
router.post('/',              authenticate, ctrl.create);
router.put('/:id',            authenticate, ctrl.update);
router.patch('/:id/toggle',   authenticate, ctrl.toggle);
router.delete('/:id',         authenticate, ctrl.remove);

module.exports = router;
