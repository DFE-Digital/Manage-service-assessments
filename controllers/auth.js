const { validateSignIn, validateForgotPassword, validateRegister, validate2FASetup, validate2FAVerify, validateResetPassword, validateSetup, handleValidationErrors } = require('../middleware/validation');
const { redirectIfAuthenticated, requireAuth, requirePendingUser } = require('../middleware/auth');
const User = require('../models/user');
const Verification = require('../models/verification');
const {
    sendVerifyEmail,
    sendPasswordResetEmail,
    send2FACode,
    sendMobileVerificationCode
} = require('../config/notify');
const { getOrganisationByDomain, assignUserToOrganisation } = require('../config/database');

exports.g_sign_out = [requireAuth, async (req, res, next) => {
    req.session.destroy();
    return res.redirect('/auth/sign-in');
}];


// GET sign in page
exports.g_sign_in = [redirectIfAuthenticated, async (req, res, next) => {
    const { message } = req.query;
    return res.render('auth/sign-in', { message });
}];

exports.p_sign_in = [
    validateSignIn,
    handleValidationErrors('auth/sign-in'),
    async (req, res, next) => {
        const { email, password } = req.body;

        try {
            console.log('Starting sign in for:', email);
            
            // Find user by email
            const user = await User.findByEmail(email);
            if (!user) {
                console.log('User not found:', email);
                return res.render('auth/sign-in', {
                    error: 'Invalid email or password',
                    email
                });
            }

            console.log('User found, verifying password...');
            // Verify password
            const isValidPassword = await User.verifyPassword(user, password);
            if (!isValidPassword) {
                console.log('Invalid password for user:', email);
                return res.render('auth/sign-in', {
                    error: 'Invalid email or password',
                    email
                });
            }

            console.log('Password verified, preparing for 2FA...');
            
            // Ensure user is assigned to organisation based on email domain
            try {
                const domain = user.email.split('@')[1];
                const organisation = await getOrganisationByDomain(domain);
                if (organisation) {
                    console.log('Ensuring user is assigned to organisation:', organisation.name);
                    await assignUserToOrganisation(user.id, organisation.id);
                }
            } catch (error) {
                console.error('Error ensuring user organisation assignment:', error);
            }
            
            // Store user data temporarily for 2FA verification (not full session yet)
            req.session.pendingUser = {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name
            };
            console.log('Pending user stored, checking mobile number...');

            // Check if mobile number is set for 2FA
            if (!user.mobile_number) {
                console.log('No mobile number, redirecting to 2FA setup');
                return res.redirect('/auth/2fa-setup');
            }

            console.log('Mobile number exists, sending 2FA code and redirecting to verification');
            // Generate and send 2FA code
            const code = await Verification.createCode(
                user.id,
                Verification.CODE_TYPES.TWO_FACTOR
            );
            
            // Send 2FA code
            console.log('About to call send2FACode with:', { mobileNumber: user.mobile_number, code });
            const smsResult = await send2FACode(user.mobile_number, code);
            console.log('send2FACode result:', smsResult);

            return res.redirect('/auth/2fa-verify');
        } catch (error) {
            console.error('Error during sign in:', error);
            return res.render('auth/sign-in', {
                error: 'There was a problem signing you in',
                email
            });
        }
    }
];

// GET register page
exports.g_register = [redirectIfAuthenticated, async (req, res, next) => {
    return res.render('auth/register');
}];

