const { requireAuth } = require('../middleware/auth');

// Dashboard controller - shows appropriate dashboard based on user role
const showDashboard = async (req, res) => {
    try {
        // User is populated by populateUser middleware
        const user = req.user;
        
        if (!user) {
            return res.redirect('/auth/sign-in');
        }

        // Determine which dashboard to show based on user role
        let dashboardType = 'user'; // default
        let dashboardData = {
            user,
            dashboardType: 'user'
        };

        if (user.isSuperAdmin) {
            dashboardType = 'super-admin';
            dashboardData = {
                user,
                dashboardType: 'super-admin',
                title: 'Super Admin Dashboard',
                description: 'Manage all organisations, admins, and cross-government assessors.'
            };
        } else if (user.isOrganisationAdmin) {
            dashboardType = 'organisation-admin';
            dashboardData = {
                user,
                dashboardType: 'organisation-admin',
                title: `${user.organisation?.name || 'Organisation'} Admin Dashboard`,
                description: 'Manage assessors within your organisation.',
                organisation: user.organisation
            };
        } else {
            dashboardType = 'user';
            dashboardData = {
                user,
                dashboardType: 'user',
                title: 'User Dashboard',
                description: 'Access your assessments and profile.',
                organisation: user.organisation
            };
        }

        res.render('dashboard/index', dashboardData);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).render('error', { message: 'Error loading dashboard' });
    }
};

module.exports = {
    showDashboard: [requireAuth, showDashboard]
};
