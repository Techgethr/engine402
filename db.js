const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create/open database
const dbPath = path.join(__dirname, 'proxy_config.db');
const db = new sqlite3.Database(dbPath);

// Initialize the database
function initDatabase() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS proxy_routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE NOT NULL,
      target_url TEXT NOT NULL,
      enabled BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  return new Promise((resolve, reject) => {
    db.run(createTableSQL, (err) => {
      if (err) {
        console.error('Error creating proxy_routes table:', err.message);
        reject(err);
      } else {
        console.log('Proxy routes table created or already exists');
        
        // Insert default route if table is empty
        db.get("SELECT COUNT(*) as count FROM proxy_routes", (err, row) => {
          if (err) {
            console.error('Error checking table count:', err.message);
            reject(err);
          } else if (row.count === 0) {
            // Insert a default route for /api
            const defaultRouteSQL = `
              INSERT INTO proxy_routes (path, target_url, enabled) 
              VALUES ('/api', ?, 1)
            `;
            db.run(defaultRouteSQL, [process.env.API_URL || 'http://localhost:3000'], (err) => {
              if (err) {
                console.error('Error inserting default route:', err.message);
              } else {
                console.log('Default route for /api added');
              }
              resolve();
            });
          } else {
            resolve();
          }
        });
      }
    });
  });
}

// Get all proxy routes
function getAllRoutes() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM proxy_routes ORDER BY path', (err, rows) => {
      if (err) {
        console.error('Error getting routes:', err.message);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Get a specific route by path
function getRouteByPath(path) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM proxy_routes WHERE path = ?', [path], (err, row) => {
      if (err) {
        console.error('Error getting route by path:', err.message);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// Get a specific route by ID
function getRouteById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM proxy_routes WHERE id = ?', [id], (err, row) => {
      if (err) {
        console.error('Error getting route by ID:', err.message);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// Add a new route
function addRoute(path, target_url) {
  return new Promise((resolve, reject) => {
    const sql = 'INSERT INTO proxy_routes (path, target_url, enabled) VALUES (?, ?, 1)';
    db.run(sql, [path, target_url], function(err) {
      if (err) {
        console.error('Error adding route:', err.message);
        reject(err);
      } else {
        resolve({ id: this.lastID, path, target_url, enabled: 1 });
      }
    });
  });
}

// Update an existing route
function updateRoute(id, path, target_url, enabled) {
  return new Promise((resolve, reject) => {
    const sql = 'UPDATE proxy_routes SET path = ?, target_url = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    db.run(sql, [path, target_url, enabled, id], function(err) {
      if (err) {
        console.error('Error updating route:', err.message);
        reject(err);
      } else {
        resolve({ changes: this.changes, id, path, target_url, enabled });
      }
    });
  });
}

// Delete a route
function deleteRoute(id) {
  return new Promise((resolve, reject) => {
    const sql = 'DELETE FROM proxy_routes WHERE id = ?';
    db.run(sql, [id], function(err) {
      if (err) {
        console.error('Error deleting route:', err.message);
        reject(err);
      } else {
        resolve({ changes: this.changes });
      }
    });
  });
}

module.exports = {
  db,
  initDatabase,
  getAllRoutes,
  getRouteByPath,
  getRouteById,
  addRoute,
  updateRoute,
  deleteRoute
};