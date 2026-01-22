const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// @route   GET /api/users
// @desc    Get all users (with filters)
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            college,
            course,
            year,
            skills,
            search
        } = req.query;

        const query = {
            _id: { $ne: req.user._id },
            isVerified: true
        };

        // Apply filters
        if (college) query.collegeName = new RegExp(college, 'i');
        if (course) query.course = new RegExp(course, 'i');
        if (year) query.year = parseInt(year);
        if (skills) query.skills = { $in: skills.split(',').map(s => new RegExp(s.trim(), 'i')) };
        if (search) {
            query.$or = [
                { firstName: new RegExp(search, 'i') },
                { lastName: new RegExp(search, 'i') },
                { collegeName: new RegExp(search, 'i') },
                { skills: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        const users = await User.find(query)
            .select('firstName lastName email collegeName course year bio skills profilePicture isOnline lastSeen')
            .sort({ isOnline: -1, lastSeen: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            data: {
                users,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password -verificationToken -resetPasswordToken')
            .populate('connections', 'firstName lastName collegeName profilePicture isOnline');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check connection status
        const isConnected = req.user.connections.includes(user._id);
        const isPending = req.user.sentRequests.includes(user._id);
        const hasRequest = req.user.pendingConnections.includes(user._id);

        res.json({
            success: true,
            data: {
                user,
                connectionStatus: isConnected ? 'connected' : isPending ? 'pending' : hasRequest ? 'received' : 'none'
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user'
        });
    }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
    try {
        const allowedFields = [
            'firstName', 'lastName', 'course', 'year',
            'bio', 'skills', 'interests', 'linkedIn',
            'github', 'portfolio', 'profilePicture'
        ];

        const updates = {};
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        const user = await User.findByIdAndUpdate(
            req.user._id,
            updates,
            { new: true, runValidators: true }
        ).select('-password -verificationToken -resetPasswordToken');

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: { user }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile'
        });
    }
});

// @route   GET /api/users/suggestions/smart
// @desc    Get smart connection suggestions
// @access  Private
router.get('/suggestions/smart', protect, async (req, res) => {
    try {
        const currentUser = req.user;

        // Find users from same college
        const sameCollege = await User.find({
            _id: {
                $ne: currentUser._id,
                $nin: [...currentUser.connections, ...currentUser.sentRequests]
            },
            isVerified: true,
            collegeName: currentUser.collegeName
        })
            .select('firstName lastName collegeName course year skills profilePicture isOnline')
            .limit(5);

        // Find users with similar skills
        const similarSkills = await User.find({
            _id: {
                $ne: currentUser._id,
                $nin: [...currentUser.connections, ...currentUser.sentRequests, ...sameCollege.map(u => u._id)]
            },
            isVerified: true,
            skills: { $in: currentUser.skills }
        })
            .select('firstName lastName collegeName course year skills profilePicture isOnline')
            .limit(5);

        // Find users in same course
        const sameCourse = await User.find({
            _id: {
                $ne: currentUser._id,
                $nin: [...currentUser.connections, ...currentUser.sentRequests, ...sameCollege.map(u => u._id), ...similarSkills.map(u => u._id)]
            },
            isVerified: true,
            course: currentUser.course
        })
            .select('firstName lastName collegeName course year skills profilePicture isOnline')
            .limit(5);

        res.json({
            success: true,
            data: {
                sameCollege,
                similarSkills,
                sameCourse
            }
        });

    } catch (error) {
        console.error('Get suggestions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch suggestions'
        });
    }
});

module.exports = router;
