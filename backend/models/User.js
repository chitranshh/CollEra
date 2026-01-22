const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        maxlength: 50
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        maxlength: 50
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[\w-\.]+@[\w-]+\.edu\.in$|^[\w-\.]+@[\w-]+\.ac\.in$|^[\w-\.]+@[\w-]+\.edu$/, 'Please use a valid college email (.edu.in, .ac.in, or .edu)']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 8,
        select: false
    },
    collegeName: {
        type: String,
        required: [true, 'College name is required'],
        trim: true
    },
    course: {
        type: String,
        trim: true
    },
    year: {
        type: Number,
        min: 1,
        max: 6
    },
    branch: {
        type: String,
        trim: true
    },
    bio: {
        type: String,
        maxlength: 500
    },
    dob: {
        type: Date
    },
    pronouns: {
        type: String,
        enum: ['he/him', 'she/her', 'they/them', 'other', ''],
        default: ''
    },
    skills: [{
        type: String,
        trim: true
    }],
    interests: [{
        type: String,
        trim: true
    }],
    profilePicture: {
        type: String,
        default: ''
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,
    verificationTokenExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    connections: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    pendingConnections: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    sentRequests: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    linkedIn: String,
    github: String,
    portfolio: String,
    instagram: String,
    leetcode: String,
    hackerrank: String,
    codechef: String,
    profileCompleted: {
        type: Boolean,
        default: false
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastSeen: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Get full name
userSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

// Get college domain from email
userSchema.virtual('collegeDomain').get(function () {
    return this.email.split('@')[1];
});

module.exports = mongoose.model('User', userSchema);
