const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const ctrl = require('../controllers/subscriptionPlansController');

// Public — no auth
router.get('/public', ctrl.getPublic);

// Admin CRUD
router.use(authMiddleware, adminOnly);
router.get('/', ctrl.getAll);
router.get('/purchases', ctrl.getPurchases);
router.post('/seed-basic', ctrl.seedBasic);
router.post('/assign', ctrl.assignPlan);
router.delete('/assign/:userId', ctrl.removeAssign);
router.patch('/purchases/:id/toggle-status', ctrl.togglePurchaseStatus);
router.patch('/assign-badge/:userId', ctrl.assignVerificationBadge);
router.post('/', ctrl.create);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
