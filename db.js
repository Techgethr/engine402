const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create/open database
const dbPath = path.join(__dirname, 'proxy_config.db');
const db = new sqlite3.Database(dbPath);

// Initialize the database
function initDatabase() {
  // Check if cost column exists, if not, add it
  db.get("PRAGMA table_info(proxy_routes)", (err, row) => {
    if (err) {
      console.error('Error checking table schema:', err.message);
    } else {
      // If the table doesn't exist yet, create it with the cost column
      if (!row) {
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS proxy_routes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT UNIQUE NOT NULL,
            target_url TEXT NOT NULL,
            enabled BOOLEAN DEFAULT 1,
            cost_usdc REAL DEFAULT 0,
            auth_header TEXT,
            is_test BOOLEAN DEFAULT 1,  -- 1 for test (avalanche-fuji), 0 for production (avalanche)
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `;

        db.run(createTableSQL, (err) => {
          if (err) {
            console.error('Error creating proxy_routes table:', err.message);
          } else {
            console.log('Proxy routes table created with cost and auth header columns');
            insertDefaultRouteIfEmpty();
          }
        });
      } else {
        // Check if cost column exists
        db.all("PRAGMA table_info(proxy_routes)", (err, columns) => {
          if (err) {
            console.error('Error getting table schema:', err.message);
          } else {
            const hasCostColumn = columns.some(col => col.name === 'cost_usdc');
            const hasAuthColumn = columns.some(col => col.name === 'auth_header');

            if (!hasCostColumn) {
              // Add the cost column to existing table
              db.run("ALTER TABLE proxy_routes ADD COLUMN cost_usdc REAL DEFAULT 0", (err) => {
                if (err) {
                  console.error('Error adding cost column:', err.message);
                } else {
                  console.log('Cost column added to existing table');
                  // Continue with auth header check
                  checkAndAddAuthHeaderColumn();
                }
              });
            } else if (!hasAuthColumn) {
              // Cost column exists, now check auth column
              checkAndAddAuthHeaderColumn();
            } else {
              console.log('Proxy routes table already has all required columns');
              insertDefaultRouteIfEmpty();
            }
          }
        });
      }
    }
  });

  return new Promise((resolve, reject) => {
    // We'll handle the database setup asynchronously, but return resolve immediately
    // since the db operations are already started above
    resolve();
  });
}

// Helper function to check and add auth header column
function checkAndAddAuthHeaderColumn() {
  db.run("ALTER TABLE proxy_routes ADD COLUMN auth_header TEXT", (err) => {
    if (err && err.message.includes('duplicate column name')) {
      // Column already exists, which is fine
      console.log('Auth header column already exists');
    } else if (err) {
      console.error('Error adding auth header column:', err.message);
    } else {
      console.log('Auth header column added to existing table');
    }

    // Now check if is_test column exists
    checkAndAddIsTestColumn();
  });
}

// Helper function to check and add is_test column
function checkAndAddIsTestColumn() {
  db.all("PRAGMA table_info(proxy_routes)", (err, columns) => {
    if (err) {
      console.error('Error getting table schema:', err.message);
      insertDefaultRouteIfEmpty(); // Continue with default route insertion
    } else {
      const hasIsTestColumn = columns.some(col => col.name === 'is_test');

      if (!hasIsTestColumn) {
        // Add the is_test column to existing table
        db.run("ALTER TABLE proxy_routes ADD COLUMN is_test BOOLEAN DEFAULT 1", (err) => {
          if (err) {
            console.error('Error adding is_test column:', err.message);
          } else {
            console.log('is_test column added to existing table (default: test mode)');
          }
          // Always try to insert default route
          insertDefaultRouteIfEmpty();
        });
      } else {
        console.log('is_test column already exists');
        insertDefaultRouteIfEmpty();
      }
    }
  });
}

// Helper function to insert default route
function insertDefaultRouteIfEmpty() {
  // Insert default route if table is empty
  db.get("SELECT COUNT(*) as count FROM proxy_routes", (err, row) => {
    if (err) {
      console.error('Error checking table count:', err.message);
    } else if (row.count === 0) {
      // Insert a default route for /api (defaulting to test mode)
      const defaultRouteSQL = `
        INSERT INTO proxy_routes (path, target_url, enabled, cost_usdc, auth_header, is_test)
        VALUES ('/api', ?, 1, 0, NULL, 1)
      `;
      db.run(defaultRouteSQL, [process.env.API_URL || 'http://localhost:3000'], (err) => {
        if (err) {
          console.error('Error inserting default route:', err.message);
        } else {
          console.log('Default route for /api added (test mode)');
        }
      });
    }
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
function addRoute(path, target_url, cost_usdc = 0, auth_header = null, is_test = true) {
  return new Promise((resolve, reject) => {
    const sql = 'INSERT INTO proxy_routes (path, target_url, cost_usdc, auth_header, is_test, enabled) VALUES (?, ?, ?, ?, ?, 1)';
    db.run(sql, [path, target_url, cost_usdc || 0, auth_header, is_test ? 1 : 0], function(err) {
      if (err) {
        console.error('Error adding route:', err.message);
        reject(err);
      } else {
        resolve({ id: this.lastID, path, target_url, cost_usdc: cost_usdc || 0, auth_header: auth_header, is_test: is_test ? 1 : 0, enabled: 1 });
      }
    });
  });
}

// Update an existing route
function updateRoute(id, path, target_url, enabled, cost_usdc, auth_header, is_test) {
  return new Promise((resolve, reject) => {
    const sql = 'UPDATE proxy_routes SET path = ?, target_url = ?, enabled = ?, cost_usdc = ?, auth_header = ?, is_test = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    db.run(sql, [path, target_url, enabled, cost_usdc || 0, auth_header, is_test ? 1 : 0, id], function(err) {
      if (err) {
        console.error('Error updating route:', err.message);
        reject(err);
      } else {
        resolve({ changes: this.changes, id, path, target_url, enabled, cost_usdc: cost_usdc || 0, auth_header: auth_header, is_test: is_test ? 1 : 0 });
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