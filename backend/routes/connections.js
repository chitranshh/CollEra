const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// @route   POST /api/connections/request/:userId
// @desc    Send connection request
// @access  Private
router.post('/request/:userId', protect, async (req, res) => {
    try {
        const targetUserId = req.params.userId;

        if (targetUserId === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: "You can't connect with yourself"
            });
        }

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if already connected
        if (req.user.connections.includes(targetUserId)) {
            return res.status(400).json({
                success: false,
                message: 'Already connected with this user'
            });
        }

        // Check if request already sent
        if (req.user.sentRequests.includes(targetUserId)) {
            return res.status(400).json({
                success: false,
                message: 'Connection request already sent'
            });
        }

        // Add to sent requests
        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: { sentRequests: targetUserId }
        });

        // Add to target's pending connections
        await User.findByIdAndUpdate(targetUserId, {
            $addToSet: { pendingConnections: req.user._id }
        });

        res.json({
            success: true,
            message: 'Connection request sent!'
        });

    } catch (error) {
        console.error('Send request error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send connection request'
        });
    }
});

// @route   POST /api/connections/accept/:userId
// @desc    Accept connection request
// @access  Private
router.post('/accept/:userId', protect, async (req, res) => {
    try {
        const requesterId = req.params.userId;

        // Check if request exists
        if (!req.user.pendingConnections.includes(requesterId)) {
            return res.status(400).json({
                success: false,
                message: 'No pending request from this user'
            });
        }

        // Remove from pending and add to connections for current user
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { pendingConnections: requesterId },
            $addToSet: { connections: requesterId }
        });

        // Remove from sent requests and add to connections for requester
        await User.findByIdAndUpdate(requesterId, {
            $pull: { sentRequests: req.user._id },
            $addToSet: { connections: req.user._id }
        });

        res.json({
            success: true,
            message: 'Connection accepted!'
        });

    } catch (error) {
        console.error('Accept request error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to accept connection request'
        });
    }
});

// @route   POST /api/connections/reject/:userId
// @desc    Reject connection request
// @access  Private
router.post('/reject/:userId', protect, async (req, res) => {
    try {
        const requesterId = req.params.userId;

        // Remove from pending
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { pendingConnections: requesterId }
        });

        // Remove from sent requests
        await User.findByIdAndUpdate(requesterId, {
            $pull: { sentRequests: req.user._id }
        });

        res.json({
            success: true,
            message: 'Connection request rejected'
        });

    } catch (error) {
        console.error('Reject request error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reject connection request'
        });
    }
});

// @route   DELETE /api/connections/:userId
// @desc    Remove connection
// @access  Private
router.delete('/:userId', protect, async (req, res) => {
    try {
        const connectionId = req.params.userId;

        // Remove from both users' connections
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { connections: connectionId }
        });

        await User.findByIdAndUpdate(connectionId, {
            $pull: { connections: req.user._id }
        });

        res.json({
            success: true,
            message: 'Connection removed'
        });

    } catch (error) {
        console.error('Remove connection error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove connection'
        });
    }
});

// @route   GET /api/connections
// @desc    Get all connections
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('connections', 'firstName lastName email collegeName course year profilePicture isOnline lastSeen skills');

        res.json({
            success: true,
            data: {
                connections: user.connections
            }
        });

    } catch (error) {
        console.error('Get connections error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch connections'
        });
    }
});

// @route   GET /api/connections/pending
// @desc    Get pending connection requests
// @access  Private
router.get('/pending', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('pendingConnections', 'firstName lastName email collegeName course year profilePicture skills');

        res.json({
            success: true,
            data: {
                pendingConnections: user.pendingConnections
            }
        });

    } catch (error) {
        console.error('Get pending error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending requests'
        });
    }
});

// @route   GET /api/connections/sent
// @desc    Get sent connection requests
// @access  Private
router.get('/sent', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('sentRequests', 'firstName lastName email collegeName course year profilePicture');

        res.json({
            success: true,
            data: {
                sentRequests: user.sentRequests
            }
        });

    } catch (error) {
        console.error('Get sent requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch sent requests'
        });
    }
});

module.exports = router;
