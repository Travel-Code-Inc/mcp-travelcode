# Production deployment — `mcp.travel-code.com`

This documents the actual production setup for the hosted MCP server at
`https://mcp.travel-code.com/mcp`. For local dev, see the README.

## Stack

- **OS:** Ubuntu 24.04 LTS (AWS EC2, `t3.micro` is enough)
- **Runtime:** Node.js 22 LTS
- **Process supervisor:** systemd (not pm2)
- **TLS / reverse proxy:** nginx + Let's Encrypt (certbot, auto-renew via `certbot.timer`)
- **Intrusion prevention:** fail2ban (sshd + nginx-botsearch + nginx-bad-request + nginx-http-auth + custom `nginx-scanners`)
- **DNS:** `mcp.travel-code.com` A-record → EC2 public IP

## Prerequisites

- Inbound SG rules: TCP **22** (limited), **80**, **443**
- DNS `A mcp.travel-code.com` pointing at this host before running certbot (the HTTP-01 challenge needs it)

## Steps

### 1. System packages

```bash
sudo apt-get update
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx fail2ban git
```

### 2. Application

```bash
sudo git clone https://github.com/Travel-Code-Inc/mcp-travelcode.git /opt/mcp-travelcode
sudo useradd --system --home /opt/mcp-travelcode --shell /usr/sbin/nologin mcp
sudo chown -R mcp:mcp /opt/mcp-travelcode

cd /opt/mcp-travelcode
sudo -u mcp npm ci
sudo -u mcp npm run build
```

### 3. Environment — `/opt/mcp-travelcode/.env`

```env
PORT=3000
RESOURCE_URI=https://mcp.travel-code.com
TRAVELCODE_API_BASE_URL=https://api.travel-code.com/v1
OAUTH_ISSUER=https://travel-code.com
TRAVELCODE_POLL_INTERVAL_MS=2000
TRAVELCODE_POLL_TIMEOUT_MS=90000
```

```bash
sudo chown root:mcp /opt/mcp-travelcode/.env
sudo chmod 640 /opt/mcp-travelcode/.env
```

No `TRAVELCODE_API_TOKEN` in production — tokens are per-user, taken from the
`Authorization: Bearer` header on each MCP request.

### 4. systemd unit — `/etc/systemd/system/mcp-travelcode.service`

```ini
[Unit]
Description=MCP TravelCode HTTP Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=mcp
Group=mcp
WorkingDirectory=/opt/mcp-travelcode
EnvironmentFile=/opt/mcp-travelcode/.env
ExecStart=/usr/bin/node /opt/mcp-travelcode/build/http-server.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mcp-travelcode

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/mcp-travelcode
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true
RestrictRealtime=true
RestrictNamespaces=true
SystemCallArchitectures=native

[Install]
WantedBy=multi-user.target
```

Do **not** add `MemoryDenyWriteExecute=true` — breaks V8 JIT (SIGTRAP on start).

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mcp-travelcode
```

### 5. nginx — `/etc/nginx/sites-available/mcp.travel-code.com.conf`

Start with HTTP only; certbot will insert the HTTPS block on first run.

```nginx
upstream mcp_travelcode {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name mcp.travel-code.com;

    # MCP Streamable HTTP sessions can be long-lived.
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 1h;
    proxy_send_timeout 1h;

    client_max_body_size 4m;

    location / {
        proxy_pass http://mcp_travelcode;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/mcp.travel-code.com.conf \
           /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 6. TLS

```bash
sudo certbot --nginx -d mcp.travel-code.com \
    --non-interactive --agree-tos \
    -m ops@travel-code.com --redirect
```

Auto-renew is handled by `certbot.timer` (already enabled).

### 7. fail2ban — `/etc/fail2ban/jail.d/mcp.local`

```ini
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled  = true
maxretry = 4
bantime  = 2h

[nginx-botsearch]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/access.log

[nginx-bad-request]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/access.log

[nginx-http-auth]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/error.log

[nginx-scanners]
enabled  = true
port     = http,https
filter   = nginx-scanners
logpath  = /var/log/nginx/access.log
maxretry = 2
findtime = 1h
bantime  = 24h
```

Custom filter — `/etc/fail2ban/filter.d/nginx-scanners.conf`:

```ini
[Definition]
failregex = ^<HOST> \S+ \S+ \[\] "(?:GET|POST|HEAD|PUT) /(?:\.env|\.git(?:/|\b)|wp-(?:login|admin|config|includes|content)|phpmyadmin\b|pma\b|mysql\b|\.aws\b|\.ssh\b|server-status\b|server-info\b|xmlrpc\.php|cgi-bin/|actuator\b|config\.json|id_rsa\b|\.DS_Store|backup\.sql|dump\.sql|wallet\.dat)\S*
ignoreregex =
datepattern = \[({DATE})\]
```

```bash
sudo fail2ban-client reload
sudo fail2ban-client status   # 5 jails active
```

## Smoke tests

```bash
# 1. Health
curl -s https://mcp.travel-code.com/health
# → {"status":"ok","transport":"streamable-http","sessions":0}

# 2. PRM discovery
curl -s https://mcp.travel-code.com/.well-known/oauth-protected-resource/mcp | jq
# → {"resource":"https://mcp.travel-code.com/mcp",
#    "authorization_servers":["https://travel-code.com"], ...}

# 3. 401 + WWW-Authenticate
curl -sI https://mcp.travel-code.com/mcp
# → HTTP/2 401
# → www-authenticate: Bearer resource_metadata="…/oauth-protected-resource/mcp"

# 4. Upstream AS metadata (handled by PHP backend, not this repo)
curl -s https://travel-code.com/.well-known/oauth-authorization-server | jq
```

## Updates

```bash
cd /opt/mcp-travelcode
sudo -u mcp git pull
sudo -u mcp npm ci
sudo -u mcp npm run build
sudo systemctl restart mcp-travelcode
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `systemctl status` shows `core-dumped (SIGTRAP)` | `MemoryDenyWriteExecute=true` in unit — remove it |
| certbot: `Timeout during connect` | SG / firewall blocks TCP 80 from the internet |
| Client OAuth fails with `issuer mismatch` | Make sure PRM advertises `authorization_servers: ["https://travel-code.com"]` (not the sidecar) |
| `ssh-rsa` key rejected | OpenSSH 9.x drops SHA-1 by default; upgrade client or add `PubkeyAcceptedAlgorithms +ssh-rsa` drop-in |
| Clients request a scope and get denied | Check that the upstream AS (`travel-code.com/.well-known/oauth-authorization-server`) advertises the same scopes as this server's PRM |
