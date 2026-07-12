#!/bin/sh

# ==============================================================================
# SSL Initialization and Fallback Certificate Generator
# ==============================================================================
# This script ensures Nginx can boot by creating a self-signed certificate
# if no genuine Let's Encrypt certificates exist. It then shows how to
# provision real SSL certificates.

set -e

DOMAIN=${1:-"localhost"}
EMAIL=${2:-"admin@$DOMAIN"}

CERT_DIR="./certs"
LE_DIR="./certs/letsencrypt"

echo "🏥 CareSync SSL Provisioning & Initialization Suite"
echo "---------------------------------------------------"

# Create local certificates folder if missing
mkdir -p "$CERT_DIR"

if [ ! -f "$CERT_DIR/fullchain.pem" ] || [ ! -f "$CERT_DIR/privkey.pem" ]; then
    echo "⚠️  No existing SSL certificate keys found in $CERT_DIR."
    echo "Creating a safe, self-signed fallback certificate for domain: $DOMAIN..."

    # Generate a temporary self-signed key and certificate
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$CERT_DIR/privkey.pem" \
        -out "$CERT_DIR/fullchain.pem" \
        -subj "/CN=$DOMAIN/O=CareSync/OU=Clinical Systems"

    echo "✅ Fallback self-signed certificates generated successfully!"
    echo "Nginx can now boot without crashing."
else
    echo "ℹ️  Found existing certificates in $CERT_DIR. Skipping fallback generation."
fi

echo ""
echo "🚀 Next steps for genuine production SSL deployment:"
echo "1. Run: docker-compose up -d"
echo "2. Execute Let's Encrypt Certbot via standard CLI or standalone container:"
echo "   docker run -it --rm --name certbot \\"
echo "     -v \"\$(pwd)/certs:/etc/letsencrypt\" \\"
echo "     -v \"\$(pwd)/certbot-www:/var/www/certbot\" \\"
echo "     certbot/certbot certonly --webroot -w /var/www/certbot \\"
echo "     -d $DOMAIN --email $EMAIL --agree-tos --no-eff-email"
echo "3. Copy the real certificates into $CERT_DIR and reload Nginx:"
echo "   docker-compose exec nginx nginx -s reload"
echo "---------------------------------------------------"
