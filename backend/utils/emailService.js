const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
    console.log('📧 Creating email transporter...');
    console.log('📧 Email User:', process.env.EMAIL_USER);
    console.log('📧 Email Host:', process.env.EMAIL_HOST);

    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT),
        secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for 587
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        debug: true,
        logger: true,
        // Timeout settings to prevent buffering timeout
        connectionTimeout: 10000, // 10 seconds to establish connection
        greetingTimeout: 10000,   // 10 seconds for server greeting
        socketTimeout: 30000,     // 30 seconds for socket inactivity
        // Pool settings for better connection management
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 5
    });
};

// Send verification email
const sendVerificationEmail = async (email, token, firstName) => {
    const transporter = createTransporter();
    const verificationUrl = `${process.env.APP_URL}/api/auth/verify/${token}`;

    const mailOptions = {
        from: `"CollEra" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Verify Your CollEra Account',
        headers: {
            'X-Priority': '1',
            'X-Mailer': 'CollEra Mailer',
            'List-Unsubscribe': `<mailto:${process.env.EMAIL_USER}?subject=unsubscribe>`
        },
        text: `Hi ${firstName},\n\nWelcome to CollEra! Please verify your email by clicking the link below:\n\n${verificationUrl}\n\nThis link expires in 24 hours.\n\nBest regards,\nThe CollEra Team\nhttps://collera.in`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Verify Your Email</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td align="center" style="padding: 40px 0;">
                            <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                                <!-- Header -->
                                <tr>
                                    <td style="background: #667eea; padding: 30px; text-align: center;">
                                        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">CollEra</h1>
                                        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">College Networking Platform</p>
                                    </td>
                                </tr>
                                <!-- Content -->
                                <tr>
                                    <td style="padding: 40px 30px;">
                                        <h2 style="color: #333; margin: 0 0 20px 0; font-size: 22px;">Hi ${firstName},</h2>
                                        <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                                            Welcome to CollEra! Please verify your email address to complete your registration.
                                        </p>
                                        <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                                            Click the button below to verify your account:
                                        </p>
                                        <table role="presentation" style="margin: 0 auto;">
                                            <tr>
                                                <td style="border-radius: 6px; background: #667eea;">
                                                    <a href="${verificationUrl}" style="display: inline-block; padding: 14px 40px; color: white; text-decoration: none; font-size: 16px; font-weight: 600;">
                                                        Verify Email Address
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                        <p style="color: #888; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0; text-align: center;">
                                            This link expires in 24 hours.
                                        </p>
                                        <p style="color: #888; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0;">
                                            If the button doesn't work, copy and paste this link into your browser:<br>
                                            <a href="${verificationUrl}" style="color: #667eea; word-break: break-all;">${verificationUrl}</a>
                                        </p>
                                    </td>
                                </tr>
                                <!-- Footer -->
                                <tr>
                                    <td style="background: #f8f9fa; padding: 30px 40px; text-align: center;">
                                        <p style="color: #999; font-size: 12px; margin: 0;">
                                            © 2026 CollEra. Made with ❤️ for Indian college students.
                                        </p>
                                        <p style="color: #999; font-size: 12px; margin: 10px 0 0 0;">
                                            <a href="https://collera.in" style="color: #667eea;">collera.in</a>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `
    };

    await transporter.sendMail(mailOptions);
};

// Send welcome email after verification
const sendWelcomeEmail = async (email, firstName) => {
    const transporter = createTransporter();

    const mailOptions = {
        from: `"CollEra" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🎉 Welcome to CollEra - You\'re In!',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td align="center" style="padding: 40px 0;">
                            <table role="presentation" style="width: 600px; border-collapse: collapse; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                                <tr>
                                    <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
                                        <h1 style="color: white; margin: 0; font-size: 36px;">🎉</h1>
                                        <h2 style="color: white; margin: 10px 0 0 0; font-size: 28px;">You're In, ${firstName}!</h2>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 50px 40px; text-align: center;">
                                        <p style="color: #666; font-size: 18px; line-height: 1.6; margin: 0 0 20px 0;">
                                            Your college email has been verified successfully!
                                        </p>
                                        <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                            You now have full access to CollEra. Start connecting with fellow students, find study partners, collaborate on projects, and build your network!
                                        </p>
                                        <table role="presentation" style="margin: 0 auto;">
                                            <tr>
                                                <td style="border-radius: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                                                    <a href="${process.env.APP_URL}/dashboard" style="display: inline-block; padding: 18px 50px; color: white; text-decoration: none; font-size: 16px; font-weight: 600;">
                                                        🚀 Start Exploring
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="background: #f8f9fa; padding: 30px 40px; text-align: center;">
                                        <p style="color: #999; font-size: 12px; margin: 0;">
                                            © 2026 CollEra. Made with ❤️ for Indian college students.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `
    };

    await transporter.sendMail(mailOptions);
};

// Send password reset email
const sendPasswordResetEmail = async (email, token, firstName) => {
    const transporter = createTransporter();
    const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`;

    const mailOptions = {
        from: `"CollEra" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🔐 Reset Your CollEra Password',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td align="center" style="padding: 40px 0;">
                            <table role="presentation" style="width: 600px; border-collapse: collapse; background: white; border-radius: 20px; overflow: hidden;">
                                <tr>
                                    <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
                                        <h1 style="color: white; margin: 0; font-size: 36px;">CollEra</h1>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 50px 40px;">
                                        <h2 style="color: #333; margin: 0 0 20px 0;">Password Reset Request</h2>
                                        <p style="color: #666; font-size: 16px; line-height: 1.6;">
                                            Hi ${firstName}, we received a request to reset your password. Click the button below to create a new password:
                                        </p>
                                        <table role="presentation" style="margin: 30px auto;">
                                            <tr>
                                                <td style="border-radius: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                                                    <a href="${resetUrl}" style="display: inline-block; padding: 18px 50px; color: white; text-decoration: none; font-size: 16px; font-weight: 600;">
                                                        Reset Password
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                        <p style="color: #999; font-size: 14px;">This link expires in 1 hour. If you didn't request this, please ignore this email.</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `
    };

    await transporter.sendMail(mailOptions);
};

module.exports = {
    sendVerificationEmail,
    sendWelcomeEmail,
    sendPasswordResetEmail
};
