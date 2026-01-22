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
            'firstName', 'lastName', 'name', 'course', 'year', 'branch',
            'bio', 'skills', 'interests', 'linkedIn', 'linkedin',
            'github', 'portfolio', 'profilePicture', 'dob', 'pronouns'
        ];

        const updates = {};
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                // Handle name field - split into firstName and lastName
                if (field === 'name') {
                    const nameParts = req.body[field].split(' ');
                    updates.firstName = nameParts[0] || '';
                    updates.lastName = nameParts.slice(1).join(' ') || '';
                } else if (field === 'linkedin') {
                    updates.linkedIn = req.body[field];
                } else if (field === 'dob' && req.body[field]) {
                    updates.dob = new Date(req.body[field]);
                } else {
                    updates[field] = req.body[field];
                }
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

// @route   DELETE /api/users/account
// @desc    Delete user account permanently
// @access  Private
router.delete('/account', protect, async (req, res) => {
    try {
        const userId = req.user._id;

        // Remove user from all other users' connections, pendingConnections, sentRequests
        await User.updateMany(
            {},
            {
                $pull: {
                    connections: userId,
                    pendingConnections: userId,
                    sentRequests: userId
                }
            }
        );

        // Delete all posts by this user
        const Post = require('../models/Post');
        await Post.deleteMany({ author: userId });

        // Remove user's likes and comments from other posts
        await Post.updateMany(
            {},
            {
                $pull: {
                    likes: userId,
                    comments: { author: userId }
                }
            }
        );

        // Delete the user
        await User.findByIdAndDelete(userId);

        res.json({
            success: true,
            message: 'Account deleted successfully'
        });

    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete account'
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

// @route   GET /api/users/college/:collegeName
// @desc    Get users from a specific college
// @access  Private
router.get('/college/:collegeName', protect, async (req, res) => {
    try {
        const collegeName = decodeURIComponent(req.params.collegeName);
        const { page = 1, limit = 10 } = req.query;

        // Create flexible search query for college name
        const collegeWords = collegeName.split(/\s+/).filter(w => w.length > 2);
        const regexPattern = collegeWords.map(word => `(?=.*${word})`).join('');

        const query = {
            isVerified: true,
            collegeName: new RegExp(regexPattern, 'i')
        };

        const users = await User.find(query)
            .select('firstName lastName collegeName course year bio skills profilePicture isOnline')
            .sort({ isOnline: -1, createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            data: {
                users,
                total,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Get college users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch college users'
        });
    }
});

module.exports = router;
