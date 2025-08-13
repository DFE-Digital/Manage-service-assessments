const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

// Database connection
const db = new sqlite3.Database(
    path.join(__dirname, '..', 'data', 'database.sqlite'),
    sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
    (err) => {
        if (err) {
            console.error('Error opening database:', err);
            process.exit(1);
        }
    }
);

// Initialize database tables
const initDatabase = async () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Users table
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    first_name TEXT NOT NULL,
                    last_name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    mobile_number TEXT,
                    password_hash TEXT NOT NULL,
                    password_changed_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });

            // Email verification tokens table
            db.run(`
                CREATE TABLE IF NOT EXISTS email_verification_tokens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    token TEXT NOT NULL,
                    expires_at DATETIME NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            `);

            // Password reset tokens table
            db.run(`
                CREATE TABLE IF NOT EXISTS password_reset_tokens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    token TEXT NOT NULL,
                    expires_at DATETIME NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            `);

            // Verification codes table (for SMS/2FA)
            db.run(`
                CREATE TABLE IF NOT EXISTS verification_codes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    code TEXT NOT NULL,
                    type TEXT NOT NULL,
                    attempts INTEGER DEFAULT 0,
                    expires_at DATETIME NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            `);

            // Add index for faster code lookups
            db.run(`
                CREATE INDEX IF NOT EXISTS idx_verification_codes_code 
                ON verification_codes(code, type, expires_at)
            `);

            // Sessions table for persistent session storage
            db.run(`
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    data TEXT NOT NULL,
                    expires INTEGER NOT NULL
                )
            `);

            // Add index for session expiry cleanup
            db.run(`
                CREATE INDEX IF NOT EXISTS idx_sessions_expires 
                ON sessions(expires)
            `);

            // Organisations table
            db.run(`
                CREATE TABLE IF NOT EXISTS organisations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Organisation domains table
            db.run(`
                CREATE TABLE IF NOT EXISTS organisation_domains (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    organisation_id INTEGER NOT NULL,
                    domain TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (organisation_id) REFERENCES organisations (id),
                    UNIQUE(domain)
                )
            `);

            // Roles table
            db.run(`
                CREATE TABLE IF NOT EXISTS roles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Super admins table
            db.run(`
                CREATE TABLE IF NOT EXISTS super_admins (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    UNIQUE(user_id)
                )
            `);

            // Organisation admins table
            db.run(`
                CREATE TABLE IF NOT EXISTS organisation_admins (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    organisation_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (organisation_id) REFERENCES organisations (id),
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    UNIQUE(organisation_id, user_id)
                )
            `);

            // User roles table
            db.run(`
                CREATE TABLE IF NOT EXISTS user_roles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    role_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    FOREIGN KEY (role_id) REFERENCES roles (id),
                    UNIQUE(user_id, role_id)
                )
            `);

            // Assessors table
            db.run(`
                CREATE TABLE IF NOT EXISTS assessors (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    organisation_id INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'active',
                    cross_gov_assessor BOOLEAN NOT NULL DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    FOREIGN KEY (organisation_id) REFERENCES organisations (id),
                    UNIQUE(user_id, organisation_id)
                )
            `);

            // Assessor roles table
            db.run(`
                CREATE TABLE IF NOT EXISTS assessor_roles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    assessor_id INTEGER NOT NULL,
                    role TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (assessor_id) REFERENCES assessors (id),
                    UNIQUE(assessor_id, role)
                )
            `);

            // Setup tokens table for new user account setup
            db.run(`
                CREATE TABLE IF NOT EXISTS setup_tokens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    email TEXT NOT NULL,
                    token TEXT NOT NULL UNIQUE,
                    expires_at DATETIME NOT NULL,
                    used INTEGER DEFAULT 0,
                    used_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            `);

            // Service standards table for super admin settings
            db.run(`
                CREATE TABLE IF NOT EXISTS service_standards (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    number INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    url TEXT NOT NULL,
                    version INTEGER DEFAULT 1,
                    is_active INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(number, version)
                )
            `);

            // Department settings table for organisation admin settings
            db.run(`
                CREATE TABLE IF NOT EXISTS department_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    organisation_id INTEGER NOT NULL,
                    fips_endpoint TEXT,
                    fips_api_key TEXT,
                    fips_enabled INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE,
                    UNIQUE(organisation_id)
                )
            `);

            // Department standards table for organisation-specific standards
            db.run(`
                CREATE TABLE IF NOT EXISTS department_standards (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    organisation_id INTEGER NOT NULL,
                    reference TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    url TEXT NOT NULL,
                    version INTEGER DEFAULT 1,
                    is_active INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE,
                    UNIQUE(organisation_id, reference, version)
                )
            `);

            // Insert default roles if they don't exist
            db.run(`
                INSERT OR IGNORE INTO roles (name) VALUES 
                ('SuperAdmin'), 
                ('OrganisationAdmin'), 
                ('User')
            `);

            // Insert default organisation if it doesn't exist
            db.run(`
                INSERT OR IGNORE INTO organisations (name) VALUES 
                ('Department for Education')
            `);

            // Insert default domain for DfE if it doesn't exist
            db.run(`
                INSERT OR IGNORE INTO organisation_domains (organisation_id, domain) VALUES 
                (1, 'education.gov.uk')
            `);

            // Insert default service standards (GOV.UK Service Standard 14 points)
            const defaultStandards = [
                { number: 1, title: 'Understand users and their needs', description: 'Take time to understand your users and their needs. Develop knowledge of your users and what that means for your service design.', url: 'https://www.gov.uk/service-manual/service-standard/point-1-understand-user-needs' },
                { number: 2, title: 'Solve a whole problem for users', description: 'Work towards creating a service that solves a whole problem for users.', url: 'https://www.gov.uk/service-manual/service-standard/point-2-solve-a-whole-problem' },
                { number: 3, title: 'Provide a joined up experience across all channels', description: 'Work towards creating a service that provides a joined up experience across all channels.', url: 'https://www.gov.uk/service-manual/service-standard/point-3-join-up-across-channels' },
                { number: 4, title: 'Make the service simple to use', description: 'Build a service that is simple to use so that people can succeed first time.', url: 'https://www.gov.uk/service-manual/service-standard/point-4-make-the-service-simple-to-use' },
                { number: 5, title: 'Make sure everyone can use the service', description: 'Provide a service that everyone can use, including people with disabilities or other legally protected characteristics.', url: 'https://www.gov.uk/service-manual/service-standard/point-5-make-sure-everyone-can-use-the-service' },
                { number: 6, title: 'Have a multidisciplinary team', description: 'Put in place a sustainable multidisciplinary team that can design, build and operate the service.', url: 'https://www.gov.uk/service-manual/service-standard/point-6-have-a-multidisciplinary-team' },
                { number: 7, title: 'Use agile ways of working', description: 'Use agile ways of working so you can respond to user needs and deliver value early and often.', url: 'https://www.gov.uk/service-manual/service-standard/point-7-use-agile-ways-of-working' },
                { number: 8, title: 'Iterate and improve frequently', description: 'Make sure you have the capacity, resources and technical flexibility to iterate and improve the service frequently.', url: 'https://www.gov.uk/service-manual/service-standard/point-8-iterate-and-improve-frequently' },
                { number: 9, title: 'Create a secure service which protects users\' privacy', description: 'Evaluate what data and information your service will be providing or storing.', url: 'https://www.gov.uk/service-manual/service-standard/point-9-create-a-secure-service' },
                { number: 10, title: 'Define what success looks like and publish performance data', description: 'Work out what success looks like for your service and identify metrics which will tell you what\'s working and what can be improved.', url: 'https://www.gov.uk/service-manual/service-standard/point-10-define-success-publish-performance-data' },
                { number: 11, title: 'Choose the right tools and technology', description: 'Choose tools and technology that let you create a high quality service in a cost effective way.', url: 'https://www.gov.uk/service-manual/service-standard/point-11-choose-the-right-tools-and-technology' },
                { number: 12, title: 'Make new source code open', description: 'Make all new source code open and reusable, and publish it under appropriate licences.', url: 'https://www.gov.uk/service-manual/service-standard/point-12-make-new-source-code-open' },
                { number: 13, title: 'Use and contribute to open standards, common components and patterns', description: 'Use open standards and common government platforms where available.', url: 'https://www.gov.uk/service-manual/service-standard/point-13-use-common-standards-components-patterns' },
                { number: 14, title: 'Operate a reliable service', description: 'Minimise service downtime and have a plan to deal with it when it does happen.', url: 'https://www.gov.uk/service-manual/service-standard/point-14-operate-a-reliable-service' }
            ];

            defaultStandards.forEach(standard => {
                db.run(`
                    INSERT OR IGNORE INTO service_standards (number, title, description, url) VALUES (?, ?, ?, ?)
                `, [standard.number, standard.title, standard.description, standard.url]);
            });
        });
    });
};

