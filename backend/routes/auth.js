const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const dns = require('dns').promises;
const User = require('../models/User');
const { generateToken, protect, optionalAuth } = require('../middleware/auth');
const { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/emailService');

// Validate email format (catches edge cases like dots before @)
const isValidEmailFormat = (email) => {
    // RFC 5322 compliant email regex (simplified but covers common edge cases)
    const emailRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;

    // Additional checks
    if (!email || typeof email !== 'string') return false;
    if (email.includes('..')) return false; // No consecutive dots
    if (email.includes('.@')) return false; // No dot before @
    if (email.includes('@.')) return false; // No dot after @
    if (email.startsWith('.')) return false; // No leading dot

    return emailRegex.test(email);
};

// Check if email domain has valid MX records (mail servers exist)
const verifyEmailDomain = async (email) => {
    const domain = email.split('@')[1];
    if (!domain) return { valid: false, reason: 'Invalid email format' };

    try {
        // Check for MX records (mail exchange servers)
        const mxRecords = await dns.resolveMx(domain);
        if (mxRecords && mxRecords.length > 0) {
            return { valid: true };
        }
        return { valid: false, reason: 'Email domain does not accept emails' };
    } catch (error) {
        if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
            return { valid: false, reason: 'Email domain does not exist' };
        }
        // For other errors (network issues), allow the email to pass
        console.log('DNS lookup warning:', error.message);
        return { valid: true }; // Don't block on DNS errors
    }
};

// List of valid Indian college email domains (can be expanded)
const isValidCollegeEmail = (email) => {
    const domain = email.split('@')[1];
    const validPatterns = [
        /\.edu\.in$/,
        /\.ac\.in$/,
        /\.edu$/,
        /iit[a-z]*\.ac\.in$/,
        /nit[a-z]*\.ac\.in$/,
        /iiit[a-z]*\.ac\.in$/,
        /bits-pilani\.ac\.in$/,
        /vit\.ac\.in$/,
        /manipal\.edu$/,
        /srmist\.edu\.in$/,
        /lpu\.in$/
    ];

    return validPatterns.some(pattern => pattern.test(domain));
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, email, password, collegeName, course, year } = req.body;

        // Validate email format first
        if (!isValidEmailFormat(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address format (e.g., name@college.edu.in)'
            });
        }

        // Validate college email
        if (!isValidCollegeEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please use a valid college email address (.edu.in, .ac.in, or .edu)'
            });
        }

        // Verify email domain has valid mail servers
        const domainCheck = await verifyEmailDomain(email);
        if (!domainCheck.valid) {
            return res.status(400).json({
                success: false,
                message: domainCheck.reason || 'This email domain appears to be invalid'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'An account with this email already exists'
            });
        }

        // Generate verification token
        const verificationToken = uuidv4();
        const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Create user
        const user = await User.create({
            firstName,
            lastName,
            email: email.toLowerCase(),
            password,
            collegeName,
            course,
            year,
            verificationToken,
            verificationTokenExpires
        });

        // Send verification email

        try {
            await sendVerificationEmail(user.email, verificationToken, firstName);
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
            // If email fails, delete the user so they can try again
            await User.findByIdAndDelete(user._id);
            return res.status(500).json({
                success: false,
                message: 'Registration failed: Could not send verification email. Please try again later.'
            });
        }

        res.status(201).json({
            success: true,
            message: 'Registration successful! Please check your email to verify your account.',
            data: {
                email: user.email,
                firstName: user.firstName
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Registration failed. Please try again.'
        });
    }
});

// @route   GET /api/auth/verify/:token
// @desc    Verify email address
// @access  Public
router.get('/verify/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const user = await User.findOne({
            verificationToken: token,
            verificationTokenExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.redirect('/verification-failed');
        }

        // Verify user
        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;
        await user.save();

        // Send welcome email
        try {
            await sendWelcomeEmail(user.email, user.firstName);
        } catch (emailError) {
            console.error('Welcome email failed:', emailError);
        }

        // Redirect to success page
        res.redirect('/verification-success');

    } catch (error) {
        console.error('Verification error:', error);
        res.redirect('/verification-failed');
    }
});

// @route   POST /api/auth/resend-verification
// @desc    Resend verification email
// @access  Public
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No account found with this email'
            });
        }

        if (user.isVerified) {
            return res.status(400).json({
                success: false,
                message: 'This email is already verified'
            });
        }

        // Generate new token
        const verificationToken = uuidv4();
        user.verificationToken = verificationToken;
        user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await user.save();

        // Send email
        await sendVerificationEmail(user.email, verificationToken, user.firstName);

        res.json({
            success: true,
            message: 'Verification email sent! Please check your inbox.'
        });

    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send verification email'
        });
    }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Find user and include password
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if verified
        if (!user.isVerified) {
            return res.status(403).json({
                success: false,
                message: 'Please verify your email before logging in',
                needsVerification: true
            });
        }

        // Update online status
        user.isOnline = true;
        user.lastSeen = new Date();
        await user.save();

        // Generate token
        const token = generateToken(user._id);

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({
            success: true,
            message: 'Login successful!',
            data: {
                user: {
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    collegeName: user.collegeName,
                    course: user.course,
                    year: user.year,
                    bio: user.bio,
                    profilePicture: user.profilePicture,
                    profileCompleted: user.profileCompleted || false,
                    skills: user.skills || [],
                    interests: user.interests || [],
                    pronouns: user.pronouns || '',
                    dob: user.dob,
                    branch: user.branch,
                    linkedIn: user.linkedIn,
                    github: user.github,
                    instagram: user.instagram,
                    leetcode: user.leetcode,
                    hackerrank: user.hackerrank,
                    codechef: user.codechef,
                    portfolio: user.portfolio
                },
                token
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed. Please try again.'
        });
    }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', protect, async (req, res) => {
    try {
        // Update online status
        req.user.isOnline = false;
        req.user.lastSeen = new Date();
        await req.user.save();

        res.cookie('token', '', {
            httpOnly: true,
            expires: new Date(0)
        });

        res.json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Logout failed'
        });
    }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('connections', 'firstName lastName email collegeName profilePicture isOnline')
            .populate('pendingConnections', 'firstName lastName email collegeName profilePicture');

        res.json({
            success: true,
            data: { user }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user data'
        });
    }
});

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            // Don't reveal if email exists
            return res.json({
                success: true,
                message: 'If an account exists, you will receive a password reset email'
            });
        }

        // Generate reset token
        const resetToken = uuidv4();
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await user.save();

        // Send reset email
        await sendPasswordResetEmail(user.email, resetToken, user.firstName);

        res.json({
            success: true,
            message: 'If an account exists, you will receive a password reset email'
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process request'
        });
    }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password
// @access  Public
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        // Update password
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({
            success: true,
            message: 'Password reset successful! You can now log in.'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password'
        });
    }
});

module.exports = router;
