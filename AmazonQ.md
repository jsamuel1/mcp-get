# Amazon Q MCP Integration

This document describes the integration between mcp-get and Amazon Q.

## Configuration File Location

Amazon Q uses a separate MCP configuration file:

- **Linux/macOS**: `~/.aws/amazonq/mcp.json`
- **Windows**: `%USERPROFILE%\.aws\amazonq\mcp.json`

## Synchronization Behavior

When both Claude Desktop and Amazon Q configuration files exist:
- Installing an MCP server will update both files
- Uninstalling an MCP server will update both files
- Both files will be kept in sync with the same MCP server configurations

## Structure

The Amazon Q MCP configuration file follows the same structure as the Claude Desktop configuration:

```json
{
  "mcpServers": {
    "server-name": {
      "runtime": "node|python",
      "command": "npx|uvx",
      "args": ["arguments"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}
```
