<p align="center">
  <h1 align="center">✈️ MCP TravelCode</h1>
  <p align="center">
    <strong>Model Context Protocol server for travel — flights, hotels, bookings</strong>
  </p>
  <p align="center">
    Give your AI assistant the power to search flights, book hotels, manage orders, and track flight status — all through natural language.
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/mcp-travelcode"><img src="https://img.shields.io/npm/v/mcp-travelcode.svg" alt="npm version"></a>
  <a href="https://github.com/egorceo/mcp-travelcode/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/mcp-travelcode.svg" alt="MIT License"></a>
  <a href="https://www.npmjs.com/package/mcp-travelcode"><img src="https://img.shields.io/npm/dm/mcp-travelcode.svg" alt="Downloads"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/node/v/mcp-travelcode.svg" alt="Node.js"></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-compatible-blue" alt="MCP Compatible"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#tools-19">Tools</a> •
  <a href="#supported-clients">Clients</a> •
  <a href="#example-conversations">Examples</a> •
  <a href="#authentication">Auth</a> •
  <a href="#development">Development</a>
</p>

---

## What is this?

**MCP TravelCode** is a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that connects AI assistants to the [TravelCode](https://travel-code.com) corporate travel API. It lets AI agents search for flights and hotels, create and manage bookings, check real-time flight status, and access delay statistics — all via natural language conversations.

Built for the MCP ecosystem — works with **Claude Desktop**, **Claude Code**, **Cursor**, **Windsurf**, **Cline**, **Continue**, **OpenClaw**, and any MCP-compatible client.

### Key Features

- 🔍 **Flight search** — multi-city, one-way, round-trip with cabin class and passenger filters
- 🏨 **Hotel search** — star rating, meal plans, refundability, price filters with SSE streaming
- 📊 **Flight status** — real-time tracking with delays, gates, terminals, and aircraft info
- 📈 **Delay statistics** — historical delay and cancellation data for flights and airports
- 📋 **Order management** — create, cancel, modify bookings; check cancellation conditions
- 🔐 **OAuth 2.1 + PKCE** — secure browser-based authentication, auto-refreshing tokens
- 🌍 **Airport & airline data** — search by name, city, IATA/ICAO code
- ⚡ **Async polling** — automatic background polling for flight search results
- 🔄 **Dual transport** — stdio (local) and HTTP/SSE (remote) support

## Quick Start

### Hosted server (recommended)

No install, no local token files. Point any MCP-capable client at:

```
https://mcp.travel-code.com/mcp
```

On first use the client opens a browser window, you log in to TravelCode,
approve the consent screen, and you're done. Works in Claude for Web,
Claude Desktop, Claude Code, Cursor, Windsurf, and any other client that
supports HTTP+OAuth MCP servers.

| Client | How to add |
|---|---|
| **Claude Web / Desktop** | Settings → Connectors → **Add custom connector** → URL `https://mcp.travel-code.com/mcp` |
| **Claude Code** | `claude mcp add --transport http travelcode https://mcp.travel-code.com/mcp` |
| **Cursor** | Settings → MCP → Add Server → URL `https://mcp.travel-code.com/mcp` |
| **Windsurf / VS Code / JetBrains / others** | Use the client's MCP config and set transport = HTTP (Streamable), URL = `https://mcp.travel-code.com/mcp` |

Once connected, the assistant can search flights, find hotels, view and manage
your orders, and pull delay stats — on behalf of the signed-in TravelCode user.

### Local install & authenticate (stdio)

For local development or air-gapped setups:

```bash
# 1. Authenticate with your TravelCode account (opens browser, one-time)
npx mcp-travelcode-auth auth
```

### Claude Desktop (local stdio)

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "travelcode": {
      "command": "npx",
      "args": ["mcp-travelcode"]
    }
  }
}
```

Restart Claude Desktop — done! Ask Claude to search flights, book hotels, or check flight status.

### Claude Code

```bash
claude mcp add travelcode -- npx mcp-travelcode
```

### ChatGPT Desktop

Go to **Settings → Tools → Add MCP Server**, then add:

```json
{
  "command": "npx",
  "args": ["mcp-travelcode"]
}
```

### Gemini / Google AI Studio

Add to your MCP server configuration:

```json
{
  "mcpServers": {
    "travelcode": {
      "command": "npx",
      "args": ["mcp-travelcode"]
    }
  }
}
```

### GitHub Copilot (VS Code)

Add to your VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcpServers": {
    "travelcode": {
      "command": "npx",
      "args": ["mcp-travelcode"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "travelcode": {
      "command": "npx",
      "args": ["mcp-travelcode"]
    }
  }
}
```

