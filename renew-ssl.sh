#!/bin/sh

# ==============================================================================
# SSL Certificate Renewal Script (Cron automated)
# ==============================================================================
# This script should be added to the host's crontab to run daily.
# It invokes Certbot to renew certificates and reloads Nginx.

echo "🔄 [$(date)] Commencing Let's Encrypt Certbot Certificate renewal check..."

# Run Certbot renewal command
docker run --rm --name certbot \
  -v "$(pwd)/certs:/etc/letsencrypt" \
  -v "$(pwd)/certbot-www:/var/www/certbot" \
  certbot/certbot renew --non-interactive --agree-tos

# Copy renewed files if they exist in standard letsencrypt paths
if [ -d "./certs/live" ]; then
    echo "📁 Syncing Certbot certificates into webserver folders..."
    cp -L ./certs/live/*/fullchain.pem ./certs/fullchain.pem
    cp -L ./certs/live/*/privkey.pem ./certs/privkey.pem
fi

echo "🔌 Reloading Nginx configuration..."
docker-compose exec -T nginx nginx -s reload

echo "✅ [$(date)] Certificate renewal workflow completed successfully."
