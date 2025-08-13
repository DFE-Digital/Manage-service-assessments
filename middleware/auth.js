const User = require('../models/user');
const { getUserRoles, getUserOrganisation, isSuperAdmin, isOrganisationAdmin } = require('../config/database');

// Middleware to populate req.user from session
const populateUser = async (req, res, next) => {
    if (req.session && req.session.user) {
        try {
            const user = await User.findById(req.session.user.id);
            if (user) {
                // Get user roles and organisation
                const [roles, organisation, superAdmin, orgAdmin] = await Promise.all([
                    getUserRoles(user.id),
                    getUserOrganisation(user.id),
                    isSuperAdmin(user.id),
                    null // Will be populated if user has an organisation
                ]);
                
                // Check if user is organisation admin (only if they have an organisation)
                let organisationAdmin = false;
                if (organisation) {
                    organisationAdmin = await isOrganisationAdmin(user.id, organisation.id);
                }
                
                req.user = {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    mobileNumber: user.mobile_number,
                    roles: roles.map(r => r.name),
                    organisation,
                    isSuperAdmin: !!superAdmin,
                    isOrganisationAdmin: organisationAdmin
                };
            } else {
                // User no longer exists in database, clear session
                delete req.session.user;
            }
        } catch (error) {
            console.error('Error populating user from session:', error);
            delete req.session.user;
        }
    }
    next();
};

// Middleware to require authentication
const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.redirect('/auth/sign-in');
    }
    next();
};

// Middleware to require pending user (for 2FA flows)
const requirePendingUser = (req, res, next) => {
    if (!req.session || !req.session.pendingUser) {
        return res.redirect('/auth/sign-in');
    }
    req.pendingUser = req.session.pendingUser;
    next();
};

// Middleware to redirect authenticated users away from auth pages
const redirectIfAuthenticated = (req, res, next) => {
    if (req.user) {
        return res.redirect('/dashboard');
    }
    next();
};

module.exports = {
    populateUser,
    requireAuth,
    requirePendingUser,
    redirectIfAuthenticated
}; 