const { run, queryOne, query } = require('../config/database.js');

// Create setup token for new user
const createSetupToken = async (userId, email) => {
    const token = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    
    await run(
        'INSERT INTO setup_tokens (user_id, email, token, expires_at, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [userId, email, token, expiresAt.toISOString()]
    );
    
    return token;
};

// Verify setup token
const verifySetupToken = async (token) => {
    const setupToken = await queryOne(
        'SELECT * FROM setup_tokens WHERE token = ? AND expires_at > CURRENT_TIMESTAMP AND used = 0',
        [token]
    );
    
    return setupToken;
};

// Mark setup token as used
const markSetupTokenUsed = async (token) => {
    await run(
        'UPDATE setup_tokens SET used = 1, used_at = CURRENT_TIMESTAMP WHERE token = ?',
        [token]
    );
};

// Clean up expired tokens
const cleanupExpiredTokens = async () => {
    await run(
        'DELETE FROM setup_tokens WHERE expires_at < CURRENT_TIMESTAMP OR used = 1'
    );
};

module.exports = {
    createSetupToken,
    verifySetupToken,
    markSetupTokenUsed,
    cleanupExpiredTokens
};
