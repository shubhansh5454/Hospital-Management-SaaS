# CareSync Clinical SaaS Suite: Production Deployment & Operations Manual

This comprehensive guide outlines the procedures for deploying, securing, maintaining, and recovering the **CareSync Clinical SaaS Suite** in production environments.

---

## 📖 Table of Contents
1. [System Architecture Overview](#1-system-architecture-overview)
2. [Docker & Container Orchestration](#2-docker--container-orchestration)
3. [Nginx Secure Ingress Proxy](#3-nginx-secure-ingress-proxy)
4. [Environment & Security Configuration](#4-environment--security-configuration)
5. [SSL/TLS Provisioning (Let's Encrypt Certbot)](#5-ssltls-provisioning-lets-encrypt-certbot)
6. [Automated CI/CD Pipeline (GitHub Actions)](#6-automated-cicd-pipeline-github-actions)
7. [System Integrity Health Checks](#7-system-integrity-health-checks)
8. [Logging & Operational Audits](#8-logging--operational-audits)
9. [Telemetry & Monitoring Integration](#9-telemetry--monitoring-integration)
10. [Backup, Restore & Disaster Recovery (DR)](#10-backup-restore--disaster-recovery-dr)
11. [Step-by-Step Server Setup Guide](#11-step-by-step-server-setup-guide)

---

## 1. System Architecture Overview

CareSync uses a containerized, decoupled architecture composed of three micro-services connected via a secure internal Docker bridge network:

```
                  ┌──────────────────────────────────────────────┐
                  │                 CLIENT WEB                   │
                  │             (Web Browsers / SPA)             │
                  └──────────────────────┬───────────────────────┘
                                         │ HTTPS (Port 443)
                                         ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│ DOCKER HOST (e.g. AWS EC2, GCP VM, DigitalOcean Droplet)                     │
│                                                                               │
│  ┌───────────────────────┐   Reverse Proxy   ┌─────────────────────────────┐  │
│  │   NGINX SECURE PROXY  │──────────────────►│    NODE.JS APP CONTAINER    │  │
│  │   (TLS/SSL Gateway)   │   (Port 3000)     │  (Express API + React SPA)  │  │
│  └───────────┬───────────┘                   └──────────────┬──────────────┘  │
│              │                                              │                 │
│              │ Share SSL Certificates                       │ SQL Queries     │
│              ▼                                              ▼                 │
│  ┌───────────────────────┐                   ┌─────────────────────────────┐  │
│  │    CERTBOT VOLUME     │                   │     POSTGRESQL DATABASE     │  │
│  │   (ACME Challenge)    │                   │   (Relational Data Cluster) │  │
│  └───────────────────────┘                   └──────────────┬──────────────┘  │
│                                                             │                 │
│                                                             ▼                 │
│                                              ┌─────────────────────────────┐  │
│                                              │      PERSISTENT VOLUME      │  │
│                                              │        (postgres-data)      │  │
│                                              └─────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Docker & Container Orchestration

### Multi-Stage Production Build (`/Dockerfile`)
The production Dockerfile is designed with high security and optimization in mind:
- **Build Stage**: Uses Node 22 Alpine, caching node modules, runs `npm run build` compiling both the client bundle and Node.js server to single file, standalone CommonJS `dist/server.cjs`.
- **Runner Stage**: Runs only production dependencies, excludes compiler toolchains, uses a dedicated unprivileged user (`node`) rather than standard `root`, and contains custom `HEALTHCHECK` instructions.

### Docker Compose Orchestration (`/docker-compose.yml`)
Configures all services (`app`, `db`, and `nginx`) on a private virtual bridge network (`caresync-network`).
- Volume `postgres-data` handles database state persistence.
- Volume `app-backups` manages secure medical data and HR table JSON archive outputs.
- Logging parameters limit logs to maximum 5 files of 50MB to protect host storage space.

---

## 3. Nginx Secure Ingress Proxy

Our `/nginx.conf` acts as an SSL termination point and request gateway. It enforces industry-standard security policies:
- **TLS Version Enforcement**: Only supports TLS v1.2 and v1.3 with a high-strength cipher suite (A+ Grade Security rating).
- **HSTS Setup**: Demands browsers only request the HTTPS channel using `Strict-Transport-Security`.
- **Mitigation Headers**: Establishes `X-Frame-Options` to combat clickjacking, `X-Content-Type-Options` to combat mime-sniffing, and robust Content Security Policies (CSP).
- **Static Asset Optimization**: Implements 30-day client-side caching of static files directly in the proxy layer to reduce Express server load.
- **Dynamic Content Tuning**: Enables gzip compression with appropriate buffers to decrease user latency.

---

## 4. Environment & Security Configuration

Copy the template from `/.env.production` to your host environment to configure secret parameters.

| Variable Name | Description | Example Value |
|---|---|---|
| `NODE_ENV` | Running environment mode. Enforce `production` | `production` |
| `PORT` | Container internal listening port | `3000` |
| `APP_URL` | External client-facing web domain | `https://clinic.caresync.io` |
| `SQL_HOST` | Database host IP or Docker-Compose service alias | `db` |
| `SQL_USER` | Relational database username | `postgres` |
| `SQL_PASSWORD` | Cryptographic PostgreSQL password | `super_secure_pg_pass_5829` |
| `SQL_DB_NAME` | Relational schema partition name | `caresync_production` |
| `JWT_SECRET` | Signing token for session authentication cookies | `openssl rand -hex 32` |
| `GEMINI_API_KEY`| API authorization token for Clinical Assistant features | `AI_Studio_API_Key_Token` |

---

## 5. SSL/TLS Provisioning (Let's Encrypt Certbot)

Nginx requires cryptographic SSL keys to start listening on port 443. We handle this with our `/init-ssl.sh` script to prevent boot crashes:

### Step 1: Bootstrapping Self-Signed Keys
Run `/init-ssl.sh` to generate self-signed fallback certificates. This lets Nginx load initially:
```bash
chmod +x ./init-ssl.sh
./init-ssl.sh clinic.caresync.io
```

### Step 2: Spinning up Containers
Boot the system up to run Nginx, Express, and Postgres:
```bash
docker-compose up -d
```

### Step 3: Acquiring real SSL certificates from Let's Encrypt
Fetch verified certificates using the ACME challenge folder:
```bash
docker run -it --rm --name certbot \
  -v "$(pwd)/certs:/etc/letsencrypt" \
  -v "$(pwd)/certbot-www:/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d clinic.caresync.io --email admin@caresync.io --agree-tos --no-eff-email
```

### Step 4: Loading the Production SSL keys
Copy the generated production keys and reload Nginx without dropping connections:
```bash
cp -L ./certs/live/clinic.caresync.io/fullchain.pem ./certs/fullchain.pem
cp -L ./certs/live/clinic.caresync.io/privkey.pem ./certs/privkey.pem
docker-compose exec nginx nginx -s reload
```

### Automatic Renewal (Cron Automation)
Let's Encrypt certificates expire every 90 days. Enable `/renew-ssl.sh` as a daily cronjob:
```bash
# Add to server crontab via `crontab -e`
0 3 * * * /path/to/caresync/renew-ssl.sh >> /var/log/caresync-ssl-renewal.log 2>&1
```

---

## 6. Automated CI/CD Pipeline (GitHub Actions)

Our automated CI/CD pipeline resides in `/.github/workflows/ci-cd.yml` and is triggered on pushes to the `main` or `master` branches:

1. **Verify Integrity (Lint & Type Check)**:
   - Installs dependencies and runs `tsc --noEmit`. Any TypeScript compiler errors automatically fail the build.
2. **Compile and Containerize**:
   - Uses Docker Buildx with cache-from/cache-to pipelines to compile quickly.
3. **Publish to GHCR**:
   - Compiles and pushes the container under tags `latest` and `sha-xyz` to **GitHub Container Registry (GHCR)**.

---

## 7. System Integrity Health Checks

CareSync features a multi-tiered health checking design:

### A. The Application Level `/api/health` Route
A dedicated, secure Express health route checking internal resources:
```bash
curl -i http://localhost:3000/api/health
```
**JSON Payload Response Structure:**
```json
{
  "status": "UP",
  "timestamp": "2026-07-12T12:00:00.000Z",
  "uptime": 2394.12,
  "memory": {
    "rss": 45392011,
    "heapTotal": 31457280,
    "heapUsed": 18239011
  },
  "database": {
    "status": "CONNECTED"
  }
}
```
If the database connection is interrupted, the endpoint returns HTTP Code **503 (Service Unavailable)** and details the error, giving orchestrators (e.g., Kubernetes, Cloud Run) a clear indication to redirect traffic.

### B. Docker Engine Check Probe
The `Dockerfile` defines a secure node command pinging `/api/health` every 30 seconds.
Verify status on the host server:
```bash
docker ps --filter name=caresync-app
```

---

## 8. Logging & Operational Audits

CareSync integrates a persistent file and console logger:
- **Console Log**: Logs styled JSON records for standard stdout stream captures.
- **Request Auditor**: Our custom Express middleware records every incoming API request method, URL, duration (ms), IP address, and response HTTP status code.

### Viewing Container Logs on the Host Server
To check live app output:
```bash
docker-compose logs -f app
```
To check Nginx access logs:
```bash
docker-compose logs -f nginx
```

---

## 9. Telemetry & Monitoring Integration

For production environments, we recommend pairing CareSync container log configurations with telemetry collectors:

### A. PM2 Configuration (Alternate Process Manager)
If running outside of Docker on a bare VM instance, run CareSync via PM2:
```bash
npm run build
pm2 start dist/server.cjs --name "caresync-production"
pm2 monit
```

### B. Prometheus & Grafana Configuration
You can integrate standard Nginx and PostgreSQL exporters inside your network topology:
1. Include `nginx-prometheus-exporter` in `docker-compose.yml` reading Nginx stub status.
2. Include `postgres_exporter` reading postgres status variables.
3. Point Grafana dashboards to Prometheus to observe incoming request spikes, database load, write operations, and system memory consumption.

---

## 10. Backup, Restore & Disaster Recovery (DR)

CareSync includes a **Backup & Restore Module** designed specifically to safeguard clinical files, patient records, electronic prescriptions, and HR schedules.

### Backups Directory
Our backup engine stores encrypted clinical snapshots in the `app-backups` persistent volume mapped on-disk to:
`/usr/src/app/src/server/data/backups`

### Manual Execution Procedures
1. Admin clicks **Compile Manual Snapshot** in the Backup Panel.
2. The service scans clinical JSON tables, encrypts the assets, generates an MD5 checksum, and records the backup metadata.

### Disaster Recovery: Restore Steps
If a server experiences failure or data corruption:
1. Navigate to **Backup & Restore** dashboard tab.
2. Select the healthiest or most recent snapshot log.
3. Click **Restore**.
4. The service clears the corrupt records, decodes the backup payload, restores table states, and reconnects clients seamlessly.

*Alternatively, execute recovery via API:*
```bash
curl -X POST http://localhost:3000/api/backup/restore \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -d '{"id": "bk-1720786800000", "operatorName": "Systems Superadmin"}'
```

---

## 11. Step-by-Step Server Setup Guide

Follow these instructions to set up CareSync on a blank Linux Virtual Machine (Ubuntu 22.04 LTS / 24.04 LTS):

### Step 1: Install Host Dependencies
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose git openssl
sudo systemctl enable --now docker
```

### Step 2: Clone Code and Configure Environment
```bash
git clone https://github.com/your-org/caresync-suite.git /opt/caresync
cd /opt/caresync
cp .env.production .env
# Edit .env file with your true secret passwords, DB configs, and Gemini keys
nano .env
```

### Step 3: Initialize SSL Fallback Certificates
```bash
chmod +x init-ssl.sh renew-ssl.sh
./init-ssl.sh clinic.caresync.io
```

### Step 4: Launch the Stack
```bash
docker-compose up -d --build
```

Verify that all three containers are healthy and running:
```bash
docker-compose ps
```

### Step 5: Verify Setup
Pinging your server at `https://clinic.caresync.io` or `https://localhost` will now present the highly optimized, TLS-hardened, fully compliant CareSync Clinical SaaS Suite!

---
**Prepared with highest standards for enterprise stability, data compliance, and disaster resilience.**
