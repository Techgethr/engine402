# Generic Proxy Server

A flexible proxy server with a web interface for managing proxy routes. The proxy allows administrators to configure which routes should be proxied to specific target URLs via a web-based interface.

## Features

- **Web-based Configuration**: Admin interface to add, edit, and delete proxy routes
- **Dynamic Routing**: Routes are loaded from a SQLite database at runtime
- **Route Management**: Enable/disable routes as needed
- **Cost-based Access**: Set USDC cost for accessing each route
- **Persistent Configuration**: Route settings are stored in a database
- **Logging**: Request forwarding is logged to console

## Prerequisites

- Node.js (v14 or higher)
- npm

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd Proxy
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. The SQLite database will be created automatically when the server starts

## Configuration

The proxy server can be configured using environment variables:

- `PORT`: Port on which the proxy server will run (default: 4000)
- `API_URL`: Default target URL for the initial `/api` route (default: `http://localhost:3000`)

Example `.env` file:
```env
PORT=4000
API_URL=http://localhost:3000
```

## Usage

1. Start the server:
   ```bash
   npm start
   ```

2. Open your browser and navigate to `http://localhost:4000` to access the admin interface

3. Add proxy routes using the web interface:
   - **Path**: The path that should be proxied (e.g., `/api`)
   - **Target URL**: The URL to forward requests to (e.g., `http://localhost:3000`)
   - **Cost (USDC)**: The cost in USDC to access this route (optional)
   - **Status**: Enable or disable the route

4. The proxy will automatically start forwarding requests based on your configured routes

## API Routes

The proxy server also exposes API endpoints for managing routes programmatically:

- `GET /api/routes` - Get all configured routes
- `GET /api/routes/:id` - Get a specific route by ID
- `POST /api/routes` - Add a new route
- `PUT /api/routes/:id` - Update an existing route
- `DELETE /api/routes/:id` - Delete a route
- `GET /health` - Health check endpoint
- `GET /` - Admin web interface

## Project Structure

```
Proxy/
├── server.js          # Main server file
├── db.js              # Database operations
├── public/            # Static files for web interface
│   └── index.html     # Admin interface
├── package.json       # Dependencies and scripts
└── proxy_config.db    # SQLite database (auto-generated)
```

## How It Works

The proxy server operates by:

1. Loading all enabled routes from the SQLite database
2. Matching incoming requests to configured routes (longest path match first)
3. Forwarding requests to the appropriate target URL based on the route configuration
4. Logging the request forwarding for monitoring

## Example Configuration

To proxy requests from `/api` to `http://localhost:3000`:
1. Add a route with Path: `/api` and Target URL: `http://localhost:3000`
2. When a request is made to `http://localhost:4000/api/users`, it will be forwarded to `http://localhost:3000/users`

## Database Schema

The SQLite database contains one table:

```sql
CREATE TABLE proxy_routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT UNIQUE NOT NULL,
  target_url TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  cost_usdc REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## License

[MIT](LICENSE)