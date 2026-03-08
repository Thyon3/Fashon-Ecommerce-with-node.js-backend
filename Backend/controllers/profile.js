const UserModel = require("../models/user");
const { uploadUserProfileImage, deleteUploadedFile, getFileUrl } = require("../heplers/fileUpload");

// Upload user profile image
exports.uploadProfileImage = async function (req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded"
      });
    }

    const userId = req.user.id;
    
    // Find user
    const user = await UserModel.findById(userId);
    if (!user) {
      // Delete uploaded file if user not found
      deleteUploadedFile(req.file.path);
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Delete old profile image if exists
    if (user.profileImage) {
      const oldImagePath = require('path').join(__dirname, '../public', user.profileImage);
      deleteUploadedFile(oldImagePath);
    }

    // Update user with new profile image
    const profileImageUrl = getFileUrl(req.file.path);
    user.profileImage = profileImageUrl;
    await user.save();

    res.status(200).json({
      message: "Profile image uploaded successfully",
      profileImage: profileImageUrl
    });

  } catch (error) {
    // Delete uploaded file if error occurs
    if (req.file) {
      deleteUploadedFile(req.file.path);
    }
    
    console.error('Profile image upload error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Remove user profile image
exports.removeProfileImage = async function (req, res) {
  try {
    const userId = req.user.id;
    
    // Find user
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Delete profile image if exists
    if (user.profileImage) {
      const imagePath = require('path').join(__dirname, '../public', user.profileImage);
      deleteUploadedFile(imagePath);
      
      // Remove from database
      user.profileImage = null;
      await user.save();
    }

    res.status(200).json({
      message: "Profile image removed successfully"
    });

  } catch (error) {
    console.error('Profile image removal error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Update user profile
exports.updateProfile = async function (req, res) {
  try {
    const userId = req.user.id;
    const { name, email, phone, street, apartment, city, postalCode, country } = req.body;

    // Find user
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Update user fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (street !== undefined) user.street = street;
    if (apartment !== undefined) user.apartment = apartment;
    if (city !== undefined) user.city = city;
    if (postalCode !== undefined) user.postalCode = postalCode;
    if (country !== undefined) user.country = country;

    await user.save();

    // Remove sensitive data from response
    const userResponse = user.toObject();
    delete userResponse.passwordHash;
    delete userResponse.resetPasswordOtp;
    delete userResponse.resetPasswordOtpExpires;

    res.status(200).json({
      message: "Profile updated successfully",
      user: userResponse
    });

  } catch (error) {
    console.error('Profile update error:', error);
    
    // Handle duplicate email error
    if (error.message.includes('email_1 dup key')) {
      return res.status(409).json({
        type: "Validation Error",
        message: "A user with this email already exists"
      });
    }

    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Get user profile
exports.getProfile = async function (req, res) {
  try {
    const userId = req.user.id;
    
    // Find user
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Remove sensitive data from response
    const userResponse = user.toObject();
    delete userResponse.passwordHash;
    delete userResponse.resetPasswordOtp;
    delete userResponse.resetPasswordOtpExpires;

    res.status(200).json({
      user: userResponse
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};
