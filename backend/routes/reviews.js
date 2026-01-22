const express = require('express');
const router = express.Router();
const CollegeReview = require('../models/CollegeReview');
const { protect } = require('../middleware/auth');

// @route   GET /api/reviews/public/:collegeName
// @desc    Get all reviews for a specific college (PUBLIC - no auth required)
// @access  Public
router.get('/public/:collegeName', async (req, res) => {
    try {
        const collegeName = decodeURIComponent(req.params.collegeName);
        const { page = 1, limit = 10, sort = '-createdAt' } = req.query;

        const reviews = await CollegeReview.find({ collegeName })
            .populate('author', 'firstName lastName collegeName')
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await CollegeReview.countDocuments({ collegeName });
        const averageRatings = await CollegeReview.getAverageRatings(collegeName);

        res.json({
            success: true,
            data: {
                reviews,
                averageRatings,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Get public reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch reviews'
        });
    }
});

// @route   GET /api/reviews/:collegeName
// @desc    Get all reviews for a specific college
// @access  Private
router.get('/:collegeName', protect, async (req, res) => {
    try {
        const collegeName = decodeURIComponent(req.params.collegeName);
        const { page = 1, limit = 10, sort = '-createdAt' } = req.query;

        const reviews = await CollegeReview.find({ collegeName })
            .populate('author', 'firstName lastName collegeName profilePicture')
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await CollegeReview.countDocuments({ collegeName });
        const averageRatings = await CollegeReview.getAverageRatings(collegeName);

        res.json({
            success: true,
            data: {
                reviews,
                averageRatings,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch reviews'
        });
    }
});

// @route   POST /api/reviews
// @desc    Create a new review (only for own college)
// @access  Private
router.post('/', protect, async (req, res) => {
    try {
        const { collegeName, rating, title, content, academics, faculty, infrastructure, placements, campusLife } = req.body;

        // Normalize college names for comparison (case-insensitive)
        const userCollege = req.user.collegeName.toLowerCase().trim();
        const reviewCollege = collegeName.toLowerCase().trim();

        // Check if user belongs to this college
        if (!userCollege.includes(reviewCollege) && !reviewCollege.includes(userCollege)) {
            // More flexible matching - check for common keywords
            const userWords = userCollege.split(/\s+/);
            const reviewWords = reviewCollege.split(/\s+/);
            const commonWords = userWords.filter(word =>
                word.length > 3 && reviewWords.some(rw => rw.includes(word) || word.includes(rw))
            );

            if (commonWords.length < 2) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only review your own college'
                });
            }
        }

        // Check if user already reviewed this college
        const existingReview = await CollegeReview.findOne({
            author: req.user._id,
            collegeName: collegeName
        });

        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: 'You have already reviewed this college. You can edit your existing review.'
            });
        }

        const review = await CollegeReview.create({
            collegeName,
            author: req.user._id,
            rating,
            title,
            content,
            academics,
            faculty,
            infrastructure,
            placements,
            campusLife
        });

        await review.populate('author', 'firstName lastName collegeName profilePicture');

        res.status(201).json({
            success: true,
            message: 'Review submitted successfully',
            data: { review }
        });

    } catch (error) {
        console.error('Create review error:', error);
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'You have already reviewed this college'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Failed to submit review'
        });
    }
});

// @route   PUT /api/reviews/:id
// @desc    Update a review (only by author)
// @access  Private
router.put('/:id', protect, async (req, res) => {
    try {
        const review = await CollegeReview.findById(req.params.id);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        if (review.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You can only edit your own reviews'
            });
        }

        const { rating, title, content, academics, faculty, infrastructure, placements, campusLife } = req.body;

        review.rating = rating || review.rating;
        review.title = title || review.title;
        review.content = content || review.content;
        review.academics = academics || review.academics;
        review.faculty = faculty || review.faculty;
        review.infrastructure = infrastructure || review.infrastructure;
        review.placements = placements || review.placements;
        review.campusLife = campusLife || review.campusLife;

        await review.save();
        await review.populate('author', 'firstName lastName collegeName profilePicture');

        res.json({
            success: true,
            message: 'Review updated successfully',
            data: { review }
        });

    } catch (error) {
        console.error('Update review error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update review'
        });
    }
});

// @route   DELETE /api/reviews/:id
// @desc    Delete a review (only by author)
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    try {
        const review = await CollegeReview.findById(req.params.id);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        if (review.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete your own reviews'
            });
        }

        await review.deleteOne();

        res.json({
            success: true,
            message: 'Review deleted successfully'
        });

    } catch (error) {
        console.error('Delete review error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete review'
        });
    }
});

// @route   POST /api/reviews/:id/helpful
// @desc    Mark a review as helpful
// @access  Private
router.post('/:id/helpful', protect, async (req, res) => {
    try {
        const review = await CollegeReview.findById(req.params.id);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        const hasVoted = review.helpfulVotes.includes(req.user._id);

        if (hasVoted) {
            // Remove vote
            review.helpfulVotes = review.helpfulVotes.filter(
                id => id.toString() !== req.user._id.toString()
            );
        } else {
            // Add vote
            review.helpfulVotes.push(req.user._id);
        }

        await review.save();

        res.json({
            success: true,
            data: {
                helpfulCount: review.helpfulVotes.length,
                hasVoted: !hasVoted
            }
        });

    } catch (error) {
        console.error('Helpful vote error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update vote'
        });
    }
});

// @route   GET /api/reviews/user/my-reviews
// @desc    Get current user's reviews
// @access  Private
router.get('/user/my-reviews', protect, async (req, res) => {
    try {
        const reviews = await CollegeReview.find({ author: req.user._id })
            .sort('-createdAt');

        res.json({
            success: true,
            data: { reviews }
        });

    } catch (error) {
        console.error('Get my reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch your reviews'
        });
    }
});

module.exports = router;