exports.p_register = [
    validateRegister,
    handleValidationErrors('auth/register'),
    async (req, res, next) => {
        const { firstName, lastName, email, mobileNumber, password } = req.body;
        
        try {
            console.log('Starting registration for:', email);
            
            // Check if user already exists
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                console.log('User already exists:', email);
                return res.render('auth/register', {
                    error: 'An account with this email address already exists',
                    firstName,
                    lastName,
                    email,
                    mobileNumber
                });
            }

            console.log('Creating user...');
            // Create user
            const userId = await User.create({
                firstName,
                lastName,
                email,
                mobileNumber,
                password
            });
            console.log('User created with ID:', userId);

            // Assign user to organisation based on email domain
            try {
                const domain = email.split('@')[1];
                const organisation = await getOrganisationByDomain(domain);
                if (organisation) {
                    console.log('Assigning user to organisation:', organisation.name);
                    await assignUserToOrganisation(userId, organisation.id);
                } else {
                    console.log('No organisation found for domain:', domain);
                }
            } catch (error) {
                console.error('Error assigning user to organisation:', error);
            }

            console.log('Creating email verification token...');
            // Create email verification token and send email
            const token = await User.createEmailVerificationToken(userId);
            console.log('Token created:', token);
            
            console.log('Sending verification email...');
            await sendVerifyEmail(email, firstName, token, `${req.protocol}://${req.get('host')}`);
            console.log('Verification email sent');

            console.log('Setting user in session...');
            // Set user in session
            req.session.user = {
                id: userId,
                email,
                firstName,
                lastName
            };
            console.log('Session set, redirecting to 2FA setup');

            return res.redirect('/auth/2fa-setup');
        } catch (error) {
            console.error('Error during registration:', error);
            return res.render('auth/register', {
                error: 'There was a problem creating your account',
                firstName,
                lastName,
                email,
                mobileNumber
            });
        }
    }
];

// GET forgot password page
exports.g_forgot_password = [redirectIfAuthenticated, async (req, res, next) => {
    return res.render('auth/forgot-password');
}];

exports.p_forgot_password = [
    validateForgotPassword,
    handleValidationErrors('auth/forgot-password'),
    async (req, res, next) => {
        const { email } = req.body;

        try {
            // Find user by email
            const user = await User.findByEmail(email);
            
            // If user exists, create reset token and send email
            if (user) {
                const token = await User.createPasswordResetToken(user.id);
                await sendPasswordResetEmail(
                    email, 
                    user.first_name, 
                    token, 
                    `${req.protocol}://${req.get('host')}`
                );
            }

            // Always show success message even if email not found (security)
            return res.render('auth/forgot-password', {
                success: 'If an account exists with this email address, we will send you a password reset link'
            });
        } catch (error) {
            console.error('Error during password reset request:', error);
            return res.render('auth/forgot-password', {
                error: 'There was a problem processing your request',
                email
            });
        }
    }
];

exports.g_reset_password = async (req, res, next) => {
    const { token } = req.query;
    if (!token) {
        return res.redirect('/auth/forgot-password');
    }
    return res.render('auth/reset-password', { token });
};

exports.p_reset_password = [
    validateResetPassword,
    handleValidationErrors('auth/reset-password'),
    async (req, res, next) => {
        const { token, password, confirmPassword } = req.body;

        try {
            // Verify token and get user ID
            const userId = await User.verifyPasswordResetToken(token);
            if (!userId) {
                return res.render('auth/reset-password', {
                    error: 'This password reset link has expired or is invalid',
                    token
                });
            }

            // Update password
            await User.updatePassword(userId, password);

            // Redirect to sign in with success message
            return res.redirect('/auth/sign-in?message=password-reset-success');
        } catch (error) {
            console.error('Error during password reset:', error);
            return res.render('auth/reset-password', {
                error: 'There was a problem resetting your password',
                token
            });
        }
    }
];

// GET 2FA setup page
exports.g_2fa_setup = [requirePendingUser, async (req, res, next) => {
    return res.render('auth/2fa-setup');
}];

// POST 2FA setup
exports.p_2fa_setup = [
    requirePendingUser,
    validate2FASetup,
    handleValidationErrors('auth/2fa-setup'),
    async (req, res, next) => {
        const { mobileNumber } = req.body;
        if (!req.pendingUser || !req.pendingUser.id) {
            return res.redirect('/auth/sign-in');
        }

        try {
            await User.updateMobileNumber(req.pendingUser.id, mobileNumber);

            // Generate and store verification code
            const code = await Verification.createCode(
                req.pendingUser.id,
                Verification.CODE_TYPES.MOBILE_VERIFY
            );

            // Send verification code
            console.log('About to call sendMobileVerificationCode with:', { mobileNumber, code });
            const smsResult = await sendMobileVerificationCode(mobileNumber, code);
            console.log('sendMobileVerificationCode result:', smsResult);

            return res.redirect('/auth/2fa-verify');
        } catch (error) {
            console.error('Error during 2FA setup:', error);
            return res.render('auth/2fa-setup', {
                error: 'There was a problem setting up 2FA',
                mobileNumber: req.body.mobileNumber
            });
        }
    }
];

