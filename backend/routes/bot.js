const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');

const axios = require('axios');
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

function getBotName(gender) {
    // Jake for female, Mary for male, Mental Health Bot for prefer not to say
    if (gender === 'female') return 'Jake';
    if (gender === 'male') return 'Mary';
    return 'Mental Health Bot';
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
        // Use gender field only
        let gender = user.gender || 'prefer_not_to_say';
        const botName = getBotName(gender);
        try {
            const groqRes = await axios.post(GROQ_API_URL, {
                model: 'mixtral-8x7b-32768',
                messages: [
                    { role: 'system', content: `You are ${botName}, a warm, empathetic, and conversational mental health supporter for college students. Your goal is to make users feel truly heard, understood, and cared for. Respond with natural, human-like language, ask gentle follow-up questions, and offer comfort, encouragement, and practical advice. Be friendly, non-judgmental, and supportive, especially on sensitive topics. Make every reply feel like a real, caring human conversation. Always reply in the same language as the user, and support any language they use.` },
                    { role: 'user', content: message }
                ],
                max_tokens: 256,
                temperature: 0.85
            }, {
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            const response = groqRes.data.choices[0].message.content;
            res.json({
                success: true,
                bot: botName,
                response
            });
        } catch (err) {
            console.error('Groq API error:', err?.response?.data || err);
            res.json({
                success: true,
                bot: botName,
                response: "I'm here for you. Can you tell me more about what's troubling you?" // fallback
            });
        }
    } catch (error) {
        console.error('Bot chat error:', error);
        res.status(500).json({ success: false, message: 'Bot failed to respond.' });
    }
});

module.exports = router;
