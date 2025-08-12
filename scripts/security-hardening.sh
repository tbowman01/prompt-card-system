#!/bin/bash

# Security Hardening Script for Prompt Card System
# This script implements comprehensive security measures for production deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SECURITY_DIR="$PROJECT_ROOT/security"
SECRETS_DIR="$PROJECT_ROOT/secrets"
LOGS_DIR="$PROJECT_ROOT/logs"
DATA_DIR="$PROJECT_ROOT/data"

# Create necessary directories
create_secure_directories() {
    log "Creating secure directory structure..."
    
    # Create directories with proper permissions
    mkdir -p "$SECURITY_DIR" "$SECRETS_DIR" "$LOGS_DIR" "$DATA_DIR"
    mkdir -p "$LOGS_DIR/backend" "$LOGS_DIR/frontend" "$LOGS_DIR/postgres" "$LOGS_DIR/security"
    mkdir -p "$DATA_DIR/backend" "$DATA_DIR/postgres" "$DATA_DIR/redis"
    mkdir -p "$PROJECT_ROOT/reports/security"
    mkdir -p "$PROJECT_ROOT/backups"
    
    # Set secure permissions
    chmod 700 "$SECRETS_DIR"
    chmod 755 "$SECURITY_DIR" "$LOGS_DIR" "$DATA_DIR"
    chmod 750 "$LOGS_DIR/security" "$DATA_DIR/backend" "$DATA_DIR/postgres"
    
    log_success "Directory structure created with secure permissions"
}

# Generate secure secrets
generate_secrets() {
    log "Generating cryptographically secure secrets..."
    
    # Function to generate a secure random string
    generate_secure_secret() {
        local length=${1:-64}
        openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
    }
    
    # Generate secrets if they don't exist
    if [[ ! -f "$SECRETS_DIR/jwt_secret.txt" ]]; then
        generate_secure_secret 64 > "$SECRETS_DIR/jwt_secret.txt"
        log_success "Generated JWT secret"
    fi
    
    if [[ ! -f "$SECRETS_DIR/jwt_refresh_secret.txt" ]]; then
        generate_secure_secret 64 > "$SECRETS_DIR/jwt_refresh_secret.txt"
        log_success "Generated JWT refresh secret"
    fi
    
    if [[ ! -f "$SECRETS_DIR/db_password.txt" ]]; then
        generate_secure_secret 32 > "$SECRETS_DIR/db_password.txt"
        log_success "Generated database password"
    fi
    
    if [[ ! -f "$SECRETS_DIR/redis_password.txt" ]]; then
        generate_secure_secret 32 > "$SECRETS_DIR/redis_password.txt"
        log_success "Generated Redis password"
    fi
    
    if [[ ! -f "$SECRETS_DIR/encryption_key.txt" ]]; then
        generate_secure_secret 64 > "$SECRETS_DIR/encryption_key.txt"
        log_success "Generated encryption key"
    fi
    
    if [[ ! -f "$SECRETS_DIR/webhook_secret.txt" ]]; then
        generate_secure_secret 48 > "$SECRETS_DIR/webhook_secret.txt"
        log_success "Generated webhook secret"
    fi
    
    # Set secure permissions on secret files
    find "$SECRETS_DIR" -type f -exec chmod 600 {} \;
    log_success "Set secure permissions on all secret files"
}

# Generate SSL certificates for development
generate_ssl_certificates() {
    log "Generating SSL certificates for development..."
    
    SSL_DIR="$SECURITY_DIR/ssl"
    mkdir -p "$SSL_DIR"
    
    if [[ ! -f "$SSL_DIR/server.crt" ]]; then
        # Generate private key
        openssl genrsa -out "$SSL_DIR/server.key" 2048
        
        # Generate certificate signing request
        openssl req -new -key "$SSL_DIR/server.key" -out "$SSL_DIR/server.csr" \
            -subj "/C=US/ST=State/L=City/O=PromptCardSystem/OU=Development/CN=localhost"
        
        # Generate self-signed certificate
        openssl x509 -req -days 365 -in "$SSL_DIR/server.csr" \
            -signkey "$SSL_DIR/server.key" -out "$SSL_DIR/server.crt"
        
        # Clean up CSR
        rm "$SSL_DIR/server.csr"
        
        # Set permissions
        chmod 600 "$SSL_DIR/server.key"
        chmod 644 "$SSL_DIR/server.crt"
        
        log_success "Generated SSL certificates"
    else
        log "SSL certificates already exist"
    fi
}

