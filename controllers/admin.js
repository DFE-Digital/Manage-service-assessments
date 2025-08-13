const { 
    query, 
    queryOne, 
    run, 
    isSuperAdmin, 
    isOrganisationAdmin,
    getUserOrganisation,
    getOrganisationByDomain
} = require('../config/database');
const { createSetupToken } = require('../models/setup-token.js');
const { sendNewUserSetupEmail } = require('../config/notify.js');

// Middleware to check if user is super admin
const requireSuperAdmin = async (req, res, next) => {
    if (!req.user) {
        return res.redirect('/auth/sign-in');
    }
    
    const superAdmin = await isSuperAdmin(req.user.id);
    if (!superAdmin) {
        return res.status(403).render('error', { 
            message: 'Access denied. Super admin privileges required.' 
        });
    }
    
    next();
};

// Middleware to check if user is organisation admin
const requireOrganisationAdmin = async (req, res, next) => {
    if (!req.user) {
        return res.redirect('/auth/sign-in');
    }
    
    const userOrg = await getUserOrganisation(req.user.id);
    if (!userOrg) {
        return res.status(403).render('error', { 
            message: 'Access denied. You are not assigned to any organisation.' 
        });
    }
    
    const orgAdmin = await isOrganisationAdmin(req.user.id, userOrg.id);
    if (!orgAdmin) {
        return res.status(403).render('error', { 
            message: 'Access denied. Organisation admin privileges required.' 
        });
    }
    
    req.userOrganisation = userOrg;
    next();
};

// Super Admin: List all organisations
const listOrganisations = async (req, res) => {
    try {
        const organisations = await query(`
            SELECT o.*, 
                   COUNT(DISTINCT od.domain) as domain_count,
                   COUNT(DISTINCT oa.user_id) as admin_count
            FROM organisations o
            LEFT JOIN organisation_domains od ON o.id = od.organisation_id
            LEFT JOIN organisation_admins oa ON o.id = oa.organisation_id
            GROUP BY o.id
            ORDER BY o.name
        `);
        
        res.render('admin/organisations', { organisations });
    } catch (error) {
        console.error('Error listing organisations:', error);
        res.status(500).render('error', { message: 'Error loading organisations' });
    }
};

// Super Admin: Add new organisation
const addOrganisation = async (req, res) => {
    res.render('admin/organisation-form', { organisation: null });
};

const createOrganisation = async (req, res) => {
    try {
        const { name, domains } = req.body;
        
        // Create organisation
        const result = await run(
            'INSERT INTO organisations (name) VALUES (?)',
            [name]
        );
        
        const organisationId = result.id;
        
        // Add domains
        if (domains) {
            const domainList = domains.split(',').map(d => d.trim()).filter(d => d);
            for (const domain of domainList) {
                await run(
                    'INSERT INTO organisation_domains (organisation_id, domain) VALUES (?, ?)',
                    [organisationId, domain]
                );
            }
        }
        
        res.redirect('/admin/organisations');
    } catch (error) {
        console.error('Error adding organisation:', error);
        res.status(500).render('error', { message: 'Error adding organisation' });
    }
};

// Super Admin: Edit organisation
const editOrganisation = async (req, res) => {
    const { id } = req.params;
    
    try {
        const organisation = await queryOne('SELECT * FROM organisations WHERE id = ?', [id]);
        const domains = await query('SELECT domain FROM organisation_domains WHERE organisation_id = ?', [id]);
        
        if (!organisation) {
            return res.status(404).render('error', { message: 'Organisation not found' });
        }
        
        res.render('admin/organisation-form', { 
            organisation, 
            domains: domains.map(d => d.domain).join(', ')
        });
    } catch (error) {
        console.error('Error loading organisation:', error);
        res.status(500).render('error', { message: 'Error loading organisation' });
    }
};

