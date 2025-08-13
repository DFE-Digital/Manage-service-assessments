const bcrypt = require('bcrypt');
const { query, queryOne, run } = require('../config/database');
const crypto = require('crypto');

class User {
    static async findById(id) {
        return await queryOne(
            'SELECT id, first_name, last_name, email, mobile_number, password_changed_at FROM users WHERE id = ?',
            [id]
        );
    }

    static async findByEmail(email) {
        return await queryOne(
            'SELECT id, first_name, last_name, email, mobile_number, password_hash, password_changed_at FROM users WHERE email = ?',
            [email.toLowerCase()]
        );
    }

    static async create({ firstName, lastName, email, mobileNumber, password }) {
        const passwordHash = await bcrypt.hash(password, 12);
        
        const result = await run(
            `INSERT INTO users (
                first_name, 
                last_name, 
                email, 
                mobile_number, 
                password_hash,
                password_changed_at
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
                firstName,
                lastName,
                email.toLowerCase(),
                mobileNumber,
                passwordHash
            ]
        );

        return result.id;
    }

    static async updateName(userId, { firstName, lastName }) {
        await run(
            'UPDATE users SET first_name = ?, last_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [firstName, lastName, userId]
        );
    }

    static async updateEmail(userId, email) {
        await run(
            'UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [email.toLowerCase(), userId]
        );
    }

    static async updateMobileNumber(userId, mobileNumber) {
        await run(
            'UPDATE users SET mobile_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [mobileNumber, userId]
        );
    }

    static async updatePassword(userId, newPassword) {
        const passwordHash = await bcrypt.hash(newPassword, 12);
        
        await run(
            'UPDATE users SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [passwordHash, userId]
        );
    }

    static async verifyPassword(user, password) {
        return await bcrypt.compare(password, user.password_hash);
    }

    static async createEmailVerificationToken(userId) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await run(
            'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
            [userId, token, expiresAt]
        );

        return token;
    }

    static async verifyEmailToken(token) {
        const result = await queryOne(
            `SELECT user_id 
             FROM email_verification_tokens 
             WHERE token = ? AND expires_at > CURRENT_TIMESTAMP
             ORDER BY created_at DESC 
             LIMIT 1`,
            [token]
        );

        if (result) {
            // Delete the used token
            await run(
                'DELETE FROM email_verification_tokens WHERE token = ?',
                [token]
            );
        }

        return result ? result.user_id : null;
    }

    static async createPasswordResetToken(userId) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

        await run(
            'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
            [userId, token, expiresAt]
        );

        return token;
    }

    static async verifyPasswordResetToken(token) {
        const result = await queryOne(
            `SELECT user_id 
             FROM password_reset_tokens 
             WHERE token = ? AND expires_at > strftime('%s', 'now') * 1000
             ORDER BY created_at DESC 
             LIMIT 1`,
            [token]
        );

        if (result) {
            // Delete the used token
            await run(
                'DELETE FROM password_reset_tokens WHERE token = ?',
                [token]
            );
        }

        return result ? result.user_id : null;
    }
}

module.exports = User; 