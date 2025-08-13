const express = require('express');
const router = express.Router();

const homeController = require('../controllers/home.js');
const authController = require('../controllers/auth.js');
const accountController = require('../controllers/account.js');
const adminController = require('../controllers/admin.js');
const setupController = require('../controllers/setup.js');
const dashboardController = require('../controllers/dashboard.js');
const settingsController = require('../controllers/settings.js');

router.get('/', homeController.g_home);

// Dashboard route
router.get('/dashboard', dashboardController.showDashboard);

// Auth routes
router.get('/auth/sign-in', authController.g_sign_in);
router.post('/auth/sign-in', authController.p_sign_in);
router.get('/auth/register', authController.g_register);
router.post('/auth/register', authController.p_register);
router.get('/auth/forgot-password', authController.g_forgot_password);
router.post('/auth/forgot-password', authController.p_forgot_password);
router.get('/auth/reset-password', authController.g_reset_password);
router.post('/auth/reset-password', authController.p_reset_password);
router.get('/auth/2fa-setup', authController.g_2fa_setup);
router.post('/auth/2fa-setup', authController.p_2fa_setup);
router.get('/auth/2fa-verify', authController.g_2fa_verify);
router.post('/auth/2fa-verify', authController.p_2fa_verify);
router.get('/auth/setup', authController.g_setup);
router.post('/auth/setup', authController.p_setup);
router.get('/auth/sign-out', authController.g_sign_out);

// Setup routes for new user accounts
router.get('/setup/:token', setupController.showSetupForm);
router.post('/setup/:token', setupController.processSetup);

// Account routes
router.get('/account', accountController.g_account);
router.get('/account/change-name', accountController.g_change_name);
router.post('/account/change-name', accountController.p_change_name);
router.get('/account/change-password', accountController.g_change_password);
router.post('/account/change-password', accountController.p_change_password);
router.get('/account/change-mobile', accountController.g_change_mobile);
router.post('/account/change-mobile', accountController.p_change_mobile);
router.get('/account/change-email', accountController.g_change_email);
router.post('/account/change-email', accountController.p_change_email);

// Admin dashboard - accessible by both super admin and organisation admin
router.get('/admin', function(req, res, next) {
    if (req.user && (req.user.isSuperAdmin || req.user.isOrganisationAdmin)) {
        return adminController.adminIndex(req, res, next);
    } else {
        return res.redirect('/dashboard');
    }
});

// Super Admin routes
router.get('/admin/organisations', adminController.requireSuperAdmin, adminController.listOrganisations);
router.get('/admin/organisations/add', adminController.requireSuperAdmin, adminController.addOrganisation);
router.post('/admin/organisations/add', adminController.requireSuperAdmin, adminController.createOrganisation);
router.get('/admin/organisations/:id/edit', adminController.requireSuperAdmin, adminController.editOrganisation);
router.post('/admin/organisations/:id/edit', adminController.requireSuperAdmin, adminController.updateOrganisation);
router.get('/admin/organisations/:id/domains', adminController.requireSuperAdmin, adminController.manageOrganisationDomains);
router.post('/admin/organisations/:id/domains/add', adminController.requireSuperAdmin, adminController.createOrganisationDomain);
router.post('/admin/organisations/:id/domains/:domainId/remove', adminController.requireSuperAdmin, adminController.removeOrganisationDomain);
router.get('/admin/organisations/:id/admins', adminController.requireSuperAdmin, adminController.manageOrganisationAdmins);
router.post('/admin/organisations/:id/admins/add', adminController.requireSuperAdmin, adminController.createOrganisationAdmin);
router.post('/admin/organisations/:id/admins/:userId/remove', adminController.requireSuperAdmin, adminController.removeOrganisationAdmin);
router.get('/admin/organisations/:id', adminController.requireSuperAdmin, adminController.viewOrganisation);
router.get('/admin/cross-gov-assessors', adminController.requireSuperAdmin, adminController.listCrossGovAssessors);
router.get('/admin/assessors', adminController.requireSuperAdmin, adminController.listCrossGovAssessors);

// Organisation Admin routes
router.get('/admin/organisation/assessors', adminController.requireOrganisationAdmin, adminController.listOrganisationAssessors);
router.get('/admin/organisation/assessors/add', adminController.requireOrganisationAdmin, adminController.addOrganisationAssessor);
router.post('/admin/organisation/assessors/add', adminController.requireOrganisationAdmin, adminController.createOrganisationAssessor);
router.get('/admin/organisation/assessors/:assessorId/edit', adminController.requireOrganisationAdmin, adminController.editOrganisationAssessor);
router.post('/admin/organisation/assessors/:assessorId/edit', adminController.requireOrganisationAdmin, adminController.updateOrganisationAssessor);

// Global settings routes - Super Admin only
router.get('/admin/settings', adminController.requireSuperAdmin, settingsController.showSettings);
router.post('/admin/settings/service-standards', adminController.requireSuperAdmin, settingsController.createServiceStandard);
router.post('/admin/settings/service-standards/:id', adminController.requireSuperAdmin, settingsController.updateServiceStandard);

// Organisation settings routes - Organisation Admin only
router.get('/admin/organisation/settings', adminController.requireOrganisationAdmin, settingsController.showDepartmentSettings);
router.post('/admin/organisation/settings', adminController.requireOrganisationAdmin, settingsController.updateDepartmentSettings);
router.post('/admin/organisation/settings/standards', adminController.requireOrganisationAdmin, settingsController.createDepartmentStandard);
router.post('/admin/organisation/settings/standards/:id', adminController.requireOrganisationAdmin, settingsController.updateDepartmentStandard);
router.post('/admin/organisation/settings/test-fips-connection', adminController.requireOrganisationAdmin, settingsController.testFipsConnectionEndpoint);

module.exports = router; 