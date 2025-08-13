const { query, queryOne, run } = require('../config/database');
const axios = require('axios');

// Global settings page - Super Admin only (service standards)
const showSettings = async (req, res) => {
    try {
        const serviceStandards = await query(`
            SELECT * FROM service_standards 
            WHERE is_active = 1 
            ORDER BY number ASC
        `);

        res.render('admin/settings', {
            serviceStandards
        });
    } catch (error) {
        console.error('Error loading settings:', error);
        res.status(500).render('error', { message: 'Error loading settings' });
    }
};

// Department settings page - Organisation Admin only (department standards + FIPS)
const showDepartmentSettings = async (req, res) => {
    try {
        let departmentSettings = null;
        let departmentStandards = [];
        let fipsConnectionStatus = null;

        // Get department settings
        departmentSettings = await queryOne(`
            SELECT * FROM department_settings 
            WHERE organisation_id = ?
        `, [req.user.organisation.id]);

        // If no settings exist, create default entry
        if (!departmentSettings) {
            await run(`
                INSERT INTO department_settings (organisation_id, fips_enabled) 
                VALUES (?, 0)
            `, [req.user.organisation.id]);
            
            departmentSettings = await queryOne(`
                SELECT * FROM department_settings 
                WHERE organisation_id = ?
            `, [req.user.organisation.id]);
        }

        // Get department standards
        departmentStandards = await query(`
            SELECT * FROM department_standards 
            WHERE organisation_id = ? AND is_active = 1 
            ORDER BY reference ASC
        `, [req.user.organisation.id]);

        // Test FIPS connection if enabled
        if (departmentSettings && departmentSettings.fips_enabled && departmentSettings.fips_endpoint) {
            fipsConnectionStatus = await testFipsConnection(departmentSettings);
        }

        res.render('admin/organisation-settings', {
            departmentSettings,
            departmentStandards,
            fipsConnectionStatus
        });
    } catch (error) {
        console.error('Error loading department settings:', error);
        res.status(500).render('error', { message: 'Error loading department settings' });
    }
};

// Create or update service standard (Super Admin only)
const createServiceStandard = async (req, res) => {
    try {
        const { number, title, description, url } = req.body;

        // Check if standard with this number already exists (create new version)
        const existingStandard = await queryOne(`
            SELECT MAX(version) as max_version FROM service_standards 
            WHERE number = ?
        `, [number]);

        const newVersion = existingStandard && existingStandard.max_version ? existingStandard.max_version + 1 : 1;

        // If creating a new version, mark old versions as inactive
        if (newVersion > 1) {
            await run(`
                UPDATE service_standards 
                SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
                WHERE number = ? AND is_active = 1
            `, [number]);
        }

        // Insert new standard
        await run(`
            INSERT INTO service_standards (number, title, description, url, version) 
            VALUES (?, ?, ?, ?, ?)
        `, [number, title, description, url, newVersion]);

        res.redirect('/admin/settings');
    } catch (error) {
        console.error('Error creating service standard:', error);
        res.status(500).render('error', { message: 'Error creating service standard' });
    }
};

// Update service standard (Super Admin only)
const updateServiceStandard = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, url } = req.body;

        await run(`
            UPDATE service_standards 
            SET title = ?, description = ?, url = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [title, description, url, id]);

        res.redirect('/admin/settings');
    } catch (error) {
        console.error('Error updating service standard:', error);
        res.status(500).render('error', { message: 'Error updating service standard' });
    }
};

// Create department standard (Organisation Admin only)
const createDepartmentStandard = async (req, res) => {
    try {
        const { reference, title, description, url } = req.body;

        // Check if standard with this reference already exists (create new version)
        const existingStandard = await queryOne(`
            SELECT MAX(version) as max_version FROM department_standards 
            WHERE organisation_id = ? AND reference = ?
        `, [req.user.organisation.id, reference]);

        const newVersion = existingStandard && existingStandard.max_version ? existingStandard.max_version + 1 : 1;

        // If creating a new version, mark old versions as inactive
        if (newVersion > 1) {
            await run(`
                UPDATE department_standards 
                SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
                WHERE organisation_id = ? AND reference = ? AND is_active = 1
            `, [req.user.organisation.id, reference]);
        }

        // Insert new standard
        await run(`
            INSERT INTO department_standards (organisation_id, reference, title, description, url, version) 
            VALUES (?, ?, ?, ?, ?, ?)
        `, [req.user.organisation.id, reference, title, description, url, newVersion]);

        res.redirect('/admin/organisation/settings');
    } catch (error) {
        console.error('Error creating department standard:', error);
        res.status(500).render('error', { message: 'Error creating department standard' });
    }
};

// Update department standard (Organisation Admin only)
const updateDepartmentStandard = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, url } = req.body;

        await run(`
            UPDATE department_standards 
            SET title = ?, description = ?, url = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ? AND organisation_id = ?
        `, [title, description, url, id, req.user.organisation.id]);

        res.redirect('/admin/organisation/settings');
    } catch (error) {
        console.error('Error updating department standard:', error);
        res.status(500).render('error', { message: 'Error updating department standard' });
    }
};

// Update department settings (Organisation Admin only)
const updateDepartmentSettings = async (req, res) => {
    try {
        const { fips_endpoint, fips_api_key, fips_enabled } = req.body;

        await run(`
            UPDATE department_settings 
            SET fips_endpoint = ?, fips_api_key = ?, fips_enabled = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE organisation_id = ?
        `, [fips_endpoint, fips_api_key, fips_enabled ? 1 : 0, req.user.organisation.id]);

        res.redirect('/admin/organisation/settings');
    } catch (error) {
        console.error('Error updating department settings:', error);
        res.status(500).render('error', { message: 'Error updating department settings' });
    }
};

// Test FIPS connection
const testFipsConnection = async (settings) => {
    if (!settings.fips_endpoint || !settings.fips_api_key) {
        return { success: false, message: 'Missing endpoint or API key' };
    }

    try {
        const response = await axios.get(`${settings.fips_endpoint}/health`, {
            headers: {
                'Authorization': `Bearer ${settings.fips_api_key}`,
                'Content-Type': 'application/json'
            },
            timeout: 5000 // 5 second timeout
        });

        if (response.status === 200) {
            return { success: true, message: 'Connection successful' };
        } else {
            return { success: false, message: `Unexpected response: ${response.status}` };
        }
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            return { success: false, message: 'Connection refused - service may be down' };
        } else if (error.code === 'ETIMEDOUT') {
            return { success: false, message: 'Connection timeout' };
        } else if (error.response) {
            return { success: false, message: `HTTP ${error.response.status}: ${error.response.statusText}` };
        } else {
            return { success: false, message: error.message };
        }
    }
};

// Test FIPS connection endpoint
const testFipsConnectionEndpoint = async (req, res) => {
    try {
        const departmentSettings = await queryOne(`
            SELECT * FROM department_settings 
            WHERE organisation_id = ?
        `, [req.user.organisation.id]);

        if (!departmentSettings) {
            return res.json({ success: false, message: 'No department settings found' });
        }

        const result = await testFipsConnection(departmentSettings);
        res.json(result);
    } catch (error) {
        console.error('Error testing FIPS connection:', error);
        res.json({ success: false, message: 'Error testing connection' });
    }
};

module.exports = {
    showSettings,
    showDepartmentSettings,
    createServiceStandard,
    updateServiceStandard,
    createDepartmentStandard,
    updateDepartmentStandard,
    updateDepartmentSettings,
    testFipsConnectionEndpoint
};
