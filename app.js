// Load environment variables
require('dotenv').config();

const express = require('express');
const nunjucks = require('nunjucks');
const compression = require('compression');
const path = require('path');
const session = require('express-session');
const SQLiteSessionStore = require('./config/session-store');
const { cookieParser, csrfProtection, addCsrfToken } = require('./middleware/csrf');
const { populateUser } = require('./middleware/auth');
const { formatDate } = require('./filters/date-filters');
const { initDatabase } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3001;

app.locals.serviceName = process.env.SERVICE_NAME || 'Service name not set';


const appRoutes = require('./routes/routes.js');

// Compression middleware
app.use(compression());

// Static middleware
app.use(express.static(path.join(__dirname, 'public')));

// Nunjucks setup
const env = nunjucks.configure('views', {
    autoescape: true,
    express: app,
    noCache: process.env.NODE_ENV !== 'production',
    watch: process.env.NODE_ENV !== 'production'
  });

// Add custom filters
env.addFilter('formatDate', formatDate);

app.use('/', express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Add CSRF protection
app.use(cookieParser);
app.use(csrfProtection);
app.use(addCsrfToken);

// Add session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Add authentication middleware
app.use(populateUser);

// Make user data available to all views
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

app.set('view engine', 'html');

// Use application routes
app.use('/', appRoutes);


// Clean URLs
app.get(/\.html?$/i, function (req, res) {
  let urlPath = req.path;
  const parts = urlPath.split('.');
  parts.pop();
  urlPath = parts.join('.');
  res.redirect(urlPath);
});

// Dynamic Route Matching for URLs without extensions
app.get(/^([^.]+)$/, function (req, res, next) {
  matchRoutes(req, res, next);
});

// Route matching function
function matchRoutes(req, res, next) {
    let path = req.path;
  
    // Remove the first slash, render won't work with it
    path = path.startsWith('/') ? path.slice(1) : path;
  
    // If it's blank, render the root index
    if (path === '') {
      path = 'index';
    }
  
    console.log(path)
  
    renderPath(path, res, next);
  }
  
  function renderPath(path, res, next) {
    // Try to render the path
    res.render(path, function (error, html) {
      if (!error) {
        // Success - send the response
        res.set({ 'Content-type': 'text/html; charset=utf-8' })
        res.end(html)
        return
      }
      if (!error.message.startsWith('template not found')) {
        // We got an error other than template not found - call next with the error
        next(error)
        return
      }
      if (!path.endsWith('/index')) {
        // Maybe it's a folder - try to render [path]/index.html
        renderPath(path + '/index', res, next)
        return
      }
      // We got template not found both times - call next to trigger the 404 page
      next()
    })
  }


// 404 page
app.use((req, res) => {
    res.status(404).render('404.html', {
      title: 'Page Not Found'
    });
  });
  

// Initialize database and start server
async function startServer() {
    try {
        // Initialize database
        await initDatabase();
        console.log('Database initialized successfully');
        
        app.listen(PORT, () => {
            console.log(`App running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}


// Initialize database before starting the server
startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});

module.exports = app; 