// GET 2FA verify page
exports.g_2fa_verify = [requirePendingUser, async (req, res, next) => {
    if (!req.pendingUser || !req.pendingUser.id) {
        return res.redirect('/auth/sign-in');
    }

    try {
        // Get the current 2FA code for display (for testing)
        const user = await User.findById(req.pendingUser.id);
        if (user && user.mobile_number) {
            // Find the most recent TWO_FACTOR code
            const codes = await Verification.findCodesByUserIdAndType(
                req.pendingUser.id,
                Verification.CODE_TYPES.TWO_FACTOR
            );
            
            if (codes.length > 0) {
                // Sort by created_at descending and get the most recent
                const latestCode = codes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
                return res.render('auth/2fa-verify', { 
                    debugCode: latestCode.code,
                    mobileNumber: user.mobile_number 
                });
            }
        }
        
        return res.render('auth/2fa-verify');
    } catch (error) {
        console.error('Error getting 2FA verify page:', error);
        return res.render('auth/2fa-verify');
    }
}];

// POST 2FA verify
exports.p_2fa_verify = [
    requirePendingUser,
    validate2FAVerify,
    handleValidationErrors('auth/2fa-verify'),
    async (req, res, next) => {
        const { code } = req.body;
        if (!req.pendingUser || !req.pendingUser.id) {
            return res.redirect('/auth/sign-in');
        }

        try {
            const user = await User.findById(req.pendingUser.id);
            if (!user) {
                return res.redirect('/auth/sign-in');
            }

            // Verify the code - try TWO_FACTOR first (from sign-in), then MOBILE_VERIFY (from 2FA setup)
            let result = await Verification.verifyCode(
                req.pendingUser.id,
                code,
                Verification.CODE_TYPES.TWO_FACTOR
            );

            // If TWO_FACTOR code not found, try MOBILE_VERIFY code
            if (!result.valid && result.error === 'Code not found') {
                result = await Verification.verifyCode(
                    req.pendingUser.id,
                    code,
                    Verification.CODE_TYPES.MOBILE_VERIFY
                );
            }

            if (!result.valid) {
                return res.render('auth/2fa-verify', {
                    error: result.error
                });
            }

            // If successful, generate a new 2FA code for next login
            const newCode = await Verification.createCode(
                user.id,
                Verification.CODE_TYPES.TWO_FACTOR
            );

            // 2FA verification successful - now create the full session
            req.session.user = {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name
            };

            // Clear the pending user data
            delete req.session.pendingUser;
            // Send 2FA code (fake for now - just log it)
            console.log('New 2FA Code for', user.mobile_number, ':', newCode);
            // await send2FACode(user.mobile_number, newCode);

            // Redirect to dashboard instead of account
            return res.redirect('/dashboard');
        } catch (error) {
            console.error('Error during 2FA verification:', error);
            return res.render('auth/2fa-verify', {
                error: 'There was a problem verifying your code'
            });
        }
    }
];

// GET setup page (email verification)
exports.g_setup = async (req, res, next) => {
    const { token } = req.query;
    if (!token) {
        return res.redirect('/auth/register');
    }
    return res.render('auth/setup', { token });
};

exports.p_setup = [
    validateSetup,
    handleValidationErrors('auth/setup'),
    async (req, res, next) => {
        const { token, mobileNumber, password } = req.body;

        try {
            // Verify token and get user ID
            const userId = await User.verifyEmailToken(token);
            if (!userId) {
                return res.render('auth/setup', {
                    error: 'This setup link has expired or is invalid',
                    token
                });
            }

            // Update user's mobile number and password
            await User.updateMobileNumber(userId, mobileNumber);
            await User.updatePassword(userId, password);

            // Set user in session
            const user = await User.findById(userId);
            req.session.user = {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name
            };

            return res.redirect('/dashboard');
        } catch (error) {
            console.error('Error during account setup:', error);
            return res.render('auth/setup', {
                error: 'There was a problem setting up your account',
                token,
                mobileNumber
            });
        }
    }
];