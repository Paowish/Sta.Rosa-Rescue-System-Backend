const User = require('../models/User.model');
const AuditLog = require('../models/AuditLog.model');
const VolunteerApplication = require('../models/VolunteerApplication.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Notification = require('../models/Notification.model');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// CONFIGURE CLOUDINARY (Kept here just in case, but we are bypassing it below)
const cloudinary = require('cloudinary').v2;
cloudinary.config({
    cloud_name: 'nvvaydmz',
    api_key: '158414443953793',
    api_secret: 'vC7Bmv3Qn31dazyOiB1lCTqZ7bo'
});

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'mysecretkey', {
        expiresIn: process.env.JWT_EXPIRE || '7d'
    });
};

// ============================================
// HELPER FUNCTIONS
// ============================================

// Validate required fields
const validateRequiredFields = (fields) => {
    const errors = [];

    if (!fields.firstName || fields.firstName.trim().length === 0) {
        errors.push({ field: 'firstName', message: 'First name is required' });
    } else if (fields.firstName.trim().length < 1 || fields.firstName.trim().length > 50) {
        errors.push({ field: 'firstName', message: 'First name must be 1-50 characters' });
    }

    if (!fields.lastName || fields.lastName.trim().length === 0) {
        errors.push({ field: 'lastName', message: 'Last name is required' });
    } else if (fields.lastName.trim().length < 1 || fields.lastName.trim().length > 50) {
        errors.push({ field: 'lastName', message: 'Last name must be 1-50 characters' });
    }

    if (!fields.email || fields.email.trim().length === 0) {
        errors.push({ field: 'email', message: 'Email is required' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
        errors.push({ field: 'email', message: 'Valid email required' });
    }

    return errors;
};

// Clean phone number
const cleanPhoneNumber = (phone) => {
    if (!phone) return '';

    let clean = phone.replace(/[\s\-\(\)\+]/g, '');

    if (clean.startsWith('63')) {
        clean = '0' + clean.substring(2);
    }
    if (clean.startsWith('+63')) {
        clean = '0' + clean.replace('+63', '').replace(/[\s\-\(\)]/g, '');
    }
    if (clean.startsWith('9')) {
        clean = '0' + clean;
    }
    if (!clean.startsWith('0')) {
        clean = '0' + clean;
    }

    return clean;
};

// Validate password
const validatePassword = (password) => {
    const errors = [];

    if (!password) {
        errors.push({ field: 'password', message: 'Password is required' });
    } else {
        if (password.length < 8) {
            errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
        }
        if (!/[A-Z]/.test(password)) {
            errors.push({ field: 'password', message: 'Password must contain at least one uppercase letter' });
        }
        if (!/[a-z]/.test(password)) {
            errors.push({ field: 'password', message: 'Password must contain at least one lowercase letter' });
        }
        if (!/[0-9]/.test(password)) {
            errors.push({ field: 'password', message: 'Password must contain at least one number' });
        }
        if (!/[^A-Za-z0-9]/.test(password)) {
            errors.push({ field: 'password', message: 'Password must contain at least one special character (!@#$%^&*)' });
        }
    }

    return errors;
};

// Calculate age from birthday
const calculateAge = (birthdayDate) => {
    if (!birthdayDate) return null;
    const today = new Date();
    const birthDate = new Date(birthdayDate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};

exports.register = async (req, res) => {
    try {
        console.log('🔵 Registration request received');
        console.log('🔵 Body:', req.body);
        console.log('🔵 Files:', req.files?.length || 0);

        const {
            firstName,
            lastName,
            email,
            phoneNumber,
            password,
            role,
            birthday,
            yearsOfExperience,
            address1,
            address2,
            certifications,
            availability,
            description
        } = req.body;

        // Validate
        const errors = [];
        if (!firstName || firstName.trim().length === 0) {
            errors.push({ field: 'firstName', message: 'First name is required' });
        }
        if (!lastName || lastName.trim().length === 0) {
            errors.push({ field: 'lastName', message: 'Last name is required' });
        }
        if (!email || email.trim().length === 0) {
            errors.push({ field: 'email', message: 'Email is required' });
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            errors.push({ field: 'email', message: 'Valid email required' });
        }

        let cleanPhone = phoneNumber?.replace(/[\s\-\(\)\+]/g, '') || '';
        if (cleanPhone.startsWith('63')) cleanPhone = '0' + cleanPhone.substring(2);
        if (!cleanPhone.startsWith('0')) cleanPhone = '0' + cleanPhone;
        if (!cleanPhone || cleanPhone.length < 10 || cleanPhone.length > 12) {
            errors.push({ field: 'phoneNumber', message: 'Phone number must be 10-12 digits' });
        }

        if (!password) {
            errors.push({ field: 'password', message: 'Password is required' });
        } else if (password.length < 8) {
            errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
        }

        if (errors.length > 0) {
            return res.status(400).json({ success: false, errors });
        }

        // Check if user exists
        const userExists = await User.findOne({ email: email.toLowerCase().trim() });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // ✅ HASH PASSWORD
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, salt);

        // ✅ Parse Arrays safely
        let parsedCerts = [];
        if (certifications) {
            try { parsedCerts = JSON.parse(certifications); } catch (e) { parsedCerts = []; }
        }

        let parsedAvailability = [];
        if (availability) {
            try { parsedAvailability = JSON.parse(availability); } catch (e) { parsedAvailability = []; }
        }

        let parsedDescription = description || '';
        const userAge = calculateAge(birthday);

        // ✅ PROCESS FILES - ALLOW IMAGES AND DOCUMENTS
        let processedFiles = [];
        if (req.files && req.files.length > 0) {
            const allowedMimeTypes = [
                'image/jpeg',
                'image/png',
                'image/jpg',
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];
            const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'];

            for (const file of req.files) {
                const ext = file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase();

                // ✅ ALLOW images now - no rejection!
                if (!allowedMimeTypes.includes(file.mimetype)) {
                    return res.status(400).json({
                        success: false,
                        message: `File type not allowed. (Rejected: ${file.originalname})`
                    });
                }

                if (!allowedExtensions.includes(ext)) {
                    return res.status(400).json({
                        success: false,
                        message: `File type not allowed. (Rejected: ${file.originalname})`
                    });
                }

                // ✅ DIRECT BASE64 SAVE
                processedFiles.push({
                    name: file.originalname,
                    type: file.mimetype,
                    size: file.size,
                    url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
                });
            }
        }

        // ✅ CREATE USER WITH REAL BASE64 FILES
        const user = await User.create({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.toLowerCase().trim(),
            phoneNumber: cleanPhone,
            password: hashedPassword,
            role: role || 'civilian',
            isApproved: role === 'volunteer' ? false : true,
            applicationStatus: role === 'volunteer' ? 'pending' : 'approved',
            isActive: true,
            profileImage: '',
            yearsOfExperience: yearsOfExperience || null,
            certifications: parsedCerts,
            availability: parsedAvailability,
            description: parsedDescription,
            age: userAge || null,
            birthday: birthday || null,
            address1: address1 || '',
            address2: address2 || '',
            files: processedFiles
        });

        console.log('✅ User created with REAL Base64 files:', user.files.length);

        // ✅ Create volunteer application
        if (role === 'volunteer') {
            try {
                const applicationData = {
                    userId: user._id,
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    email: email.toLowerCase().trim(),
                    phoneNumber: cleanPhone,
                    birthday: birthday || null,
                    age: userAge,
                    yearsOfExperience: yearsOfExperience || '',
                    address1: address1 || '',
                    address2: address2 || '',
                    certifications: parsedCerts,
                    availability: parsedAvailability,
                    description: parsedDescription,
                    files: processedFiles,
                    status: 'pending'
                };

                const application = new VolunteerApplication(applicationData);
                await application.save();
                console.log('✅ Volunteer application created');

                // Send notifications to Rescue Team
                const rescueTeam = await User.find({
                    role: { $in: ['admin', 'dispatcher', 'responder'] },
                    isActive: true
                });

                for (const rescuer of rescueTeam) {
                    const notification = new Notification({
                        recipient: rescuer._id,
                        type: 'volunteer_status',
                        title: '📝 New Volunteer Application',
                        message: `${firstName} ${lastName} has applied to become a volunteer.`,
                        data: {
                            userId: user._id,
                            applicationId: application?._id || null,
                            name: `${firstName} ${lastName}`,
                            age: userAge || 0,
                            experience: yearsOfExperience
                        }
                    });
                    await notification.save();

                    const io = req.app.get('io');
                    if (io) {
                        io.to(`user_${rescuer._id}`).emit('new_notification', {
                            _id: notification._id,
                            type: 'volunteer_status',
                            title: '📝 New Volunteer Application',
                            message: `${firstName} ${lastName} has applied to become a volunteer.`,
                            createdAt: notification.createdAt,
                            isRead: false,
                            data: notification.data
                        });
                    }
                }

            } catch (appError) {
                console.error('❌ Error creating volunteer application:', appError);
            }
        }

        const token = generateToken(user._id);

        return res.status(201).json({
            success: true,
            message: role === 'volunteer'
                ? 'Registration successful! Your volunteer application has been submitted for review.'
                : 'Registration successful!',
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                phoneNumber: user.phoneNumber,
                profileImage: user.profileImage || '',
                isApproved: user.isApproved,
                applicationStatus: user.applicationStatus
            },
            token: token
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Registration failed'
        });
    }
};

// ============================================
// LOGIN - With Volunteer Approval Check
// ============================================
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // ✅ CHECK: If volunteer, verify they are approved
        if (user.role === 'volunteer') {
            if (user.applicationStatus === 'pending') {
                console.log('🔴 Volunteer login blocked: PENDING APPROVAL -', user.email);
                return res.status(403).json({
                    success: false,
                    message: 'Your volunteer application is pending approval. Please wait for the rescue team to review your application.',
                    code: 'PENDING_APPROVAL'
                });
            }

            if (user.applicationStatus === 'rejected') {
                console.log('🔴 Volunteer login blocked: REJECTED -', user.email);
                return res.status(403).json({
                    success: false,
                    message: 'Your volunteer application has been rejected. Please contact support for more information.',
                    code: 'REJECTED'
                });
            }

            if (!user.isApproved) {
                console.log('🔴 Volunteer login blocked: NOT APPROVED -', user.email);
                return res.status(403).json({
                    success: false,
                    message: 'Your volunteer account is not yet approved. Please contact the rescue team.',
                    code: 'NOT_APPROVED'
                });
            }

            console.log('✅ Volunteer approved and logging in:', user.email);
        }

        // ✅ Check if account is active
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Your account is deactivated. Please contact support.',
                code: 'DEACTIVATED'
            });
        }

        // Generate token
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET || 'mysecretkey',
            { expiresIn: '7d' }
        );

        // ✅ Update last login
        user.lastLogin = new Date();
        await user.save();

        // ✅ Log to check if profileImage exists
        console.log('📸 User from database:', {
            email: user.email,
            profileImage: user.profileImage,
            applicationStatus: user.applicationStatus,
            isApproved: user.isApproved
        });

        // ✅ Return user data with profileImage from MongoDB
        res.json({
            success: true,
            token: token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                profileImage: user.profileImage || '',
                isApproved: user.isApproved,
                applicationStatus: user.applicationStatus,
                isActive: user.isActive
            }
        });
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.'
        });
    }
};

