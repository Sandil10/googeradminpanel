const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const customizationController = require('../controllers/customizationController');
const adCoinController = require('../controllers/adCoinController');
const categoryCommissionController = require('../controllers/categoryCommissionController');
const promoCodeController = require('../controllers/promoCodeController');
const reachSettingsController = require('../controllers/reachSettingsController');
const reachTiersController = require('../controllers/reachTiersController');
const referralCommissionController = require('../controllers/referralCommissionController');

router.get('/public-overview', customizationController.getPublicCustomizationOverview);
router.get('/reach-settings/public', reachSettingsController.getPublic);
router.get('/reach-tiers/public', reachTiersController.getPublic);

router.use(authMiddleware, adminOnly);

router.get('/overview', customizationController.getCustomizationOverview);
router.get('/categories', customizationController.getCustomizationOverview);
router.post('/categories', customizationController.createCategory);
router.patch('/categories/:id', customizationController.updateCategory);
router.delete('/categories/:id', customizationController.deleteCategory);
router.get('/commissions', customizationController.getCommissionSettings);
router.put('/google-commission', customizationController.updateGoogleCommission);
router.delete('/google-commission', customizationController.resetGoogleCommission);
router.put('/ad-commission', customizationController.updateAdCommission);
router.get('/ad-coin-rewards', adCoinController.getRewardSettings);
router.put('/ad-coin-rewards', adCoinController.updateRewardSettings);
router.patch('/categories/:id/commission', categoryCommissionController.updateCategoryCommission);

// Reach settings (legacy per-ad-type)
router.get('/reach-settings', reachSettingsController.getAll);
router.patch('/reach-settings/:ad_type', reachSettingsController.update);

// Reach tiers (budget-range based)
router.get('/reach-tiers', reachTiersController.getAll);
router.post('/reach-tiers', reachTiersController.create);
router.patch('/reach-tiers/:id', reachTiersController.update);
router.patch('/reach-tiers/:id/max-reach-cap', reachTiersController.setMaxReachCap);
router.delete('/reach-tiers/:id', reachTiersController.remove);

// Referral level distribution settings
router.get('/referral-level-settings',            referralCommissionController.getLevels);
router.post('/referral-level-settings',           referralCommissionController.addLevel);
router.post('/referral-level-settings/bulk',      referralCommissionController.bulkSaveLevels);
router.put('/referral-level-settings/:level',     referralCommissionController.updateLevel);
router.delete('/referral-level-settings/:level',  referralCommissionController.deleteLevel);

// Referral commission pool settings
router.get('/referral-commission-settings',  referralCommissionController.getCommissionSettings);
router.put('/referral-commission-settings',  referralCommissionController.updateCommissionSettings);

// Promo code admin CRUD
router.get('/promo-codes', promoCodeController.getAll);
router.post('/promo-codes', promoCodeController.create);
router.patch('/promo-codes/:id', promoCodeController.update);
router.delete('/promo-codes/:id', promoCodeController.remove);

module.exports = router;
