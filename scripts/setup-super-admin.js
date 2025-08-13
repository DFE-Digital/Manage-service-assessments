#!/usr/bin/env node

const { db, queryOne, run } = require('../config/database');
const bcrypt = require('bcrypt');

async function setupSuperAdmin() {
    try {
        console.log('Setting up super admin...');
        
        // Check if super admin already exists
        const existingSuperAdmin = await queryOne('SELECT 1 FROM super_admins LIMIT 1');
        if (existingSuperAdmin) {
            console.log('Super admin already exists. Skipping setup.');
            return;
        }
        
        // Get the first user (assuming it's the admin)
        const firstUser = await queryOne('SELECT * FROM users ORDER BY id ASC LIMIT 1');
        if (!firstUser) {
            console.log('No users found. Please create a user first.');
            return;
        }
        
        // Make the first user a super admin
        await run('INSERT INTO super_admins (user_id) VALUES (?)', [firstUser.id]);
        
        console.log(`User ${firstUser.email} has been made a super admin.`);
        console.log('You can now access the admin panel at /admin/organisations');
        
    } catch (error) {
        console.error('Error setting up super admin:', error);
    } finally {
        db.close();
    }
}

// Run the setup
setupSuperAdmin();
