const express = require('express');
const router = express.Router();
const { Message, Conversation } = require('../models/Message');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// @route   GET /api/chat/conversations
// @desc    Get all conversations for current user
// @access  Private
router.get('/conversations', protect, async (req, res) => {
    try {
        const conversations = await Conversation.find({
            participants: req.user._id
        })
            .populate('participants', 'firstName lastName collegeName profilePicture isOnline lastSeen')
            .populate('lastMessage', 'content createdAt sender')
            .sort({ lastMessageAt: -1 });

        // Format conversations for frontend
        const formattedConversations = conversations.map(conv => {
            const otherParticipant = conv.participants.find(
                p => p._id.toString() !== req.user._id.toString()
            );

            return {
                _id: conv._id,
                participant: otherParticipant,
                lastMessage: conv.lastMessage,
                lastMessageAt: conv.lastMessageAt,
                unreadCount: conv.unreadCount.get(req.user._id.toString()) || 0
            };
        });

        res.json({
            success: true,
            data: formattedConversations
        });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch conversations'
        });
    }
});

// @route   GET /api/chat/messages/:conversationId
// @desc    Get messages for a conversation
// @access  Private
router.get('/messages/:conversationId', protect, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        // Verify user is part of conversation
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: req.user._id
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        const messages = await Message.find({
            conversation: conversationId,
            isDeleted: false
        })
            .populate('sender', 'firstName lastName profilePicture')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Message.countDocuments({
            conversation: conversationId,
            isDeleted: false
        });

        // Mark messages as read
        await Message.updateMany(
            {
                conversation: conversationId,
                sender: { $ne: req.user._id },
                'readBy.user': { $ne: req.user._id }
            },
            {
                $push: {
                    readBy: {
                        user: req.user._id,
                        readAt: new Date()
                    }
                }
            }
        );

        // Reset unread count
        await Conversation.findByIdAndUpdate(conversationId, {
            $set: { [`unreadCount.${req.user._id}`]: 0 }
        });

        res.json({
            success: true,
            data: {
                messages: messages.reverse(),
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch messages'
        });
    }
});

// @route   POST /api/chat/send/:userId
// @desc    Send a message to a user (creates conversation if needed)
// @access  Private
router.post('/send/:userId', protect, async (req, res) => {
    try {
        const { userId } = req.params;
        const { content } = req.body;

        if (!content || content.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Message content is required'
            });
        }

        // Verify target user exists and is a connection
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if users are connected
        if (!req.user.connections.includes(userId)) {
            return res.status(403).json({
                success: false,
                message: 'You can only message your connections'
            });
        }

        // Find or create conversation
        const conversation = await Conversation.findOrCreateConversation(
            req.user._id,
            userId
        );

        // Create message
        const message = await Message.create({
            conversation: conversation._id,
            sender: req.user._id,
            content: content.trim(),
            readBy: [{
                user: req.user._id,
                readAt: new Date()
            }]
        });

        // Update conversation
        const currentUnread = conversation.unreadCount.get(userId) || 0;
        await Conversation.findByIdAndUpdate(conversation._id, {
            lastMessage: message._id,
            lastMessageAt: new Date(),
            $set: { [`unreadCount.${userId}`]: currentUnread + 1 }
        });

        // Populate sender info
        await message.populate('sender', 'firstName lastName profilePicture');

        res.json({
            success: true,
            data: {
                message,
                conversationId: conversation._id
            }
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send message'
        });
    }
});

// @route   GET /api/chat/conversation/:userId
// @desc    Get or create conversation with a user
// @access  Private
router.get('/conversation/:userId', protect, async (req, res) => {
    try {
        const { userId } = req.params;

        // Verify target user exists
        const targetUser = await User.findById(userId)
            .select('firstName lastName collegeName profilePicture isOnline lastSeen');

        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if users are connected
        if (!req.user.connections.includes(userId)) {
            return res.status(403).json({
                success: false,
                message: 'You can only message your connections'
            });
        }

        // Find or create conversation
        const conversation = await Conversation.findOrCreateConversation(
            req.user._id,
            userId
        );

        res.json({
            success: true,
            data: {
                conversationId: conversation._id,
                participant: targetUser
            }
        });
    } catch (error) {
        console.error('Get conversation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get conversation'
        });
    }
});

// @route   GET /api/chat/unread
// @desc    Get total unread message count
// @access  Private
router.get('/unread', protect, async (req, res) => {
    try {
        const conversations = await Conversation.find({
            participants: req.user._id
        });

        let totalUnread = 0;
        conversations.forEach(conv => {
            totalUnread += conv.unreadCount.get(req.user._id.toString()) || 0;
        });

        res.json({
            success: true,
            data: { unreadCount: totalUnread }
        });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get unread count'
        });
    }
});

// @route   PUT /api/chat/read/:conversationId
// @desc    Mark all messages in a conversation as read
// @access  Private
router.put('/read/:conversationId', protect, async (req, res) => {
    try {
        const { conversationId } = req.params;

        // Verify user is part of conversation
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: req.user._id
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        // Mark all messages as read
        await Message.updateMany(
            {
                conversation: conversationId,
                sender: { $ne: req.user._id },
                'readBy.user': { $ne: req.user._id }
            },
            {
                $push: {
                    readBy: {
                        user: req.user._id,
                        readAt: new Date()
                    }
                }
            }
        );

        // Reset unread count
        await Conversation.findByIdAndUpdate(conversationId, {
            $set: { [`unreadCount.${req.user._id}`]: 0 }
        });

        res.json({
            success: true,
            message: 'Messages marked as read'
        });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark messages as read'
        });
    }
});

// @route   DELETE /api/chat/message/:messageId
// @desc    Delete a message (soft delete)
// @access  Private
router.delete('/message/:messageId', protect, async (req, res) => {
    try {
        const { messageId } = req.params;

        const message = await Message.findOne({
            _id: messageId,
            sender: req.user._id
        });

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found or you cannot delete this message'
            });
        }

        message.isDeleted = true;
        message.content = 'This message was deleted';
        await message.save();

        res.json({
            success: true,
            message: 'Message deleted'
        });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete message'
        });
    }
});

module.exports = router;
