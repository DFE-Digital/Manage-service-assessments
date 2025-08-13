const csrf = require('csurf');
const cookieParser = require('cookie-parser');

exports.cookieParser = cookieParser();
exports.csrfProtection = csrf({ cookie: true });

exports.addCsrfToken = (req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
}; 