# Create security configuration files
create_security_configs() {
    log "Creating security configuration files..."
    
    # Create security headers configuration
    cat > "$SECURITY_DIR/headers.conf" << 'EOF'
# Security Headers Configuration
# These headers enhance the security of the application

# Prevent clickjacking
add_header X-Frame-Options "DENY" always;

# Prevent content-type sniffing
add_header X-Content-Type-Options "nosniff" always;

# Enable XSS protection
add_header X-XSS-Protection "1; mode=block" always;

# Strict Transport Security (HSTS)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# Content Security Policy
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' ws: wss:; object-src 'none'; frame-src 'none';" always;

# Referrer Policy
add_header Referrer-Policy "no-referrer" always;

# Permissions Policy
add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), fullscreen=(self), payment=()" always;

# Remove server information
server_tokens off;
EOF
    
    # Create rate limiting configuration
    cat > "$SECURITY_DIR/rate-limits.conf" << 'EOF'
# Rate Limiting Configuration

# General rate limiting
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=20r/m;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=upload:10m rate=2r/m;

# Apply rate limits
location /api/ {
    limit_req zone=api burst=10 nodelay;
}

location /api/auth/ {
    limit_req zone=auth burst=5 nodelay;
}

location /api/upload/ {
    limit_req zone=upload burst=2 nodelay;
}
EOF
    
    # Create security monitoring script
    cat > "$SECURITY_DIR/monitor.sh" << 'EOF'
#!/bin/bash

# Security Monitoring Script
# Monitors logs for security events and generates alerts

LOGS_DIR="$(dirname "$0")/../logs"
SECURITY_LOG="$LOGS_DIR/security/security.log"
ALERT_THRESHOLD=5

# Monitor for suspicious activity
monitor_security_events() {
    local current_hour=$(date +"%Y-%m-%d %H")
    local suspicious_count=$(grep "$current_hour" "$SECURITY_LOG" | grep -c "SUSPICIOUS\|BLOCKED\|CRITICAL" || true)
    
    if [[ $suspicious_count -gt $ALERT_THRESHOLD ]]; then
        echo "ALERT: $suspicious_count suspicious events detected in the last hour"
        # In production, send alert to monitoring system
    fi
}

# Monitor for brute force attempts
monitor_brute_force() {
    local current_hour=$(date +"%Y-%m-%d %H")
    local failed_logins=$(grep "$current_hour" "$SECURITY_LOG" | grep -c "FAILED_LOGIN" || true)
    
    if [[ $failed_logins -gt 10 ]]; then
        echo "ALERT: Possible brute force attack detected - $failed_logins failed logins"
    fi
}

# Run monitoring
if [[ -f "$SECURITY_LOG" ]]; then
    monitor_security_events
    monitor_brute_force
fi
EOF
    
    chmod +x "$SECURITY_DIR/monitor.sh"
    log_success "Created security configuration files"
}

# Set up log rotation
setup_log_rotation() {
    log "Setting up log rotation..."
    
    cat > "$SECURITY_DIR/logrotate.conf" << EOF
$LOGS_DIR/backend/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 1001 1001
    postrotate
        docker kill -s USR1 \$(docker ps -q --filter name=backend) 2>/dev/null || true
    endscript
}

