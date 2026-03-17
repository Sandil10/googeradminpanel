const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Create test link
router.post('/test-link', async (req, res) => {
    try {
        const { link } = req.body;
        // Logic to store test link (assuming a 'posts' or 'test_links' table)
        // For now, let's just log it or return success
        console.log('Test link received:', link);
        res.json({ success: true, message: 'Test link added successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
