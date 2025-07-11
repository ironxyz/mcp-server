# @ironxyz/mcp-server

Official MCP (Model Context Protocol) server for Iron.xyz API, designed to work with Claude Desktop, Cursor IDE and other MCP compatible clients.

## Features

This MCP server provides three main tools for exploring and interacting with the Iron.xyz API:

1. **`list-all-endpoints`** - Lists all API endpoints from the Iron.xyz OpenAPI specification in a concise format suitable for LLM consumption
2. **`get-api-specs`** - Gets detailed OpenAPI specification for a specific endpoint
3. **`invoke-api-endpoint`** - Actually calls the Iron.xyz API endpoints with proper authentication and validation

## Quick Start

No installation required! Use with `npx` in your host:

### Configuration

Add this to your MCP Host (Claude Desktop / Cursor IDE etc) configuration:

```json
{
  "mcpServers": {
    "ironxyz": {
      "command": "npx",
      "args": ["-y", "@ironxyz/mcp-server"],
      "env": {
        "IRON_ENVIRONMENT": "production"
      }
    }
  }
}
```

## Configuration Options

Configure the server using environment variables:

| Variable                | Description                         | Default                            | Options                              |
| ----------------------- | ----------------------------------- | ---------------------------------- | ------------------------------------ |
| `IRON_ENVIRONMENT`      | Iron.xyz environment to use         | `production`                       | `production`, `sandbox`              |
| `IRON_API_KEY`          | Iron.xyz API key for authentication | None                               | Your API key from Iron.xyz dashboard |
| `IRON_READ_ONLY_MODE`   | Restrict to GET requests only       | `false`                            | `true`, `false`                      |
| `IRON_BASE_URL`         | Custom base URL for API calls       | Auto-detected based on environment | Any valid URL                        |
| `IRON_OPENAPI_SPEC_URL` | Custom OpenAPI spec URL             | Auto-detected based on environment | Any valid URL                        |
| `IRON_LOCAL_SPEC_PATH`  | Local fallback spec file path       | `./ironxyz-openapi-spec.yaml`      | Any valid file path                  |

### Environment Examples

**Production Environment (default):**

```json
{
  "env": {
    "IRON_ENVIRONMENT": "production"
  }
}
```

**Sandbox Environment:**

```json
{
  "env": {
    "IRON_ENVIRONMENT": "sandbox"
  }
}
```

**With API Key (for endpoint invocation):**

```json
{
  "env": {
    "IRON_ENVIRONMENT": "production",
    "IRON_API_KEY": "your-iron-api-key-here"
  }
}
```

**Read-only mode (GET requests only):**

```json
{
  "env": {
    "IRON_ENVIRONMENT": "production",
    "IRON_API_KEY": "your-iron-api-key-here",
    "IRON_READ_ONLY_MODE": "true"
  }
}
```

**Custom OpenAPI Spec URL:**

```json
{
  "env": {
    "IRON_ENVIRONMENT": "production",
    "IRON_OPENAPI_SPEC_URL": "https://your-custom-spec-url.com/spec"
  }
}
```

## Development

### Local Installation

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Build the project:
   ```bash
   pnpm run build
   ```

### Running Locally

```bash
pnpm start
```

Or for development:

```bash
pnpm run dev
```

### Tools Available

#### `list-all-endpoints`

Lists all API endpoints from the Iron.xyz OpenAPI specification.

**Parameters:**

- `filterByTag` (string, optional): Filter endpoints by tag

**Example usage:**

```json
{
  "tool": "list-all-endpoints",
  "arguments": {
    "filterByTag": "users"
  }
}
```

#### `get-api-specs`

Gets detailed OpenAPI specification for a specific endpoint.

**Parameters:**

- `path` (string, required): The API path (e.g., '/v1/users')
- `method` (string, required): The HTTP method (GET, POST, PUT, DELETE, etc.)

**Example usage:**

```json
{
  "tool": "get-api-specs",
  "arguments": {
    "path": "/v1/users",
    "method": "GET"
  }
}
```

#### `invoke-api-endpoint`

Actually calls the Iron.xyz API endpoints with proper authentication and validation.

**Parameters:**

- `path` (string, required): The API path (e.g., '/customers') - `/api` prefix is added automatically
- `method` (string, required): The HTTP method (GET, POST, PUT, DELETE, etc.)
- `parameters` (object, optional): Query parameters as key-value pairs
- `headers` (object, optional): Additional headers as key-value pairs
- `body` (object, optional): Request body for POST/PUT/PATCH requests

**Features:**

- ✅ **Authentication**: Automatically adds API key if configured
- ✅ **Read-only mode**: Optional restriction to GET requests only
- ✅ **Validation**: Validates endpoints against OpenAPI specification
- ✅ **Error handling**: Comprehensive error responses with details
- ✅ **Environment awareness**: Works with both sandbox and production

**Example usage:**

```json
{
  "tool": "invoke-api-endpoint",
  "arguments": {
    "path": "/customers",
    "method": "GET",
    "parameters": {
      "limit": 10,
      "offset": 0
    }
  }
}
```

**Example with POST request:**

```json
{
  "tool": "invoke-api-endpoint",
  "arguments": {
    "path": "/customers",
    "method": "POST",
    "headers": {
      "IDEMPOTENCY-KEY": "123e4567-e89b-12d3-a456-426614174000"
    },
    "body": {
      "name": "John Doe",
      "email": "john@example.com",
      "type": "individual"
    }
  }
}
```

## Error Handling

The server includes comprehensive error handling for:

- Missing or invalid OpenAPI specification API
- Invalid endpoint paths or methods
- Network issues with external services
- Malformed tool arguments
