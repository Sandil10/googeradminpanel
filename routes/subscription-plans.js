const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const ctrl = require('../controllers/subscriptionPlansController');

// Public — no auth (excludes free plan)
router.get('/public', ctrl.getPublic);

// Admin CRUD
router.use(authMiddleware, adminOnly);
router.get('/', ctrl.getAll);
router.post('/seed-basic', ctrl.seedBasic);
router.post('/', ctrl.create);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