$LOGS_DIR/security/*.log {
    daily
    missingok
    rotate 90
    compress
    delaycompress
    notifempty
    create 600 root root
    postrotate
        # Send signal to security monitoring process
        pkill -USR1 -f security-monitor || true
    endscript
}

$LOGS_DIR/postgres/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 999 999
}
EOF
    
    log_success "Log rotation configured"
}

# Create security checklist
create_security_checklist() {
    log "Creating security deployment checklist..."
    
    cat > "$PROJECT_ROOT/SECURITY_CHECKLIST.md" << 'EOF'
# Security Deployment Checklist

## Pre-Deployment Security Checks

### Environment Security
- [ ] All environment variables are configured
- [ ] Secrets are generated and stored securely
- [ ] SSL certificates are valid and properly configured
- [ ] Database credentials are strong and unique
- [ ] JWT secrets are cryptographically secure

### Application Security
- [ ] Security headers are enabled
- [ ] Rate limiting is configured
- [ ] Input validation is enabled
- [ ] CSRF protection is active
- [ ] Authentication middleware is configured
- [ ] Authorization checks are in place

### Infrastructure Security
- [ ] Docker containers run as non-root users
- [ ] Container images are scanned for vulnerabilities
- [ ] Network segmentation is implemented
- [ ] Firewall rules are configured
- [ ] Logging and monitoring are enabled

### Database Security
- [ ] Database is configured with authentication
- [ ] Database connections use SSL/TLS
- [ ] Database backups are encrypted
- [ ] Database access is restricted by IP
- [ ] Database logs are monitored

### Container Security
- [ ] Images are built from minimal base images
- [ ] Containers use read-only filesystems where possible
- [ ] Security contexts are properly configured
- [ ] Capabilities are dropped appropriately
- [ ] Resources limits are set

### Monitoring Security
- [ ] Security event logging is configured
- [ ] Log aggregation is working
- [ ] Alerting rules are defined
- [ ] Incident response procedures are documented
- [ ] Security metrics are collected

### Network Security
- [ ] All traffic uses HTTPS/TLS
- [ ] Internal network communication is secured
- [ ] Network policies are enforced
- [ ] Port exposure is minimized
- [ ] Load balancer is configured securely

## Post-Deployment Verification

### Security Testing
- [ ] Penetration testing completed
- [ ] Vulnerability scanning completed
- [ ] Security headers are properly set
- [ ] Rate limiting is functioning
- [ ] Authentication flows work correctly

### Monitoring Verification
- [ ] Security logs are being generated
- [ ] Alerts are being received
- [ ] Metrics are being collected
- [ ] Dashboards are accessible
- [ ] Backup procedures are tested

### Compliance Checks
- [ ] Data protection requirements met
- [ ] Audit logging is comprehensive
- [ ] Access controls are documented
- [ ] Incident response plan is tested
- [ ] Security documentation is complete
EOF
    
    log_success "Security checklist created"
}

# Run security validation
validate_security_setup() {
    log "Validating security setup..."
    
    local errors=0
    
    # Check if secrets exist
    for secret in jwt_secret.txt jwt_refresh_secret.txt db_password.txt redis_password.txt; do
        if [[ ! -f "$SECRETS_DIR/$secret" ]]; then
            log_error "Missing secret file: $secret"
            ((errors++))
        fi
    done
    
    # Check directory permissions
    if [[ $(stat -c "%a" "$SECRETS_DIR") != "700" ]]; then
        log_error "Secrets directory has incorrect permissions"
        ((errors++))
    fi
    
    # Check if Docker security configuration exists
    if [[ ! -f "$PROJECT_ROOT/docker-security.yml" ]]; then
        log_error "Docker security configuration not found"
        ((errors++))
    fi
    
    # Validate environment variables
    required_vars=("NODE_ENV" "JWT_SECRET" "DB_HOST" "DB_PASSWORD")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_warning "Environment variable $var is not set"
        fi
    done
    
    if [[ $errors -eq 0 ]]; then
        log_success "Security validation passed"
        return 0
    else
        log_error "Security validation failed with $errors errors"
        return 1
    fi
}

# Main execution
main() {
    log "Starting security hardening process..."
    
    # Ensure we're running with appropriate privileges
    if [[ $EUID -eq 0 ]]; then
        log_warning "Running as root - this is not recommended for production"
    fi
    
    # Execute security hardening steps
    create_secure_directories
    generate_secrets
    generate_ssl_certificates
    create_security_configs
    setup_log_rotation
    create_security_checklist
    
    # Validate setup
    if validate_security_setup; then
        log_success "Security hardening completed successfully!"
        echo
        log "Next steps:"
        echo "1. Review the generated secrets in $SECRETS_DIR"
        echo "2. Configure environment variables with the generated secrets"
        echo "3. Review $PROJECT_ROOT/SECURITY_CHECKLIST.md before deployment"
        echo "4. Run security tests: npm run test:security"
        echo "5. Deploy using: docker-compose -f docker-security.yml up -d"
    else
        log_error "Security hardening failed. Please review errors above."
        exit 1
    fi
}

# Trap for cleanup on exit
trap 'log "Security hardening interrupted"' INT TERM

# Execute main function
main "$@"