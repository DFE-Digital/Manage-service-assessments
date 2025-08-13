const { 
    validateChangeName, 
    validateChangeEmail, 
    validateChangeMobile, 
    validateChangePassword,
    handleValidationErrors 
} = require('../middleware/validation');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/user');
const Verification = require('../models/verification');
const {
    sendEmailChangedNotification,
    sendMobileChangedNotification,
    sendMobileVerificationCode,
    sendVerifyEmail
} = require('../config/notify');

exports.g_sign_out = [requireAuth, async (req, res, next) => {
    req.session.destroy();
    return res.redirect('/auth/sign-in');
}];

// GET account page
exports.g_account = [requireAuth, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.redirect('/auth/sign-in');
        }

        // Override the global user with complete data including roles and account details
        res.locals.user = {
            ...req.user, // Includes id, email, firstName, lastName, roles, isSuperAdmin, isOrganisationAdmin, organisation
            mobileNumber: user.mobile_number,
            passwordChangedAt: user.password_changed_at
        };

        return res.render('account/index');
    } catch (error) {
        console.error('Error fetching account details:', error);
        return res.redirect('/auth/sign-in');
    }
}];

// GET change name page
exports.g_change_name = [requireAuth, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.redirect('/auth/sign-in');
        }

        return res.render('account/change-name', {
            firstName: user.first_name,
            lastName: user.last_name
        });
    } catch (error) {
        console.error('Error fetching user details:', error);
        return res.redirect('/auth/sign-in');
    }
}];

exports.p_change_name = [
    requireAuth,
    validateChangeName,
    handleValidationErrors('account/change-name'),
    async (req, res, next) => {
        const { firstName, lastName } = req.body;
        if (!req.user || !req.user.id) {
            return res.redirect('/auth/sign-in');
        }

        try {
            await User.updateName(req.user.id, { firstName, lastName });

            console.log('redirecting');

            req.session.user.firstName = firstName;
            req.session.user.lastName = lastName;

            return res.redirect('/account');

        } catch (error) {
            console.error('Error changing name:', error);
            return res.render('account/change-name', {
                error: 'There was a problem updating your name',
                firstName,
                lastName
            });
        }
    }
];

// GET change email page
exports.g_change_email = [requireAuth, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.redirect('/auth/sign-in');
        }

        return res.render('account/change-email', {
            email: user.email
        });
    } catch (error) {
        console.error('Error fetching user details:', error);
        return res.redirect('/auth/sign-in');
    }
}];

exports.p_change_email = [
    requireAuth,
    validateChangeEmail,
    handleValidationErrors('account/change-email'),
    async (req, res, next) => {
        const { email } = req.body;
        if (!req.user || !req.user.id) {
            return res.redirect('/auth/sign-in');
        }

        try {
            // Check if email is already in use by another user
            const existingUser = await User.findByEmail(email);
            if (existingUser && existingUser.id !== req.user.id) {
                return res.render('account/change-email', {
                    error: 'This email address is already in use',
                    email
                });
            }

            const user = await User.findById(req.user.id);
            if (!user) {
                return res.redirect('/auth/sign-in');
            }

            // Create verification token and send email
            const token = await User.createEmailVerificationToken(req.user.id);
            await sendVerifyEmail(email, user.first_name, token, `${req.protocol}://${req.get('host')}`);
            await sendEmailChangedNotification(user.email, user.first_name, email, `${req.protocol}://${req.get('host')}`);

            return res.render('account/change-email', {
                success: 'A verification email has been sent to your new email address',
                email
            });
        } catch (error) {
            console.error('Error changing email:', error);
            return res.render('account/change-email', {
                error: 'There was a problem updating your email address',
                email
            });
        }
    }
];

// GET change mobile page
exports.g_change_mobile = [requireAuth, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.redirect('/auth/sign-in');
        }

        return res.render('account/change-mobile', {
            mobileNumber: user.mobile_number
        });
    } catch (error) {
        console.error('Error fetching user details:', error);
        return res.redirect('/auth/sign-in');
    }
}];

exports.p_change_mobile = [
    requireAuth,
    validateChangeMobile,
    handleValidationErrors('account/change-mobile'),
    async (req, res, next) => {
        const { mobileNumber } = req.body;
        if (!req.user || !req.user.id) {
            return res.redirect('/auth/sign-in');
        }

        try {
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.redirect('/auth/sign-in');
            }

            // Generate and store verification code
            const code = await Verification.createCode(
                req.user.id,
                Verification.CODE_TYPES.MOBILE_VERIFY
            );

            // Send verification code to new number and notification to old number
            await sendMobileChangedNotification(
                user.mobile_number,
                mobileNumber // New mobile number for notification
            );
            await sendMobileVerificationCode(mobileNumber, code);

            await User.updateMobileNumber(req.user.id, mobileNumber); // Update mobile number

            req.session.user.mobileNumber = mobileNumber; // Update session

            return res.render('account/change-mobile', {
                success: 'Your mobile number has been updated. A verification code has been sent to your new number.',
                mobileNumber: mobileNumber
            });
        } catch (error) {
            console.error('Error changing mobile number:', error);
            return res.render('account/change-mobile', {
                error: 'There was a problem updating your mobile number',
                mobileNumber: req.body.mobileNumber
            });
        }
    }
];

// GET change password page
exports.g_change_password = [requireAuth, async (req, res, next) => {
    return res.render('account/change-password');
}];

exports.p_change_password = [
    requireAuth,
    validateChangePassword,
    handleValidationErrors('account/change-password'),
    async (req, res, next) => {
        const { currentPassword, newPassword } = req.body;
        if (!req.user || !req.user.id) {
            return res.redirect('/auth/sign-in');
        }

        try {
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.redirect('/auth/sign-in');
            }

            // Verify current password
            const isValidPassword = await User.verifyPassword(user, currentPassword);
            if (!isValidPassword) {
                return res.render('account/change-password', {
                    error: 'Your current password is incorrect'
                });
            }

            // Update password
            await User.updatePassword(req.user.id, newPassword);

            return res.render('account/change-password', {
                success: 'Your password has been updated'
            });
        } catch (error) {
            console.error('Error changing password:', error);
            return res.render('account/change-password', {
                error: 'There was a problem updating your password'
            });
        }
    }
]; 