// ============================================
// GET CURRENT USER
// ============================================
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                profileImage: user.profileImage || '',
                isApproved: user.isApproved,
                applicationStatus: user.applicationStatus,
                isActive: user.isActive
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ============================================
// UPDATE PROFILE
// ============================================
exports.updateProfile = async (req, res) => {
    try {
        const allowedUpdates = ['firstName', 'lastName', 'phoneNumber'];
        const updates = {};

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        const user = await User.findByIdAndUpdate(
            req.user.id,
            updates,
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                profileImage: user.profileImage || '',
                isApproved: user.isApproved,
                applicationStatus: user.applicationStatus
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ============================================
// CHANGE PASSWORD
// ============================================
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide current and new password'
            });
        }

        const user = await User.findById(req.user.id).select('+password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash the new password
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(newPassword, salt);

        user.password = hashedPassword;
        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ============================================
// LOGOUT
// ============================================
exports.logout = async (req, res) => {
    try {
        await AuditLog.create({
            userId: req.user.id,
            action: 'LOGOUT',
            entity: 'USER',
            entityId: req.user.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ✅ FORGOT PASSWORD CONTROLLER (Using Brevo REST API)
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: "User with this email does not exist." });
        }

        // Generate a reset token (valid for 1 hour)
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        const resetUrl = `https://www.rescuesantarosagov.live/reset-password/${resetToken}`;

        // ✅ Call Brevo's REST API directly using Node's native fetch (No require needed!)
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': process.env.BREVO_API_KEY, // Your API Key
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: {
                    name: "Sta. Rosa Rescue Team",
                    email: "paolocarunia139@gmail.com" // Must match your Brevo login email
                },
                to: [
                    {
                        email: user.email,
                        name: `${user.firstName} ${user.lastName}`
                    }
                ],
                subject: "Password Reset Request",
                textContent: `You requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Brevo API Error:", data);
            return res.status(500).json({ success: false, message: "Failed to send email. Please check Brevo API key." });
        }

        res.status(200).json({ success: true, message: "Password reset email sent." });

    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ success: false, message: "Server error. Please try again later." });
    }
};

// ✅ RESET PASSWORD CONTROLLER
exports.resetPassword = async (req, res) => {
    const { token } = req.params;
    const { newPassword } = req.body;

    try {
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            // ✅ This is what sends the "Invalid or expired token" error
            return res.status(400).json({ success: false, message: "Invalid or expired token." });
        }

        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(newPassword, salt);

        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.status(200).json({ success: true, message: "Password reset successfully. You can now log in." });
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ success: false, message: "Server error. Please try again later." });
    }
};

// ============================================
// EXTEND SESSION
// ============================================
exports.extendSession = async (req, res) => {
    try {
        const newToken = jwt.sign(
            { id: req.user._id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        return res.status(200).json({
            success: true,
            message: 'Session extended',
            token: newToken
        });
    } catch (error) {
        console.error('Extend session error:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ============================================
// GET SESSION STATUS
// ============================================
exports.getSessionStatus = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(200).json({ authenticated: false });
        }

        const token = req.headers.authorization?.split(' ')[1];
        let timeLeft = 7 * 24 * 60 * 60;

        if (token) {
            try {
                const decoded = jwt.decode(token);
                if (decoded && decoded.exp) {
                    timeLeft = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
                }
            } catch (e) {
                // Ignore decode errors
            }
        }

        return res.status(200).json({
            authenticated: true,
            timeLeft: timeLeft,
            userId: req.user._id,
            userType: req.user.role
        });
    } catch (error) {
        console.error('Get session status error:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};