// Helper function to run parameterized queries
const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// Helper function to run a single parameterized query and get first result
const queryOne = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// Helper function to run parameterized insert/update/delete
const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
};

// Helper function to get organisation by domain
const getOrganisationByDomain = (domain) => {
    return queryOne(`
        SELECT o.* FROM organisations o
        JOIN organisation_domains od ON o.id = od.organisation_id
        WHERE od.domain = ?
    `, [domain]);
};

// Helper function to get user roles
const getUserRoles = (userId) => {
    return query(`
        SELECT r.name FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ?
    `, [userId]);
};

// Helper function to check if user is super admin
const isSuperAdmin = (userId) => {
    return queryOne(`
        SELECT 1 FROM super_admins WHERE user_id = ?
    `, [userId]);
};

// Helper function to check if user is organisation admin
const isOrganisationAdmin = (userId, organisationId) => {
    return queryOne(`
        SELECT 1 FROM organisation_admins 
        WHERE user_id = ? AND organisation_id = ?
    `, [userId, organisationId]);
};

// Helper function to get user's organisation
const getUserOrganisation = (userId) => {
    return queryOne(`
        SELECT o.* FROM organisations o
        JOIN assessors a ON o.id = a.organisation_id
        WHERE a.user_id = ?
    `, [userId]);
};

