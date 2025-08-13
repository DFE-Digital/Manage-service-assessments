const { queryOne, run } = require('../config/database.js');
const { createSetupToken, verifySetupToken, markSetupTokenUsed } = require('../models/setup-token.js');
const bcrypt = require('bcrypt');

// Show setup form for new user
const showSetupForm = async (req, res) => {
    const { token } = req.params;
    
    try {
        // Verify the setup token
        const setupToken = await verifySetupToken(token);
        if (!setupToken) {
            return res.status(400).render('error', { 
                message: 'Invalid or expired setup link. Please contact your administrator for a new link.' 
            });
        }
        
        // Get user details
        const user = await queryOne('SELECT * FROM users WHERE id = ?', [setupToken.user_id]);
        if (!user) {
            return res.status(400).render('error', { message: 'User not found' });
        }
        
        res.render('setup/account-setup', { 
            token, 
            user,
            csrfToken: req.csrfToken()
        });
    } catch (error) {
        console.error('Error loading setup form:', error);
        res.status(500).render('error', { message: 'Error loading setup form' });
    }
};

// Process account setup
const processSetup = async (req, res) => {
    const { token } = req.params;
    const { first_name, last_name, password, confirm_password } = req.body;
    
    try {
        // Verify the setup token
        const setupToken = await verifySetupToken(token);
        if (!setupToken) {
            return res.status(400).render('error', { 
                message: 'Invalid or expired setup link. Please contact your administrator for a new link.' 
            });
        }
        
        // Validate input
        if (!first_name || !last_name || !password || !confirm_password) {
            return res.status(400).render('error', { message: 'All fields are required' });
        }
        
        if (password !== confirm_password) {
            return res.status(400).render('error', { message: 'Passwords do not match' });
        }
        
        if (password.length < 8) {
            return res.status(400).render('error', { message: 'Password must be at least 8 characters long' });
        }
        
        // Hash the password
        const passwordHash = await bcrypt.hash(password, 12);
        
        // Update user details
        await run(`
            UPDATE users 
            SET first_name = ?, last_name = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [first_name, last_name, passwordHash, setupToken.user_id]);
        
        // Mark token as used
        await markSetupTokenUsed(token);
        
        // Redirect to sign in with success message
        res.redirect('/auth/sign-in?message=Account setup complete. You can now sign in with your new password.');
        
    } catch (error) {
        console.error('Error processing account setup:', error);
        res.status(500).render('error', { message: 'Error processing account setup' });
    }
};

module.exports = {
    showSetupForm,
    processSetup
};
