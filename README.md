# Engine 402 - x402 API Gateway

A decentralized API gateway that enables common APIs to be adapted for AI agents through payment-based access instead of traditional API keys. Built with the X402 protocol, it allows developers to monetize their APIs by accepting micropayments in USDC rather than managing API credentials.

## Features

- **AI Agent Ready**: Designed specifically for integration with AI agents that can make direct payments
- **Decentralized Access Control**: No API keys needed - access is granted through on-chain payments
- **Flexible API Adaptation**: Convert any existing API endpoint into a pay-per-use service
- **Web-based Configuration**: Admin interface to add, edit, and delete API routes
- **Dynamic Pricing**: Set different USDC costs for different API endpoints
- **Network Flexibility**: Configure routes for test (Avalanche Fuji) or production (Avalanche) networks
- **Authentication Headers**: Optionally add authorization headers for private endpoints
- **Persistent Configuration**: Route settings are stored in a database (SQLite or Supabase)

## Prerequisites

- Node.js (v14 or higher)
- npm

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Techgethr/engine402.git
   cd Proxy
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. The SQLite database will be created automatically when the server starts by default

## Configuration

The proxy server can be configured using environment variables:

- `PORT`: Port on which the proxy server will run (default: 4000)
- `PAY_TO`: Wallet address that receives payments from API usage
- `FACILITATOR_URL`: URL of the X402 facilitator service (default: `https://facilitator.payai.network`)
- `USE_SUPABASE`: Set to `true` to use Supabase instead of SQLite (default: `false`)
- `SUPABASE_URL`: Your Supabase project URL (required if USE_SUPABASE=true)
- `SUPABASE_ANON_KEY`: Your Supabase anon key (required if USE_SUPABASE=true)

Example `.env` file for SQLite:
```env
PORT=4000
PAY_TO=0xYourWalletAddressHere
FACILITATOR_URL=https://facilitator.payai.network
USE_SUPABASE=false
```

Example `.env` file for Supabase:
```env
PORT=4000
PAY_TO=0xYourWalletAddressHere
FACILITATOR_URL=https://facilitator.payai.network
USE_SUPABASE=true
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

## Database Setup

### For SQLite (default)
No additional setup required. The SQLite database file will be created automatically when the server starts.

### For Supabase
1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Copy the SQL from `supabase_schema.sql` and run it in the Supabase SQL editor
3. Get your Project URL and anon key from Project Settings > API

## Usage

1. Start the server:
   ```bash
   npm start
   ```

2. Open your browser and navigate to `http://localhost:4000` to access the admin interface

3. Add API routes using the web interface:
   - **Path**: The path that should be proxied (e.g., `/openai`, `/weather`, `/data`)
   - **Target URL**: The URL to forward requests to (e.g., `https://api.openai.com`, `https://api.weather.com`)
   - **Cost (USDC)**: The cost in USDC to access this route (e.g., 0.0001 for small requests)
   - **Network**: Test (Avalanche Fuji) for development, Production (Avalanche) for live usage
   - **Auth Header**: Authorization header value for private endpoints (e.g., `Bearer secret123`)
   - **Status**: Enable or disable the route
   - **Enabled**: Toggle to activate/deactivate the route

4. The gateway will automatically start forwarding requests based on your configured routes, requiring payments for routes with costs > 0

5. If you want to disable payments for a route, set the cost to 0.

## API Routes

The proxy server also exposes API endpoints for managing routes programmatically:

- `GET /api/routes` - Get all configured routes
- `GET /api/routes/:id` - Get a specific route by ID
- `POST /api/routes` - Add a new route
- `PUT /api/routes/:id` - Update an existing route
- `DELETE /api/routes/:id` - Delete a route
- `GET /health` - Health check endpoint
- `GET /` - Admin web interface

## How It Works

The Engine 402 API gateway operates by:

1. Loading all enabled routes from the SQLite database with cost and network configuration
2. Matching incoming requests to configured routes (longest path match first)
3. For routes with cost > 0, validating payment through the X402 protocol
4. Forwarding requests to the appropriate target API after successful payment
5. Using the specified network (test/production) based on route configuration

## Example Configuration

To adapt the OpenAI compatible API for AI agents:
1. Add a route with Path: `/openai` and Target URL: `https://api.your-openai-compatible-service.com`
2. Set Cost: `0.001` USDC (for small API calls)
3. Set Network: `Production (Avalanche)`
4. Set Auth Header: `Bearer your-openai-compatible-service-api-key` (to authenticate with OpenAI compatible service backend)
5. When an AI agent makes a request to `http://your-gateway.com/openai/v1/chat/completions`, they must first pay 0.001 USDC, then the request is forwarded to `https://api.your-openai-compatible-service.com/v1/chat/completions` with your API key

## Benefits for AI Agents

- **No API Key Management**: AI agents don't need to store or manage API credentials
- **Built-in Micropayments**: Direct payment integration means seamless API access
- **Cost Predictability**: Know exact cost before making API requests
- **Decentralized Access**: No central authority controlling API access
- **Easy Integration**: Standard HTTP/HTTPS interface familiar to all AI frameworks

## License

[MIT](LICENSE)