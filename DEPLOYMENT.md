# Helium — Production Deployment Guide

> **Author:** `@req.akira` | **Theme:** Red (`#ED4245`)

---

## 1. System Requirements

- Linux (Ubuntu 22.04 LTS / Debian 12 recommended) or Windows Server
- Node.js 20 LTS or Node.js 24 LTS
- 1 GB RAM minimum (2 GB recommended for large guilds)
- SQLite3 filesystem support

---

## 2. Process Manager (PM2) Setup

Using PM2 ensures automatic restarts on unexpected errors, memory threshold enforcement, and logging:

### Step 1: Install PM2 Globally
```bash
npm install -g pm2
```

### Step 2: Build the Production Bundle
```bash
npm run build
```

### Step 3: Create `ecosystem.config.cjs`
```javascript
module.exports = {
  apps: [
    {
      name: 'helium-bot',
      script: './dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
```

### Step 4: Start and Enable On-Boot
```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

---

## 3. Docker Deployment

Helium can be easily containerized:

### `Dockerfile`
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
VOLUME ["/app/data"]
CMD ["node", "dist/index.js"]
```

### Build & Run
```bash
docker build -t helium-bot .
docker run -d --name helium --restart unless-stopped -v $(pwd)/data:/app/data --env-file .env helium-bot
```

---

## 4. Health Checks & Maintenance

- **Inspect Logs**: `pm2 logs helium-bot`
- **Database Backup**: Periodic backups of `./data/helium.db` via cron:
  ```bash
  sqlite3 ./data/helium.db ".backup ./backups/helium_$(date +%Y%m%d_%H%M%S).db"
  ```
- **Sync Slash Commands**: Run `npm run register` anytime you update command options or choices.