const updateOrganisation = async (req, res) => {
    const { id } = req.params;
    
    try {
        const { name, domains } = req.body;
        
        // Update organisation
        await run('UPDATE organisations SET name = ? WHERE id = ?', [name, id]);
        
        // Remove existing domains
        await run('DELETE FROM organisation_domains WHERE organisation_id = ?', [id]);
        
        // Add new domains
        if (domains) {
            const domainList = domains.split(',').map(d => d.trim()).filter(d => d);
            for (const domain of domainList) {
                await run(
                    'INSERT INTO organisation_domains (organisation_id, domain) VALUES (?, ?)',
                    [id, domain]
                );
            }
        }
        
        res.redirect('/admin/organisations');
    } catch (error) {
        console.error('Error updating organisation:', error);
        res.status(500).render('error', { message: 'Error updating organisation' });
    }
};

// Super Admin: View organisation details
const viewOrganisation = async (req, res) => {
    const { id } = req.params;
    
    try {
        const organisation = await queryOne('SELECT * FROM organisations WHERE id = ?', [id]);
        if (!organisation) {
            return res.status(404).render('error', { message: 'Organisation not found' });
        }
        
        // Get organisation domains
        const domains = await query('SELECT domain FROM organisation_domains WHERE organisation_id = ? ORDER BY domain', [id]);
        
        // Get organisation admins
        const admins = await query(`
            SELECT u.id, u.first_name, u.last_name, u.email, oa.created_at
            FROM users u
            JOIN organisation_admins oa ON u.id = oa.user_id
            WHERE oa.organisation_id = ?
            ORDER BY u.last_name, u.first_name
        `, [id]);
        
        // Get all assessors in this organisation
        const assessors = await query(`
            SELECT a.*, u.first_name, u.last_name, u.email,
                   GROUP_CONCAT(ar.role, ', ') as roles
            FROM assessors a
            JOIN users u ON a.user_id = u.id
            LEFT JOIN assessor_roles ar ON a.id = ar.assessor_id
            WHERE a.organisation_id = ?
            GROUP BY a.id
            ORDER BY u.last_name, u.first_name
        `, [id]);
        
        // Get cross-government assessors count
        const crossGovCount = await queryOne(`
            SELECT COUNT(*) as count
            FROM assessors
            WHERE organisation_id = ? AND cross_gov_assessor = 1
        `, [id]);
        
        // Get total assessors count
        const totalAssessorsCount = await queryOne(`
            SELECT COUNT(*) as count
            FROM assessors
            WHERE organisation_id = ?
        `, [id]);
        
        res.render('admin/view-organisation', { 
            organisation, 
            domains,
            admins, 
            assessors,
            crossGovCount: crossGovCount.count,
            totalAssessorsCount: totalAssessorsCount.count
        });
    } catch (error) {
        console.error('Error loading organisation details:', error);
        res.status(500).render('error', { message: 'Error loading organisation details' });
    }
};

// Super Admin: Manage organisation domains
const manageOrganisationDomains = async (req, res) => {
    const { id } = req.params;
    
    try {
        const organisation = await queryOne('SELECT * FROM organisations WHERE id = ?', [id]);
        if (!organisation) {
            return res.status(404).render('error', { message: 'Organisation not found' });
        }
        
        // Get organisation domains
        const domains = await query('SELECT * FROM organisation_domains WHERE organisation_id = ? ORDER BY domain', [id]);
        
        res.render('admin/organisation-domains', { 
            organisation, 
            domains
        });
    } catch (error) {
        console.error('Error loading organisation domains:', error);
        res.status(500).render('error', { message: 'Error loading organisation domains' });
    }
};



const createOrganisationDomain = async (req, res) => {
    const { id } = req.params;
    
    try {
        const { domain } = req.body;
        
        if (!domain || !domain.trim()) {
            return res.status(400).render('error', { message: 'Domain is required' });
        }
        
        // Check if domain already exists for this organisation
        const existingDomain = await queryOne(
            'SELECT 1 FROM organisation_domains WHERE organisation_id = ? AND domain = ?',
            [id, domain.trim()]
        );
        
        if (existingDomain) {
            return res.status(400).render('error', { message: 'Domain already exists for this organisation' });
        }
        
        // Add domain
        await run(
            'INSERT INTO organisation_domains (organisation_id, domain) VALUES (?, ?)',
            [id, domain.trim()]
        );
        
        res.redirect(`/admin/organisations/${id}/domains`);
    } catch (error) {
        console.error('Error adding domain:', error);
        res.status(500).render('error', { message: 'Error adding domain' });
    }
};

