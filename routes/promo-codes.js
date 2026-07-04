const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const promoCodeController = require('../controllers/promoCodeController');

// Validate a promo code (called by the app before ad submission)
router.post('/validate', authMiddleware, promoCodeController.validate);

// Redeem a promo code (called when ad is confirmed/submitted)
router.post('/redeem', authMiddleware, promoCodeController.redeem);

module.exports = router;
