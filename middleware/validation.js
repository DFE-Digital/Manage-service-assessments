const { body, validationResult } = require('express-validator');

// Validation middleware for sign-in
exports.validateSignIn = [
    body('email')
        .trim()
        .notEmpty().withMessage('Enter your email address')
        .bail()
        .isEmail().withMessage('Enter a valid email address'),
    body('password')
        .notEmpty().withMessage('Enter your password')
];

// Validation middleware for forgot password
exports.validateForgotPassword = [
    body('email')
        .trim()
        .notEmpty().withMessage('Enter your email address')
        .bail()
        .isEmail().withMessage('Enter a valid email address')
];

// Validation middleware for register
exports.validateRegister = [
    body('firstName')
        .trim()
        .notEmpty().withMessage('Enter your first name'),
    body('lastName')
        .trim()
        .notEmpty().withMessage('Enter your last name'),
    body('email')
        .trim()
        .notEmpty().withMessage('Enter an email address')
        .bail()
        .isEmail().withMessage('Enter a valid email address')
        .custom(value => {
            if (!value) return true; // Skip if empty (handled by notEmpty)
            const domain = value.split('@')[1];
            if (!domain) return false;
            
            const publicSectorDomains = [
                '.gov.uk',
                '.nhs.uk',
                '.police.uk',
                '.mod.uk',
                '.parliament.uk',
                '.judiciary.uk',
                '.mil.uk',
                '.hmrc.gov.uk',
                '.nhs.net',
                '.scot.nhs.uk',
                '.wales.nhs.uk',
                '.hscni.net'
            ];
            
            const isPublicSector = publicSectorDomains.some(d => 
                domain.toLowerCase().endsWith(d)
            );
            
            if (!isPublicSector) {
                throw new Error('Enter a public sector email address');
            }
            return true;
        }),
    body('mobileNumber')
        .trim()
        .notEmpty().withMessage('Enter a mobile number')
        .bail()
        .custom(value => {
            if (!value) return true; // Skip if empty (handled by notEmpty)
            // Remove spaces and any other formatting
            const cleaned = value.replace(/\s+/g, '');
            // Check if it's a UK mobile number
            if (cleaned.startsWith('07') || cleaned.startsWith('+447') || cleaned.startsWith('00447')) {
                return true;
            }
            throw new Error('Enter a valid UK mobile number starting with 07');
        }),
    body('password')
        .notEmpty().withMessage('Enter a password')
        .bail()
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .bail()
        .isLength({ max: 100 }).withMessage('Password must be 100 characters or less')
        .bail()
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must include at least one lowercase letter, one uppercase letter and one number')
];

// Validation middleware for 2FA setup
exports.validate2FASetup = [
    body('mobileNumber')
        .trim()
        .notEmpty().withMessage('Enter a mobile number')
        .bail()
        .custom(value => {
            if (!value) return true;
            const cleaned = value.replace(/\s+/g, '');
            if (cleaned.startsWith('07') || cleaned.startsWith('+447') || cleaned.startsWith('00447')) {
                return true;
            }
            throw new Error('Enter a valid UK mobile number starting with 07');
        })
];

// Validation middleware for 2FA verify
exports.validate2FAVerify = [
    body('code')
        .trim()
        .notEmpty().withMessage('Enter the security code')
        .bail()
        .isLength({ min: 6, max: 6 }).withMessage('Security code must be 6 digits')
        .bail()
        .matches(/^[0-9]{6}$/).withMessage('Security code must only include numbers')
];

// Validation middleware for reset password
exports.validateResetPassword = [
    body('password')
        .notEmpty().withMessage('Enter a password')
        .bail()
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .bail()
        .isLength({ max: 100 }).withMessage('Password must be 100 characters or less')
        .bail()
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must include at least one lowercase letter, one uppercase letter and one number'),
    body('confirmPassword')
        .notEmpty().withMessage('Confirm your password')
        .bail()
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords do not match');
            }
            return true;
        })
];

// Validation middleware for account setup
exports.validateSetup = [
    body('token')
        .notEmpty().withMessage('Invalid setup link'),
    body('mobileNumber')
        .trim()
        .notEmpty().withMessage('Enter a mobile number')
        .bail()
        .custom(value => {
            if (!value) return true;
            const cleaned = value.replace(/\s+/g, '');
            if (cleaned.startsWith('07') || cleaned.startsWith('+447') || cleaned.startsWith('00447')) {
                return true;
            }
            throw new Error('Enter a valid UK mobile number starting with 07');
        }),
    body('password')
        .notEmpty().withMessage('Enter a password')
        .bail()
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .bail()
        .isLength({ max: 100 }).withMessage('Password must be 100 characters or less')
        .bail()
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must include at least one lowercase letter, one uppercase letter and one number'),
    body('confirmPassword')
        .notEmpty().withMessage('Confirm your password')
        .bail()
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords do not match');
            }
            return true;
        })
];

// Validation middleware for change name
exports.validateChangeName = [
    body('firstName')
        .trim()
        .notEmpty().withMessage('Enter your first name'),
    body('lastName')
        .trim()
        .notEmpty().withMessage('Enter your last name')
];

// Validation middleware for change email
exports.validateChangeEmail = [
    body('email')
        .trim()
        .notEmpty().withMessage('Enter an email address')
        .bail()
        .isEmail().withMessage('Enter a valid email address')
        .bail()
        .custom(value => {
            const domain = value.split('@')[1];
            if (!domain) return false;
            
            const publicSectorDomains = [
                '.gov.uk',
                '.nhs.uk',
                '.police.uk',
                '.mod.uk',
                '.parliament.uk',
                '.judiciary.uk',
                '.mil.uk',
                '.hmrc.gov.uk',
                '.nhs.net',
                '.scot.nhs.uk',
                '.wales.nhs.uk',
                '.hscni.net'
            ];
            
            const isPublicSector = publicSectorDomains.some(d => 
                domain.toLowerCase().endsWith(d)
            );
            
            if (!isPublicSector) {
                throw new Error('Enter a public sector email address');
            }
            return true;
        })
];

// Validation middleware for change mobile
exports.validateChangeMobile = [
    body('mobileNumber')
        .trim()
        .notEmpty().withMessage('Enter a mobile number')
        .bail()
        .custom(value => {
            const cleaned = value.replace(/\s+/g, '');
            if (cleaned.startsWith('07') || cleaned.startsWith('+447') || cleaned.startsWith('00447')) {
                return true;
            }
            throw new Error('Enter a valid UK mobile number starting with 07');
        })
];

// Validation middleware for change password
exports.validateChangePassword = [
    body('currentPassword')
        .notEmpty().withMessage('Enter your current password'),
    body('newPassword')
        .notEmpty().withMessage('Enter a new password')
        .bail()
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .bail()
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must include at least one lowercase letter, one uppercase letter and one number')
];

// Middleware to handle validation errors
exports.handleValidationErrors = (template, options = {}) => {
    return async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorArray = errors.array();
            const fieldErrors = errorArray.reduce((acc, err) => {
                acc[err.path] = err.msg;
                return acc;
            }, {});

            const errorSummary = errorArray.map(err => ({
                text: err.msg,
                href: `#${err.path}`
            }));

            return res.render(template, {
                ...options,
                ...req.body,
                errors: fieldErrors,
                errorSummary
            });
        }
        next();
    };
}; 