// Super Admin: Remove domain from organisation
const removeOrganisationDomain = async (req, res) => {
    const { id, domainId } = req.params;
    
    try {
        await run(
            'DELETE FROM organisation_domains WHERE id = ? AND organisation_id = ?',
            [domainId, id]
        );
        
        res.redirect(`/admin/organisations/${id}/domains`);
    } catch (error) {
        console.error('Error removing domain:', error);
        res.status(500).render('error', { message: 'Error removing domain' });
    }
};

// Super Admin: Manage organisation admins
const manageOrganisationAdmins = async (req, res) => {
    const { id } = req.params;
    
    try {
        const organisation = await queryOne('SELECT * FROM organisations WHERE id = ?', [id]);
        if (!organisation) {
            return res.status(404).render('error', { message: 'Organisation not found' });
        }
        
        const admins = await query(`
            SELECT u.id, u.first_name, u.last_name, u.email, oa.created_at
            FROM users u
            JOIN organisation_admins oa ON u.id = oa.user_id
            WHERE oa.organisation_id = ?
            ORDER BY u.last_name, u.first_name
        `, [id]);
        
        res.render('admin/organisation-admins', { organisation, admins });
    } catch (error) {
        console.error('Error loading organisation admins:', error);
        res.status(500).render('error', { message: 'Error loading organisation admins' });
    }
};



const createOrganisationAdmin = async (req, res) => {
    const { id } = req.params;
    
    try {
        const { email } = req.body;
        
        // Get the organisation and its domains
        const organisation = await queryOne('SELECT * FROM organisations WHERE id = ?', [id]);
        if (!organisation) {
            return res.status(404).render('error', { message: 'Organisation not found' });
        }
        
        // Get organisation domains
        const domains = await query('SELECT domain FROM organisation_domains WHERE organisation_id = ?', [id]);
        
        // Extract domain from email
        const emailDomain = email.split('@')[1];
        
        // Check if email domain matches any organisation domain
        const domainMatches = domains.some(domain => domain.domain === emailDomain);
        
        if (!domainMatches) {
            const domainList = domains.map(d => d.domain).join(', ');
            return res.status(400).render('error', { 
                message: `Email domain '${emailDomain}' does not match any allowed domains for ${organisation.name}. Allowed domains: ${domainList}` 
            });
        }
        
        // Find user by email, or create if they don't exist
        let user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
        
        if (!user) {
            // Generate a temporary password hash for the user to change later
            const tempPasswordHash = '$2b$12$temp.hash.for.setup.flow.123456789';
            
            // Create new user with placeholder names and temporary password
            const result = await run(
                'INSERT INTO users (email, first_name, last_name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
                [email, 'First', 'Last', tempPasswordHash]
            );
            
            // Get the newly created user
            user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
            
            // Create setup token for the new user
            const setupToken = await createSetupToken(user.id, email);
            
            // Send email to user with setup link
            const setupUrl = `${req.protocol}://${req.get('host')}/setup/${setupToken}`;
            
            try {
                await sendNewUserSetupEmail(email, setupUrl);
            } catch (error) {
                console.error('Error sending setup email:', error);
                // Don't fail the admin creation if email fails
            }
        }
        
        // Check if already admin
        const existing = await queryOne(
            'SELECT 1 FROM organisation_admins WHERE organisation_id = ? AND user_id = ?',
            [id, user.id]
        );
        
        if (existing) {
            return res.status(400).render('error', { message: 'User is already an admin for this organisation' });
        }
        
        // Add as admin
        await run(
            'INSERT INTO organisation_admins (organisation_id, user_id) VALUES (?, ?)',
            [id, user.id]
        );
        
        res.redirect(`/admin/organisations/${id}/admins`);
    } catch (error) {
        console.error('Error adding organisation admin:', error);
        res.status(500).render('error', { message: 'Error adding organisation admin' });
    }
};

