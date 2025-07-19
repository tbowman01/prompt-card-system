#!/bin/bash

# SSL Certificate Setup Script for Prompt Card System
# ==================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔒 SSL Certificate Setup for Prompt Card System${NC}"
echo "================================================"

# Configuration
DOMAIN=${1:-promptcard.ai}
EMAIL=${2:-admin@promptcard.ai}
SSL_DIR="./nginx/ssl"
STAGING=${STAGING:-false}

echo -e "${CYAN}📋 SSL Configuration:${NC}"
echo "   • Domain: $DOMAIN"
echo "   • Email: $EMAIL"
echo "   • Staging mode: $STAGING"
echo "   • SSL Directory: $SSL_DIR"
echo

# Create SSL directory
mkdir -p "$SSL_DIR"

# Function to generate self-signed certificates (for development/testing)
generate_self_signed() {
    echo -e "${YELLOW}🔧 Generating self-signed certificates...${NC}"
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/privkey.pem" \
        -out "$SSL_DIR/fullchain.pem" \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"
    
    echo -e "${GREEN}✅ Self-signed certificates generated${NC}"
    echo -e "${YELLOW}⚠️ Self-signed certificates are for development only!${NC}"
}

# Function to setup Let's Encrypt certificates
setup_letsencrypt() {
    echo -e "${BLUE}🔒 Setting up Let's Encrypt certificates...${NC}"
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        echo -e "${YELLOW}📦 Installing certbot...${NC}"
        
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y certbot python3-certbot-nginx
        elif command -v yum &> /dev/null; then
            sudo yum install -y certbot python3-certbot-nginx
        elif command -v dnf &> /dev/null; then
            sudo dnf install -y certbot python3-certbot-nginx
        else
            echo -e "${RED}❌ Unable to install certbot. Please install manually.${NC}"
            exit 1
        fi
    fi
    
    # Set staging flag if needed
    local staging_flag=""
    if [ "$STAGING" = "true" ]; then
        staging_flag="--staging"
        echo -e "${YELLOW}⚠️ Using Let's Encrypt staging environment${NC}"
    fi
    
    # Generate certificates
    echo -e "${BLUE}🔒 Requesting SSL certificates for $DOMAIN...${NC}"
    
    certbot certonly \
        --webroot \
        --webroot-path=/var/www/html \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        $staging_flag \
        -d "$DOMAIN" \
        -d "www.$DOMAIN" \
        -d "api.$DOMAIN" \
        -d "monitoring.$DOMAIN"
    
    # Copy certificates to nginx directory
    cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$SSL_DIR/"
    cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$SSL_DIR/"
    
    echo -e "${GREEN}✅ Let's Encrypt certificates installed${NC}"
}

# Function to setup certificate auto-renewal
setup_auto_renewal() {
    echo -e "${BLUE}🔄 Setting up certificate auto-renewal...${NC}"
    
    # Create renewal script
    cat > /tmp/renew-certs.sh << 'EOF'
#!/bin/bash
certbot renew --quiet --deploy-hook "docker-compose -f /path/to/docker-compose.prod.yml restart nginx"
EOF
    
    chmod +x /tmp/renew-certs.sh
    sudo mv /tmp/renew-certs.sh /usr/local/bin/renew-certs.sh
    
    # Add to crontab
    (crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/renew-certs.sh") | crontab -
    
    echo -e "${GREEN}✅ Auto-renewal configured (runs daily at 2 AM)${NC}"
}

# Function to generate Diffie-Hellman parameters
generate_dhparam() {
    if [ ! -f "$SSL_DIR/dhparam.pem" ]; then
        echo -e "${BLUE}🔐 Generating Diffie-Hellman parameters...${NC}"
        openssl dhparam -out "$SSL_DIR/dhparam.pem" 2048
        echo -e "${GREEN}✅ DH parameters generated${NC}"
    else
        echo -e "${GREEN}✅ DH parameters already exist${NC}"
    fi
}

# Function to test SSL configuration
test_ssl_config() {
    echo -e "${BLUE}🧪 Testing SSL configuration...${NC}"
    
    if nginx -t; then
        echo -e "${GREEN}✅ Nginx configuration is valid${NC}"
    else
        echo -e "${RED}❌ Nginx configuration has errors${NC}"
        exit 1
    fi
    
    # Test SSL certificate
    if openssl x509 -in "$SSL_DIR/fullchain.pem" -text -noout > /dev/null 2>&1; then
        echo -e "${GREEN}✅ SSL certificate is valid${NC}"
        
        # Show certificate details
        echo -e "${BLUE}📋 Certificate details:${NC}"
        openssl x509 -in "$SSL_DIR/fullchain.pem" -text -noout | grep -E "(Subject:|Issuer:|Not Before:|Not After:|DNS:)"
    else
        echo -e "${RED}❌ SSL certificate is invalid${NC}"
        exit 1
    fi
}

# Main execution
main() {
    case "${3:-letsencrypt}" in
        "self-signed")
            generate_self_signed
            ;;
        "letsencrypt")
            setup_letsencrypt
            setup_auto_renewal
            ;;
        *)
            echo -e "${RED}❌ Invalid certificate type. Use 'self-signed' or 'letsencrypt'${NC}"
            exit 1
            ;;
    esac
    
    generate_dhparam
    test_ssl_config
    
    echo -e "${GREEN}🎉 SSL setup completed successfully!${NC}"
    echo
    echo -e "${CYAN}📋 Next steps:${NC}"
    echo -e "   1. Update DNS records to point to your server"
    echo -e "   2. Start the production stack: ${BLUE}./scripts/production/deploy.sh${NC}"
    echo -e "   3. Test HTTPS access: ${BLUE}https://$DOMAIN${NC}"
    echo
    echo -e "${YELLOW}⚠️ Security reminders:${NC}"
    echo -e "   • Keep certificates renewed (auto-renewal is configured)"
    echo -e "   • Monitor certificate expiration dates"
    echo -e "   • Test SSL configuration regularly"
}

# Check if running as root for Let's Encrypt
if [ "${3:-letsencrypt}" = "letsencrypt" ] && [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Let's Encrypt setup requires root privileges${NC}"
    echo "Please run with sudo or as root user"
    exit 1
fi

# Run main function
main