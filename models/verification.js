const { query, queryOne, run } = require('../config/database');

class Verification {
    static CODE_TYPES = {
        TWO_FACTOR: '2fa',
        MOBILE_VERIFY: 'mobile_verify'
    };

    static CODE_EXPIRY = {
        TWO_FACTOR: 10 * 60 * 1000, // 10 minutes
        MOBILE_VERIFY: 10 * 60 * 1000 // 10 minutes
    };

    static MAX_ATTEMPTS = 3;

    static async createCode(userId, type) {
        // Generate a random 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Debug logging
        console.log('Creating code for user:', userId, 'type:', type);
        console.log('CODE_EXPIRY[type]:', this.CODE_EXPIRY[type]);
        
        // Ensure we have a valid expiry time
        const expiryMs = this.CODE_EXPIRY[type] || 10 * 60 * 1000; // Default to 10 minutes
        const expiresAt = new Date(Date.now() + expiryMs);
        
        console.log('Expiry time:', expiresAt.toISOString());

        // Delete any existing codes for this user and type
        await run(
            'DELETE FROM verification_codes WHERE user_id = ? AND type = ?',
            [userId, type]
        );

        // Create new code - convert Date to ISO string for SQLite
        await run(
            `INSERT INTO verification_codes (
                user_id, 
                code, 
                type, 
                expires_at
            ) VALUES (?, ?, ?, ?)`,
            [userId, code, type, expiresAt.toISOString()]
        );

        return code;
    }

    static async verifyCode(userId, code, type) {
        // Get the verification code record
        const record = await queryOne(
            `SELECT * FROM verification_codes 
             WHERE user_id = ? 
             AND code = ? 
             AND type = ? 
             AND expires_at > CURRENT_TIMESTAMP`,
            [userId, code, type]
        );

        if (!record) {
            return {
                valid: false,
                error: 'Invalid or expired code'
            };
        }

        // Check attempts
        if (record.attempts >= this.MAX_ATTEMPTS) {
            // Delete the code if max attempts reached
            await run(
                'DELETE FROM verification_codes WHERE id = ?',
                [record.id]
            );
            return {
                valid: false,
                error: 'Too many incorrect attempts'
            };
        }

        // Increment attempts
        await run(
            'UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?',
            [record.id]
        );

        // If code is correct, delete it
        await run(
            'DELETE FROM verification_codes WHERE id = ?',
            [record.id]
        );

        return {
            valid: true
        };
    }

    static async deleteExpiredCodes() {
        await run('DELETE FROM verification_codes WHERE expires_at <= CURRENT_TIMESTAMP');
    }

    static async findCodesByUserIdAndType(userId, type) {
        return await query(
            `SELECT * FROM verification_codes 
             WHERE user_id = ? 
             AND type = ? 
             AND expires_at > CURRENT_TIMESTAMP
             ORDER BY created_at DESC`,
            [userId, type]
        );
    }
}

module.exports = Verification; 