### Windsurf / Cline / Continue

Add to your MCP configuration (typically `mcp_config.json` or settings):

```json
{
  "mcpServers": {
    "travelcode": {
      "command": "npx",
      "args": ["mcp-travelcode"]
    }
  }
}
```

### Zed

Add to your Zed `settings.json`:

```json
{
  "context_servers": {
    "travelcode": {
      "command": {
        "path": "npx",
        "args": ["mcp-travelcode"]
      }
    }
  }
}
```

### JetBrains IDEs (IntelliJ, WebStorm, PyCharm)

Go to **Settings → Tools → AI Assistant → MCP Servers → Add**, set command to `npx` with args `mcp-travelcode`.

### OpenClaw

```yaml
mcp:
  servers:
    travelcode:
      command: npx
      args: ["mcp-travelcode"]
```

### HTTP Transport (Remote / Multi-client)

```bash
npx mcp-travelcode --http          # Start HTTP+SSE server
# or
npm run start:http                  # If installed locally
```

Connect any MCP client to `http://localhost:3000/mcp` via SSE transport.

## Supported Clients

Works with **any MCP-compatible client** — including all major AI assistants, IDEs, and coding tools:

| Client | Transport | Status |
|--------|-----------|--------|
| [ChatGPT Desktop](https://openai.com/chatgpt/desktop/) | stdio | ✅ Compatible |
| [Claude Desktop](https://claude.ai/download) | stdio | ✅ Tested |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | stdio | ✅ Tested |
| [Gemini](https://gemini.google.com) | stdio | ✅ Compatible |
| [GitHub Copilot](https://github.com/features/copilot) | stdio | ✅ Compatible |
| [Cursor](https://cursor.com) | stdio | ✅ Tested |
| [Windsurf](https://codeium.com/windsurf) | stdio | ✅ Compatible |
| [Cline](https://github.com/cline/cline) | stdio | ✅ Compatible |
| [Continue](https://continue.dev) | stdio | ✅ Compatible |
| [Zed](https://zed.dev) | stdio | ✅ Compatible |
| [JetBrains IDEs](https://www.jetbrains.com/) | stdio | ✅ Compatible |
| [VS Code](https://code.visualstudio.com/) | stdio | ✅ Compatible |
| [OpenClaw](https://openclaw.ai) | stdio | ✅ Tested |
| [MCP Inspector](https://github.com/modelcontextprotocol/inspector) | stdio | ✅ Tested |
| Any MCP client | stdio / HTTP+SSE | ✅ Compatible |

## Tools (19)

### ✈️ Flight Search & Reference Data

| Tool | Description |
|------|-------------|
| `search_airports` | Find airports by name, city, or IATA/ICAO code |
| `get_airport` | Get detailed airport information (location, timezone, terminals) |
| `search_airlines` | Find airlines by name or IATA/ICAO code |
| `search_flights` | Search flights — one-way, round-trip, multi-city. Handles async polling automatically |
| `get_flight_results` | Filter, sort, and paginate existing search results |

### 📊 Flight Statistics

| Tool | Description |
|------|-------------|
| `get_flight_status` | Real-time flight status — delays, gates, terminals, aircraft type |
| `get_airport_flights` | Live airport departure/arrival board for a time window |
| `get_flight_delay_stats` | Historical on-time performance and delay statistics for a flight number |
| `get_airport_delay_stats` | Airport-wide delay and cancellation statistics for a date |

### 🏨 Hotel Search

| Tool | Description |
|------|-------------|
| `search_hotel_locations` | Find cities, regions, or specific hotels by name (returns location IDs for search) |
| `get_hotel_location` | Get location details by ID |
| `search_hotels` | Search hotels with filters — star rating, price range, meal plan, refundability. Results stream via SSE |

### 📋 Order Management

| Tool | Description |
|------|-------------|
| `list_orders` | List all orders with filtering (status, date range) and pagination |
| `get_order` | Get full order details — passengers, segments, pricing, ticket numbers |
| `create_order` | Book a flight from search results — add passengers, contacts, payment |
| `check_order_cancellation` | Check cancellation conditions, penalties, and refund estimate before canceling |
| `cancel_order` | Cancel an order with refund processing |
| `check_order_modification` | Check what modifications are allowed (rebooking, baggage, contacts) |
| `modify_order` | Modify an order — update contacts, passport info, rebook, add baggage |

## Example Conversations

### Search Flights

> **You:** Find me flights from New York to London on April 15, economy class, 2 passengers
>
> **AI:** *Uses `search_airports` → `search_flights` → returns formatted flight options with prices, durations, and stops*

### Book a Hotel

> **You:** I need a 4-star hotel in Tokyo for May 1-5, 2 adults, with breakfast included
>
> **AI:** *Uses `search_hotel_locations` → `search_hotels` with star rating and meal plan filters → shows options*

### Check Flight Status

> **You:** Is my flight AA100 on time today?
>
> **AI:** *Uses `get_flight_status` → shows real-time departure/arrival times, gate, terminal, any delays*

### Manage Bookings

> **You:** Show my recent orders. Can I cancel order #12345?
>
> **AI:** *Uses `list_orders` → `check_order_cancellation` → shows cancellation conditions and refund estimate → `cancel_order` if confirmed*

### Flight Delay Analysis

> **You:** How often is BA115 delayed? What are the stats?
>
> **AI:** *Uses `get_flight_delay_stats` → shows historical on-time percentage, average delays, cancellation rate*

## Authentication

MCP TravelCode uses **OAuth 2.1 with PKCE** — the modern standard for secure authentication. No API keys to manage or rotate.

```bash
# Sign in (opens browser for secure authentication)
npx mcp-travelcode-auth auth

# Check token status and expiration
npx mcp-travelcode-auth status

# Sign out and clear tokens
npx mcp-travelcode-auth logout
```

- Tokens are stored in `~/.travelcode/tokens.json`
- Access tokens auto-refresh when expired — no manual intervention needed
- Each user authenticates with their own TravelCode account

**Legacy mode:** Set `TRAVELCODE_API_TOKEN` environment variable to use a static API token (skips OAuth).

## Configuration

| Environment Variable | Required | Default | Description |
|---------------------|----------|---------|-------------|
| `TRAVELCODE_API_TOKEN` | No | — | Static API token (bypasses OAuth) |
| `TRAVELCODE_API_BASE_URL` | No | `https://api.travel-code.com/v1` | API base URL |
| `TRAVELCODE_POLL_INTERVAL_MS` | No | `2000` | Flight search polling interval in milliseconds |
| `TRAVELCODE_POLL_TIMEOUT_MS` | No | `90000` | Flight search timeout in milliseconds |

## Development

```bash
git clone https://github.com/egorceo/mcp-travelcode.git
cd mcp-travelcode
npm install

npm run dev          # Run with tsx (hot reload)
npm run build        # Compile TypeScript
npm test             # Run tests
npm run inspect      # Test interactively with MCP Inspector
npm run start:http   # Start HTTP+SSE transport server
```

### Project Structure

```
src/
├── index.ts          # stdio entry point
├── http-server.ts    # HTTP+SSE entry point
├── server.ts         # MCP server setup & tool registration
├── config.ts         # Environment configuration
├── auth/             # OAuth 2.1 PKCE flow & CLI
├── client/           # TravelCode API client
├── tools/            # 19 MCP tool implementations
├── formatters/       # Response formatting
└── polling/          # Async flight search polling
```

## Tech Stack

- **TypeScript** — full type safety
- **[@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)** — official MCP SDK
- **Zod** — runtime schema validation for all tool inputs
- **Express 5** — HTTP transport server
- **Vitest** — testing framework

## Use Cases

- **Corporate travel management** — search and book business travel through AI assistants
- **Travel agencies** — integrate flight and hotel search into AI-powered agent workflows
- **Trip planning** — find flights, compare prices, check schedules via natural conversation
- **Flight monitoring** — track flight status, delays, gate changes in real-time
- **Travel analytics** — analyze flight delay patterns, airport performance, route statistics
- **Booking automation** — automate repetitive booking tasks through AI agents
- **Customer support** — help travelers check bookings, modify orders, handle cancellations

## Related

- [Model Context Protocol](https://modelcontextprotocol.io) — the open standard for AI tool integration
- [TravelCode](https://travel-code.com) — corporate travel management platform
- [MCP Servers Directory](https://github.com/modelcontextprotocol/servers) — official MCP server registry
- [Claude Desktop](https://claude.ai/download) — AI assistant with MCP support

## Contributing

Contributions welcome! Please open an issue or submit a pull request.

## License

[MIT](LICENSE) © [Travel Code](https://travel-code.com)
