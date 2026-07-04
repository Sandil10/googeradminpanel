const express = require('express');
const router = express.Router();
const customizationController = require('../controllers/customizationController');
const categoryCommissionController = require('../controllers/categoryCommissionController');

router.get('/tree', customizationController.getPublicCategoryTree);
router.get('/:id/commission', categoryCommissionController.getCategoryCommission);

module.exports = router;
