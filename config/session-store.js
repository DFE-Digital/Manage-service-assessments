const { EventEmitter } = require('events');
const { db, run, query } = require('./database');

class SQLiteSessionStore extends EventEmitter {
    constructor(options = {}) {
        super();
        this.table = options.table || 'sessions';
    }

    get(sid, callback) {
        this._get(sid, callback);
    }

    set(sid, session, callback) {
        this._set(sid, session, callback);
    }

    destroy(sid, callback) {
        this._destroy(sid, callback);
    }

    touch(sid, session, callback) {
        this._touch(sid, session, callback);
    }

    all(callback) {
        this._all(callback);
    }

    clear(callback) {
        this._clear(callback);
    }

    length(callback) {
        this._length(callback);
    }

    async _get(sid, callback) {
        try {
            const rows = await query(
                'SELECT data FROM sessions WHERE session_id = ? AND expires > ?',
                [sid, Math.floor(Date.now() / 1000)]
            );
            
            if (rows.length > 0 && rows[0].data) {
                try {
                    const sessionData = JSON.parse(rows[0].data);
                    // Add required methods to session object
                    sessionData.reload = () => {};
                    sessionData.save = () => {};
                    sessionData.touch = () => {};
                    callback(null, sessionData);
                } catch (parseError) {
                    // Invalid session data, remove it and return empty session
                    await run('DELETE FROM sessions WHERE session_id = ?', [sid]);
                    const emptySession = { reload: () => {}, save: () => {}, touch: () => {} };
                    callback(null, emptySession);
                }
            } else {
                // Return empty session object instead of null
                const emptySession = { reload: () => {}, save: () => {}, touch: () => {} };
                callback(null, emptySession);
            }
        } catch (error) {
            callback(error);
        }
    }

    async _set(sid, session, callback) {
        try {
            const expires = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours
            const data = JSON.stringify(session);
            
            await run(
                'INSERT OR REPLACE INTO sessions (session_id, expires, data) VALUES (?, ?, ?)',
                [sid, expires, data]
            );
            
            callback(null);
        } catch (error) {
            callback(error);
        }
    }

    async _destroy(sid, callback) {
        try {
            await run('DELETE FROM sessions WHERE session_id = ?', [sid]);
            callback(null);
        } catch (error) {
            callback(error);
        }
    }

    async _touch(sid, session, callback) {
        try {
            const expires = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours
            
            await run(
                'UPDATE sessions SET expires = ? WHERE session_id = ?',
                [expires, sid]
            );
            
            callback(null);
        } catch (error) {
            callback(error);
        }
    }

    async _all(callback) {
        try {
            const rows = await query(
                'SELECT session_id, data FROM sessions WHERE expires > ?',
                [Math.floor(Date.now() / 1000)]
            );
            
            const sessions = {};
            rows.forEach(row => {
                sessions[row.session_id] = JSON.parse(row.data);
            });
            
            callback(null, sessions);
        } catch (error) {
            callback(error);
        }
    }

    async _clear(callback) {
        try {
            await run('DELETE FROM sessions');
            callback(null);
        } catch (error) {
            callback(error);
        }
    }

    async _length(callback) {
        try {
            const rows = await query(
                'SELECT COUNT(*) as count FROM sessions WHERE expires > ?',
                [Math.floor(Date.now() / 1000)]
            );
            
            callback(null, rows[0].count);
        } catch (error) {
            callback(error);
        }
    }

    createSession(req, session) {
        return session;
    }
}

module.exports = SQLiteSessionStore; 