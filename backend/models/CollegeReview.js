const mongoose = require('mongoose');

const collegeReviewSchema = new mongoose.Schema({
    collegeName: {
        type: String,
        required: [true, 'College name is required'],
        trim: true,
        index: true
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rating: {
        type: Number,
        required: [true, 'Rating is required'],
        min: 1,
        max: 5
    },
    title: {
        type: String,
        required: [true, 'Review title is required'],
        trim: true,
        maxlength: 100
    },
    content: {
        type: String,
        required: [true, 'Review content is required'],
        trim: true,
        maxlength: 2000
    },
    // Specific ratings
    academics: {
        type: Number,
        min: 1,
        max: 5
    },
    faculty: {
        type: Number,
        min: 1,
        max: 5
    },
    infrastructure: {
        type: Number,
        min: 1,
        max: 5
    },
    placements: {
        type: Number,
        min: 1,
        max: 5
    },
    campusLife: {
        type: Number,
        min: 1,
        max: 5
    },
    // Helpful votes
    helpfulVotes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    // Verification status (only verified students can review)
    isVerified: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Ensure one review per user per college
collegeReviewSchema.index({ collegeName: 1, author: 1 }, { unique: true });

// Static method to get average ratings for a college
collegeReviewSchema.statics.getAverageRatings = async function (collegeName) {
    const result = await this.aggregate([
        { $match: { collegeName: collegeName } },
        {
            $group: {
                _id: '$collegeName',
                averageRating: { $avg: '$rating' },
                averageAcademics: { $avg: '$academics' },
                averageFaculty: { $avg: '$faculty' },
                averageInfrastructure: { $avg: '$infrastructure' },
                averagePlacements: { $avg: '$placements' },
                averageCampusLife: { $avg: '$campusLife' },
                totalReviews: { $sum: 1 }
            }
        }
    ]);

    return result[0] || null;
};

module.exports = mongoose.model('CollegeReview', collegeReviewSchema);