// Super Admin: Remove organisation admin
const removeOrganisationAdmin = async (req, res) => {
    const { id, userId } = req.params;
    
    try {
        await run(
            'DELETE FROM organisation_admins WHERE organisation_id = ? AND user_id = ?',
            [id, userId]
        );
        
        res.redirect(`/admin/organisations/${id}/admins`);
    } catch (error) {
        console.error('Error removing organisation admin:', error);
        res.status(500).render('error', { message: 'Error removing organisation admin' });
    }
};

// Super Admin: List cross-government assessors
const listCrossGovAssessors = async (req, res) => {
    try {
        const assessors = await query(`
            SELECT a.*, u.first_name, u.last_name, u.email, o.name as organisation_name,
                   GROUP_CONCAT(ar.role, ', ') as roles
            FROM assessors a
            JOIN users u ON a.user_id = u.id
            JOIN organisations o ON a.organisation_id = o.id
            LEFT JOIN assessor_roles ar ON a.id = ar.assessor_id
            WHERE a.cross_gov_assessor = 1
            GROUP BY a.id
            ORDER BY o.name, u.last_name, u.first_name
        `);
        
        // Count assessors by department
        const departmentCounts = {};
        assessors.forEach(assessor => {
            const orgName = assessor.organisation_name;
            departmentCounts[orgName] = (departmentCounts[orgName] || 0) + 1;
        });
        
        res.render('admin/cross-gov-assessors', { 
            assessors,
            departmentCounts 
        });
    } catch (error) {
        console.error('Error listing cross-government assessors:', error);
        res.status(500).render('error', { message: 'Error loading assessors' });
    }
};

// Organisation Admin: List assessors in their organisation
const listOrganisationAssessors = async (req, res) => {
    try {
        const assessors = await query(`
            SELECT a.*, u.first_name, u.last_name, u.email,
                   GROUP_CONCAT(ar.role, ', ') as roles
            FROM assessors a
            JOIN users u ON a.user_id = u.id
            LEFT JOIN assessor_roles ar ON a.id = ar.assessor_id
            WHERE a.organisation_id = ?
            GROUP BY a.id
            ORDER BY u.last_name, u.first_name
        `, [req.userOrganisation.id]);
        
        res.render('admin/organisation-assessors', { 
            assessors, 
            organisation: req.userOrganisation 
        });
    } catch (error) {
        console.error('Error listing organisation assessors:', error);
        res.status(500).render('error', { message: 'Error loading assessors' });
    }
};

// Organisation Admin: Add assessor to organisation
const addOrganisationAssessor = async (req, res) => {
    res.render('admin/add-assessor', { organisation: req.userOrganisation });
};

const createOrganisationAssessor = async (req, res) => {
    try {
        const { email, first_name, last_name, cross_gov_assessor, roles } = req.body;
        
        // Find or create user
        let user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
        
        if (!user) {
            // Create new user (without password for now)
            const result = await run(
                'INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)',
                [first_name, last_name, email, 'temp_password_hash']
            );
            user = await queryOne('SELECT * FROM users WHERE id = ?', [result.id]);
        }
        
        // Add to organisation
        await run(`
            INSERT OR REPLACE INTO assessors (user_id, organisation_id, status, cross_gov_assessor)
            VALUES (?, ?, 'active', ?)
        `, [user.id, req.userOrganisation.id, cross_gov_assessor ? 1 : 0]);
        
        // Get assessor ID
        const assessor = await queryOne(
            'SELECT * FROM assessors WHERE user_id = ? AND organisation_id = ?',
            [user.id, req.userOrganisation.id]
        );
        
        // Add roles
        if (roles && roles.length > 0) {
            for (const role of roles) {
                await run(
                    'INSERT OR IGNORE INTO assessor_roles (assessor_id, role) VALUES (?, ?)',
                    [assessor.id, role]
                );
            }
        }
        
        res.redirect('/admin/organisation/assessors');
    } catch (error) {
        console.error('Error adding assessor:', error);
        res.status(500).render('error', { message: 'Error adding assessor' });
    }
};

