const router = require('express').Router();
const ctrl   = require('../../controllers/admin/geo.controller');
const { authenticate }  = require('../../middlewares/auth.middleware');
const { requireAdmin }  = require('../../middlewares/admin.middleware');

router.use(authenticate, requireAdmin);

// Countries
router.get   ('/countries',           ctrl.listCountries);
router.post  ('/countries',           ctrl.addCountry);
router.put   ('/countries/:id',       ctrl.editCountry);
router.patch ('/countries/:id/toggle', ctrl.toggleCountry);

// States
router.get   ('/states',              ctrl.listStates);   // ?countryId=1
router.post  ('/states',              ctrl.addState);
router.put   ('/states/:id',          ctrl.editState);
router.patch ('/states/:id/toggle',   ctrl.toggleState);

// Cities
router.get   ('/cities',              ctrl.listCities);   // ?stateId=5
router.post  ('/cities',              ctrl.addCity);
router.put   ('/cities/:id',          ctrl.editCity);
router.patch ('/cities/:id/toggle',   ctrl.toggleCity);

module.exports = router;
