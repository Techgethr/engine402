const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 4000;
const API_URL = process.env.API_URL || 'http://localhost:3000'; // Default to API running on port 3000

// Import database functions
const {
  initDatabase,
  getAllRoutes,
  getRouteByPath,
  getRouteById,
  addRoute,
  updateRoute,
  deleteRoute
} = require('./db');

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// API routes for managing proxy configurations
app.get('/api/routes', async (req, res) => {
  try {
    const routes = await getAllRoutes();
    res.json(routes);
  } catch (error) {
    console.error('Error getting routes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/routes/:id', async (req, res) => {
  try {
    const route = await getRouteById(req.params.id);
    if (route) {
      res.json(route);
    } else {
      res.status(404).json({ error: 'Route not found' });
    }
  } catch (error) {
    console.error('Error getting route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/routes', async (req, res) => {
  try {
    const { path, target_url, enabled } = req.body;
    if (!path || !target_url) {
      return res.status(400).json({ error: 'Path and target URL are required' });
    }

    // Validate path format
    if (!path.startsWith('/')) {
      return res.status(400).json({ error: 'Path must start with /' });
    }

    const newRoute = await addRoute(path, target_url);
    res.status(201).json(newRoute);
  } catch (error) {
    console.error('Error adding route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/routes/:id', async (req, res) => {
  try {
    const { path, target_url, enabled } = req.body;
    const id = req.params.id;

    if (!path || !target_url) {
      return res.status(400).json({ error: 'Path and target URL are required' });
    }

    // Validate path format
    if (!path.startsWith('/')) {
      return res.status(400).json({ error: 'Path must start with /' });
    }

    const updatedRoute = await updateRoute(id, path, target_url, enabled);
    if (updatedRoute.changes > 0) {
      res.json(updatedRoute);
    } else {
      res.status(404).json({ error: 'Route not found' });
    }
  } catch (error) {
    console.error('Error updating route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/routes/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await deleteRoute(id);
    if (result.changes > 0) {
      res.json({ message: 'Route deleted successfully' });
    } else {
      res.status(404).json({ error: 'Route not found' });
    }
  } catch (error) {
    console.error('Error deleting route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public endpoint for proxy health check
app.get('/health', (req, res) => {
  res.json({
    status: 'Proxy is running',
    timestamp: new Date().toISOString()
  });
});

// Route to serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dynamic proxy middleware based on stored routes
app.use(async (req, res, next) => {
  // Get all enabled routes from the database
  try {
    const routes = await getAllRoutes();
    const enabledRoutes = routes.filter(route => route.enabled);

    // Find the best matching route for the current request path
    // Sort by path length in descending order to match longer paths first
    enabledRoutes.sort((a, b) => b.path.length - a.path.length);

    for (const route of enabledRoutes) {
      // Check if the request path starts with the route path
      if (req.path.startsWith(route.path)) {
        // Create proxy middleware for this specific route
        const routeProxy = createProxyMiddleware({
          target: route.target_url,
          changeOrigin: true,
          pathRewrite: {
            [`^${route.path}`]: '', // Remove the route path when forwarding (e.g., /api from /api/users)
          },
          logProvider: () => console,
          onProxyReq: (proxyReq, req, res) => {
            console.log(`Proxying ${req.method} request to: ${route.target_url}${req.url}`);
          },
          onProxyRes: (proxyRes, req, res) => {
            console.log(`Received response with status: ${proxyRes.statusCode}`);
          }
        });

        // Execute the proxy middleware for this specific route
        return routeProxy(req, res, next);
      }
    }

    // If no route matches, continue to the catch-all handler
    next();
  } catch (error) {
    console.error('Error finding route for proxy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Catch-all route for non-matching routes
app.use('*', (req, res) => {
  res.status(404).json({ error: 'No matching proxy route found for this path' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Proxy error occurred' });
});

// Initialize the database when the server starts
initDatabase()
  .then(() => {
    console.log('Database initialized successfully');

    app.listen(PORT, () => {
      console.log(`Proxy server is running on port ${PORT}`);
      console.log(`Proxying requests to configured routes`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });