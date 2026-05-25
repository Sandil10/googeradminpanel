const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.post('/presence', chatController.updatePresence);
router.get('/messages/:participantId', chatController.getMessages);
router.post('/messages', chatController.sendMessage);

module.exports = router;
