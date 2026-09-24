# Cursor Marketplace

This repository is a [Cursor Plugin](https://cursor.com/docs/plugins) that exposes the **hosted** TravelCode MCP server.

## What installs

| File | Role |
|------|------|
| `.cursor-plugin/plugin.json` | Plugin manifest |
| `mcp.json` | Points clients at `https://mcp.travel-code.com/mcp` |

No local install, no API keys in the repo. On first use the client opens TravelCode OAuth (OAuth 2.1 + PKCE).

## Local test (before publish)

```bash
mkdir -p ~/.cursor/plugins/local/travelcode
cp -R .cursor-plugin mcp.json README.md ~/.cursor/plugins/local/travelcode/
# from repo root; or symlink the repo folder into local/
```

Reload Cursor → Customize → confirm TravelCode MCP appears → connect and authorize.

## Submit / update

1. Push these files to the public GitHub repo.
2. Open https://cursor.com/marketplace/publish and submit the repository URL.
3. Every update is re-reviewed before it goes live.
