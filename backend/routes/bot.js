const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');

// Simple supportive responses
const supportiveResponses = [
    "I'm here for you. Can you tell me more about what's troubling you?",
    "It's okay to feel this way. Would you like to talk about it?",
    "Remember, you're not alone. I'm here to listen.",
    "Thank you for sharing. How can I support you right now?",
    "Your feelings are valid. Would you like some advice or just someone to listen?"
];

function getBotName(gender) {
    // Jake for female, Mary for male
    if (gender === 'female') return 'Jake';
    if (gender === 'male') return 'Mary';
    return 'SupportBot';
}

// @route POST /api/bot/chat
// @desc Chat with mental health bot
// @access Private
router.post('/chat', protect, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || message.trim() === '') {
            return res.status(400).json({ success: false, message: 'Message is required.' });
        }
        const user = await User.findById(req.user._id);
        // Determine gender from pronouns or add a gender field if needed
        let gender = 'other';
        if (user.pronouns === 'she/her') gender = 'female';
        else if (user.pronouns === 'he/him') gender = 'male';
        // Pick a supportive response
        const response = supportiveResponses[Math.floor(Math.random() * supportiveResponses.length)];
        res.json({
            success: true,
            bot: getBotName(gender),
            response
        });
    } catch (error) {
        console.error('Bot chat error:', error);
        res.status(500).json({ success: false, message: 'Bot failed to respond.' });
    }
});

module.exports = router;
