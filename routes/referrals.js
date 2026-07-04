const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const ctrl = require('../controllers/referralController');

router.use(auth, adminOnly);

// Level CRUD
router.get('/settings',         ctrl.getSettings);
router.post('/settings',        ctrl.createLevel);
router.put('/settings/:id',     ctrl.updateLevel);
router.delete('/settings/:id',  ctrl.deleteLevel);

// Stats & mapping
router.get('/stats',              ctrl.getStats);
router.get('/mapping',            ctrl.getMapping);
router.get('/top-earners',        ctrl.getTopEarners);
router.get('/top-referrers',      ctrl.getTopReferrers);

// Buyer line, commission preview, payout history
router.get('/buyer-line/:userId', ctrl.getBuyerLine);
router.get('/commission-preview', ctrl.getCommissionPreview);
router.get('/commission-payouts', ctrl.getCommissionPayouts);

module.exports = router;
