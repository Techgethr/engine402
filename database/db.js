const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { supabase, hasSupabaseConfig } = require('./supabaseClient');
require('dotenv').config();

// Use environment variable to determine which database to use
const USE_SUPABASE = process.env.USE_SUPABASE === 'true';

// Initialize SQLite database
let sqliteDb = null;

if (!USE_SUPABASE) {
  const dbPath = path.join(__dirname, 'proxy_config.db');
  sqliteDb = new sqlite3.Database(dbPath);
}

// Initialize the database (either SQLite or Supabase)
async function initDatabase() {
  if (USE_SUPABASE && hasSupabaseConfig) {
    console.log('Using Supabase database');
    // For Supabase, we assume the table is already created in the database
    // In a real implementation, you would create the table via Supabase migrations
    return Promise.resolve();
  } else {
    console.log('Using SQLite database');
    return new Promise((resolve, reject) => {
      // Check if cost column exists, if not, add it
      sqliteDb.get("PRAGMA table_info(proxy_routes)", (err, row) => {
        if (err) {
          console.error('Error checking table schema:', err.message);
          reject(err);
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
                is_test BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `;

            sqliteDb.run(createTableSQL, (err) => {
              if (err) {
                console.error('Error creating proxy_routes table:', err.message);
                reject(err);
              } else {
                console.log('Proxy routes table created with cost and auth header columns');
                insertDefaultRouteIfEmpty();
                resolve();
              }
            });
          } else {
            // Check if cost column exists
            sqliteDb.all("PRAGMA table_info(proxy_routes)", (err, columns) => {
              if (err) {
                console.error('Error getting table schema:', err.message);
                reject(err);
              } else {
                const hasCostColumn = columns.some(col => col.name === 'cost_usdc');
                const hasAuthColumn = columns.some(col => col.name === 'auth_header');

                if (!hasCostColumn) {
                  // Add the cost column to existing table
                  sqliteDb.run("ALTER TABLE proxy_routes ADD COLUMN cost_usdc REAL DEFAULT 0", (err) => {
                    if (err) {
                      console.error('Error adding cost column:', err.message);
                      reject(err);
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
                  resolve();
                }
              }
            });
          }
        }
      });
    });
  }
}

// Helper function to check and add auth header column for SQLite
function checkAndAddAuthHeaderColumn() {
  sqliteDb.run("ALTER TABLE proxy_routes ADD COLUMN auth_header TEXT", (err) => {
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

// Helper function to check and add is_test column for SQLite
function checkAndAddIsTestColumn() {
  sqliteDb.all("PRAGMA table_info(proxy_routes)", (err, columns) => {
    if (err) {
      console.error('Error getting table schema:', err.message);
      insertDefaultRouteIfEmpty(); // Continue with default route insertion
    } else {
      const hasIsTestColumn = columns.some(col => col.name === 'is_test');

      if (!hasIsTestColumn) {
        // Add the is_test column to existing table
        sqliteDb.run("ALTER TABLE proxy_routes ADD COLUMN is_test BOOLEAN DEFAULT 1", (err) => {
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

// Helper function to insert default route for SQLite
function insertDefaultRouteIfEmpty() {
  // Insert default route if table is empty
  sqliteDb.get("SELECT COUNT(*) as count FROM proxy_routes", (err, row) => {
    if (err) {
      console.error('Error checking table count:', err.message);
    } else if (row.count === 0) {
      // Insert a default route for /api (defaulting to test mode)
      const defaultRouteSQL = `
        INSERT INTO proxy_routes (path, target_url, enabled, cost_usdc, auth_header, is_test)
        VALUES ('/api', ?, 1, 0, NULL, 1)
      `;
      sqliteDb.run(defaultRouteSQL, [process.env.API_URL || 'http://localhost:3000'], (err) => {
        if (err) {
          console.error('Error inserting default route:', err.message);
        } else {
          console.log('Default route for /api added (test mode)');
        }
      });
    }
  });
}

// Helper function to convert SQLite row to consistent format
function formatRow(row) {
  return {
    id: row.id,
    path: row.path,
    target_url: row.target_url,
    enabled: Boolean(row.enabled),
    cost_usdc: parseFloat(row.cost_usdc) || 0,
    auth_header: row.auth_header || null,
    is_test: Boolean(row.is_test),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// Get all proxy routes
async function getAllRoutes() {
  if (USE_SUPABASE && hasSupabaseConfig) {
    // Supabase implementation
    const { data, error } = await supabase
      .from('proxy_routes')
      .select('*')
      .order('path');

    if (error) {
      console.error('Error getting routes from Supabase:', error.message);
      throw new Error(`Supabase error: ${error.message}`);
    }

    return data.map(formatRow);
  } else {
    // SQLite implementation
    return new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM proxy_routes ORDER BY path', (err, rows) => {
        if (err) {
          console.error('Error getting routes from SQLite:', err.message);
          reject(err);
        } else {
          resolve(rows.map(formatRow));
        }
      });
    });
  }
}

// Get a specific route by path
async function getRouteByPath(path) {
  if (USE_SUPABASE && hasSupabaseConfig) {
    // Supabase implementation
    const { data, error } = await supabase
      .from('proxy_routes')
      .select('*')
      .eq('path', path)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return null;
      }
      console.error('Error getting route by path from Supabase:', error.message);
      throw new Error(`Supabase error: ${error.message}`);
    }

    return data ? formatRow(data) : null;
  } else {
    // SQLite implementation
    return new Promise((resolve, reject) => {
      sqliteDb.get('SELECT * FROM proxy_routes WHERE path = ?', [path], (err, row) => {
        if (err) {
          console.error('Error getting route by path from SQLite:', err.message);
          reject(err);
        } else {
          resolve(row ? formatRow(row) : null);
        }
      });
    });
  }
}

// Get a specific route by ID
async function getRouteById(id) {
  if (USE_SUPABASE && hasSupabaseConfig) {
    // Supabase implementation
    const { data, error } = await supabase
      .from('proxy_routes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return null;
      }
      console.error('Error getting route by ID from Supabase:', error.message);
      throw new Error(`Supabase error: ${error.message}`);
    }

    return data ? formatRow(data) : null;
  } else {
    // SQLite implementation
    return new Promise((resolve, reject) => {
      sqliteDb.get('SELECT * FROM proxy_routes WHERE id = ?', [id], (err, row) => {
        if (err) {
          console.error('Error getting route by ID from SQLite:', err.message);
          reject(err);
        } else {
          resolve(row ? formatRow(row) : null);
        }
      });
    });
  }
}

// Add a new route
async function addRoute(path, target_url, cost_usdc = 0, auth_header = null, is_test = true) {
  if (USE_SUPABASE && hasSupabaseConfig) {
    // Supabase implementation
    const { data, error } = await supabase
      .from('proxy_routes')
      .insert([{
        path,
        target_url,
        cost_usdc: cost_usdc || 0,
        auth_header: auth_header,
        is_test: is_test ? 1 : 0,
        enabled: 1
      }])
      .select()
      .single();

    if (error) {
      console.error('Error adding route to Supabase:', error.message);
      throw new Error(`Supabase error: ${error.message}`);
    }

    return formatRow(data);
  } else {
    // SQLite implementation
    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO proxy_routes (path, target_url, cost_usdc, auth_header, is_test, enabled) VALUES (?, ?, ?, ?, ?, 1)';
      sqliteDb.run(sql, [path, target_url, cost_usdc || 0, auth_header, is_test ? 1 : 0], function(err) {
        if (err) {
          console.error('Error adding route to SQLite:', err.message);
          reject(err);
        } else {
          resolve({ 
            id: this.lastID, 
            path, 
            target_url, 
            cost_usdc: cost_usdc || 0, 
            auth_header: auth_header, 
            is_test: is_test ? 1 : 0, 
            enabled: 1 
          });
        }
      });
    });
  }
}

// Update an existing route
async function updateRoute(id, path, target_url, enabled, cost_usdc, auth_header, is_test) {
  if (USE_SUPABASE && hasSupabaseConfig) {
    // Supabase implementation
    const { data, error } = await supabase
      .from('proxy_routes')
      .update({
        path,
        target_url,
        enabled: enabled ? 1 : 0,
        cost_usdc: cost_usdc || 0,
        auth_header: auth_header,
        is_test: is_test ? 1 : 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating route in Supabase:', error.message);
      throw new Error(`Supabase error: ${error.message}`);
    }

    return { changes: data ? 1 : 0, ...formatRow(data) };
  } else {
    // SQLite implementation
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE proxy_routes SET path = ?, target_url = ?, enabled = ?, cost_usdc = ?, auth_header = ?, is_test = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      sqliteDb.run(sql, [path, target_url, enabled, cost_usdc || 0, auth_header, is_test ? 1 : 0, id], function(err) {
        if (err) {
          console.error('Error updating route in SQLite:', err.message);
          reject(err);
        } else {
          const changes = this.changes;
          resolve({ changes, id, path, target_url, enabled, cost_usdc: cost_usdc || 0, auth_header: auth_header, is_test: is_test ? 1 : 0 });
        }
      });
    });
  }
}

// Delete a route
async function deleteRoute(id) {
  if (USE_SUPABASE && hasSupabaseConfig) {
    // Supabase implementation
    const { data, error } = await supabase
      .from('proxy_routes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting route from Supabase:', error.message);
      throw new Error(`Supabase error: ${error.message}`);
    }

    return { changes: data ? data.length : 0 };
  } else {
    // SQLite implementation
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM proxy_routes WHERE id = ?';
      sqliteDb.run(sql, [id], function(err) {
        if (err) {
          console.error('Error deleting route from SQLite:', err.message);
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }
}

module.exports = {
  initDatabase,
  getAllRoutes,
  getRouteByPath,
  getRouteById,
  addRoute,
  updateRoute,
  deleteRoute
};