// Helper function to create or get user
const createOrGetUser = async (userData) => {
    // Check if user exists
    const existingUser = await queryOne('SELECT * FROM users WHERE email = ?', [userData.email]);
    
    if (existingUser) {
        return existingUser;
    }
    
    // Create new user
    const result = await run(`
        INSERT INTO users (first_name, last_name, email, password_hash)
        VALUES (?, ?, ?, ?)
    `, [userData.first_name, userData.last_name, userData.email, userData.password_hash]);
    
    return await queryOne('SELECT * FROM users WHERE id = ?', [result.id]);
};

// Helper function to assign user to organisation
const assignUserToOrganisation = async (userId, organisationId) => {
    // Check if already assigned
    const existing = await queryOne(`
        SELECT 1 FROM assessors WHERE user_id = ? AND organisation_id = ?
    `, [userId, organisationId]);
    
    if (!existing) {
        await run(`
            INSERT INTO assessors (user_id, organisation_id, status)
            VALUES (?, ?, 'active')
        `, [userId, organisationId]);
    }
};

module.exports = {
    db,
    initDatabase,
    query,
    queryOne,
    run,
    getOrganisationByDomain,
    getUserRoles,
    isSuperAdmin,
    isOrganisationAdmin,
    getUserOrganisation,
    createOrGetUser,
    assignUserToOrganisation
}; 