// Organisation Admin: Edit assessor
const editOrganisationAssessor = async (req, res) => {
    const { assessorId } = req.params;
    
    try {
        const assessor = await queryOne(`
            SELECT a.*, u.first_name, u.last_name, u.email
            FROM assessors a
            JOIN users u ON a.user_id = u.id
            WHERE a.id = ? AND a.organisation_id = ?
        `, [assessorId, req.userOrganisation.id]);
        
        if (!assessor) {
            return res.status(404).render('error', { message: 'Assessor not found' });
        }
        
        const roles = await query(
            'SELECT role FROM assessor_roles WHERE assessor_id = ?',
            [assessorId]
        );
        
        res.render('admin/edit-assessor', { 
            assessor, 
            organisation: req.userOrganisation,
            roles: roles.map(r => r.role)
        });
    } catch (error) {
        console.error('Error loading assessor:', error);
        res.status(500).render('error', { message: 'Error loading assessor' });
    }
};

const updateOrganisationAssessor = async (req, res) => {
    const { assessorId } = req.params;
    
    try {
        const { cross_gov_assessor, roles, status } = req.body;
        
        // Update assessor
        await run(`
            UPDATE assessors 
            SET cross_gov_assessor = ?, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND organisation_id = ?
        `, [cross_gov_assessor ? 1 : 0, status, assessorId, req.userOrganisation.id]);
        
        // Update roles
        await run('DELETE FROM assessor_roles WHERE assessor_id = ?', [assessorId]);
        
        if (roles && roles.length > 0) {
            for (const role of roles) {
                await run(
                    'INSERT INTO assessor_roles (assessor_id, role) VALUES (?, ?)',
                    [assessorId, role]
                );
            }
        }
        
        res.redirect('/admin/organisation/assessors');
    } catch (error) {
        console.error('Error updating assessor:', error);
        res.status(500).render('error', { message: 'Error updating assessor' });
    }
};

// Admin Dashboard
const adminIndex = async (req, res) => {
    try {
        let stats = {};
        let recentActivity = [];

        if (req.user.isSuperAdmin) {
            // Get stats for super admin
            const totalOrganisations = await queryOne('SELECT COUNT(*) as count FROM organisations');
            const crossGovAssessors = await queryOne('SELECT COUNT(*) as count FROM assessors WHERE cross_gov_assessor = 1');
            const totalUsers = await queryOne('SELECT COUNT(*) as count FROM users');

            stats = {
                totalOrganisations: totalOrganisations.count,
                crossGovAssessors: crossGovAssessors.count,
                totalUsers: totalUsers.count
            };

            // Get recent activity for super admin
            recentActivity = [
                {
                    type: 'Organisation',
                    description: 'New organisation domain added',
                    timestamp: new Date()
                },
                {
                    type: 'Admin',
                    description: 'Organisation admin added',
                    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            ];

        } else if (req.user.isOrganisationAdmin) {
            // Get stats for organisation admin
            const activeAssessors = await queryOne(
                'SELECT COUNT(*) as count FROM assessors WHERE organisation_id = ? AND status = "active"',
                [req.user.organisation.id]
            );
            const crossGovAssessors = await queryOne(
                'SELECT COUNT(*) as count FROM assessors WHERE organisation_id = ? AND cross_gov_assessor = 1',
                [req.user.organisation.id]
            );

            stats = {
                activeAssessors: activeAssessors.count,
                crossGovAssessors: crossGovAssessors.count,
                upcomingAssessments: 0 // Placeholder for future assessments feature
            };

            // Get recent activity for organisation admin
            recentActivity = [
                {
                    type: 'Assessor',
                    description: 'New assessor added to organisation',
                    timestamp: new Date()
                }
            ];
        }

        res.render('admin/index', { 
            stats,
            recentActivity
        });
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        res.status(500).render('error', { message: 'Error loading admin dashboard' });
    }
};

module.exports = {
    adminIndex,
    requireSuperAdmin,
    requireOrganisationAdmin,
    listOrganisations,
    addOrganisation,
    createOrganisation,
    editOrganisation,
    updateOrganisation,
    viewOrganisation,
    manageOrganisationDomains,
    createOrganisationDomain,
    removeOrganisationDomain,
    manageOrganisationAdmins,
    createOrganisationAdmin,
    removeOrganisationAdmin,
    listCrossGovAssessors,
    listOrganisationAssessors,
    addOrganisationAssessor,
    createOrganisationAssessor,
    editOrganisationAssessor,
    updateOrganisationAssessor
};
