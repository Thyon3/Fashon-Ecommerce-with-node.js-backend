const UserModel = require("../models/user");
const crypto = require("crypto");
const emailSender = require("../heplers/email_sender");

// Send email verification
exports.sendEmailVerification = async function (req, res) {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Check if email is already verified
    if (user.isEmailVerified) {
      return res.status(400).json({
        message: "Email is already verified"
      });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with verification token
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = verificationExpires;
    await user.save();

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&email=${email}`;
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Email Verification</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; }
          .header { text-align: center; color: #007bff; margin-bottom: 20px; }
          .content { color: #666; line-height: 1.6; }
          .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
          .code { background-color: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 14px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>📧 Verify Your Email Address</h2>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>Thank you for registering with Fashon! To complete your registration, please verify your email address.</p>
            <p>Click the button below to verify your email:</p>
            <a href="${verificationUrl}" class="button">Verify Email</a>
            <p>Or copy and paste this link into your browser:</p>
            <div class="code">${verificationUrl}</div>
            <p>This verification link will expire in 24 hours.</p>
            <p>If you didn't create an account with us, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 Fashon. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await emailSender.sendEmail({
      to: email,
      subject: "Verify Your Email Address - Fashon",
      html: emailHtml
    });

    res.status(200).json({
      message: "Verification email sent successfully"
    });

  } catch (error) {
    console.error('Send email verification error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Verify email
exports.verifyEmail = async function (req, res) {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(400).json({
        message: "Verification token and email are required"
      });
    }

    // Find user by email and verification token
    const user = await UserModel.findOne({
      email: email.toLowerCase(),
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired verification token"
      });
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.emailVerifiedAt = new Date();
    await user.save();

    res.status(200).json({
      message: "Email verified successfully"
    });

  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Resend email verification
exports.resendEmailVerification = async function (req, res) {
  try {
    const userId = req.user.id;

    // Find user
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Check if email is already verified
    if (user.isEmailVerified) {
      return res.status(400).json({
        message: "Email is already verified"
      });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with new verification token
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = verificationExpires;
    await user.save();

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&email=${user.email}`;
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Email Verification</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; }
          .header { text-align: center; color: #007bff; margin-bottom: 20px; }
          .content { color: #666; line-height: 1.6; }
          .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>📧 Verify Your Email Address</h2>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>Please verify your email address to complete your registration.</p>
            <a href="${verificationUrl}" class="button">Verify Email</a>
            <p>This verification link will expire in 24 hours.</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 Fashon. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await emailSender.sendEmail({
      to: user.email,
      subject: "Verify Your Email Address - Fashon",
      html: emailHtml
    });

    res.status(200).json({
      message: "Verification email resent successfully"
    });

  } catch (error) {
    console.error('Resend email verification error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Check email verification status
exports.checkEmailVerificationStatus = async function (req, res) {
  try {
    const userId = req.user.id;

    // Find user
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.status(200).json({
      isEmailVerified: user.isEmailVerified || false,
      emailVerifiedAt: user.emailVerifiedAt || null,
      email: user.email
    });

  } catch (error) {
    console.error('Check email verification status error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};
