# Common Issues and Solutions

Comprehensive troubleshooting guide for the Prompt Card System.

## 🚨 Installation Issues

### Docker Issues

**Problem**: `docker-compose up` fails with permission errors
```
ERROR: Permission denied while trying to connect to the Docker daemon
```

**Solution**:
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Logout and login again, or use:
newgrp docker

# Verify Docker access
docker ps
```

**Problem**: Port conflicts during startup
```
ERROR: Port 3000 is already in use
```

**Solution**:
```bash
# Check what's using the port
sudo lsof -i :3000
sudo lsof -i :3001

# Kill the process or change ports in docker-compose.yml
sudo kill -9 PID

# Or modify ports in docker-compose.yml
ports:
  - "3002:3000"  # Changed from 3000:3000
```

**Problem**: Out of disk space
```
ERROR: No space left on device
```

**Solution**:
```bash
# Check disk usage
df -h

# Clean Docker resources
docker system prune -a

# Remove unused volumes
docker volume prune

# Remove old containers
docker container prune
```

### Node.js Issues

**Problem**: npm install fails with permission errors
```
EACCES: permission denied, access '/usr/local/lib/node_modules'
```

**Solution**:
```bash
# Use nvm to manage Node.js versions
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install node
nvm use node

# Or fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

**Problem**: Node.js version incompatibility
```
Error: The engine "node" is incompatible with this module
```

**Solution**:
```bash
# Check required Node.js version
cat package.json | grep engines

# Install correct version
nvm install 18.17.0
nvm use 18.17.0

# Verify version
node --version
```

## 🔧 Configuration Issues

### Environment Variables

**Problem**: Environment variables not loading
```
Error: Cannot find environment variable DATABASE_URL
```

**Solution**:
```bash
# Check if .env file exists
ls -la .env backend/.env frontend/.env.local

# Verify file content
cat backend/.env

# Check for BOM or hidden characters
file backend/.env

# Fix line endings if needed
dos2unix backend/.env
```

**Problem**: CORS errors in frontend
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solution**:
```bash
# Check CORS configuration in backend/.env
CORS_ORIGIN=http://localhost:3000

# For production, use your domain
CORS_ORIGIN=https://yourdomain.com

# For development, allow all origins (not recommended for production)
CORS_ORIGIN=*
```

### Database Issues

**Problem**: Database connection timeout
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution**:
```bash
# Check if database is running
docker-compose ps

# Check database logs
docker-compose logs postgres

# Verify database connection string
echo $DATABASE_URL

# Test connection manually
docker-compose exec postgres psql -U promptcard -d promptcard
```

**Problem**: Database migration failures
```
Error: relation "prompt_cards" does not exist
```

**Solution**:
```bash
# Run migrations manually
docker-compose exec backend npm run migrate

# Check migration status
docker-compose exec backend npm run migrate:status

# Reset database if needed (WARNING: destroys data)
docker-compose exec backend npm run migrate:reset
```

## 🌐 Network Issues

### API Connection Problems

**Problem**: Frontend can't connect to backend
```
TypeError: fetch failed
```

**Solution**:
```bash
# Check if backend is running
curl http://localhost:3001/api/health

# Verify API URL in frontend
echo $NEXT_PUBLIC_API_URL

# Check network between containers
docker-compose exec frontend ping backend

# Verify environment variables
docker-compose exec frontend printenv | grep NEXT_PUBLIC
```

**Problem**: WebSocket connection failures
```
WebSocket connection failed
```

**Solution**:
```bash
# Check WebSocket URL
echo $NEXT_PUBLIC_WS_URL

# Verify WebSocket endpoint
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" http://localhost:3001/socket.io/

# Check firewall rules
sudo ufw status

# Allow WebSocket traffic
sudo ufw allow 3001
```

### SSL/TLS Issues

**Problem**: SSL certificate errors
```
NET::ERR_CERT_AUTHORITY_INVALID
```

**Solution**:
```bash
# Check certificate validity
openssl x509 -in /etc/letsencrypt/live/yourdomain.com/cert.pem -text -noout

# Renew certificate
sudo certbot renew

# Check Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## 🎯 Performance Issues

### Slow Response Times

**Problem**: API responses are slow
```
Response time > 5 seconds
```

**Solution**:
```bash
# Check resource usage
docker stats

# Monitor database performance
docker-compose exec postgres psql -U promptcard -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Enable query logging
echo "LOG_LEVEL=debug" >> backend/.env

# Check for N+1 queries
grep -n "SELECT" backend/logs/app.log | head -20
```

**Problem**: High memory usage
```
Out of memory errors
```

**Solution**:
```bash
# Check memory usage
free -h
docker stats

# Increase Node.js memory limit
echo "NODE_OPTIONS=--max-old-space-size=4096" >> backend/.env

# Optimize database queries
docker-compose exec postgres psql -U promptcard -c "VACUUM ANALYZE;"

# Enable Redis caching
echo "REDIS_URL=redis://redis:6379" >> backend/.env
```

### Database Performance

**Problem**: Slow database queries
```
Query execution time > 1 second
```

**Solution**:
```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Add indexes for common queries
CREATE INDEX idx_prompt_cards_created_at ON prompt_cards(created_at);
CREATE INDEX idx_test_cases_prompt_card_id ON test_cases(prompt_card_id);
CREATE INDEX idx_test_results_test_case_id ON test_results(test_case_id);

-- Update table statistics
ANALYZE prompt_cards;
ANALYZE test_cases;
ANALYZE test_results;
```

## 🔒 Security Issues

### Authentication Problems

**Problem**: JWT token errors
```
JsonWebTokenError: invalid signature
```

**Solution**:
```bash
# Check JWT secret
echo $JWT_SECRET

# Ensure JWT secret is consistent across services
grep JWT_SECRET backend/.env

# Generate new JWT secret if needed
openssl rand -hex 32

# Clear browser localStorage
# In browser console:
localStorage.clear()
```

**Problem**: API authentication failures
```
401 Unauthorized
```

**Solution**:
```bash
# Check API key format
echo $API_KEY

# Verify API key in database
docker-compose exec backend npm run db:seed

# Check authentication middleware
grep -n "auth" backend/src/middleware/
```

### Security Vulnerabilities

**Problem**: Prompt injection detected
```
Security alert: Potential prompt injection
```

**Solution**:
```bash
# Review security settings
grep -n "security" backend/.env

# Update security rules
echo "ENABLE_SECURITY_SCAN=true" >> backend/.env

# Check for updates
npm audit
npm audit fix
```

## 📊 Data Issues

### Data Corruption

**Problem**: Database corruption
```
Error: database disk image is malformed
```

**Solution**:
```bash
# For SQLite
sqlite3 database.sqlite ".dump" | sqlite3 database_repaired.sqlite

# For PostgreSQL
pg_dump promptcard > backup.sql
dropdb promptcard
createdb promptcard
psql promptcard < backup.sql

# Restore from backup
docker-compose down
cp backup/database.sqlite backend/data/
docker-compose up -d
```

**Problem**: Missing data
```
Error: Cannot find prompt card with ID: 123
```

**Solution**:
```bash
# Check database contents
docker-compose exec backend npm run db:check

# Restore from backup
docker-compose exec -T postgres psql -U promptcard promptcard < backup.sql

# Reseed database if needed
docker-compose exec backend npm run db:seed
```

### Import/Export Issues

**Problem**: YAML import failures
```
Error: Invalid YAML format
```

**Solution**:
```bash
# Validate YAML format
python -c "import yaml; yaml.safe_load(open('file.yml'))"

# Check file encoding
file -I file.yml

# Convert encoding if needed
iconv -f ISO-8859-1 -t UTF-8 file.yml > file_utf8.yml
```

## 🔄 Service Issues

### Container Issues

**Problem**: Container keeps restarting
```
Container exited with code 1
```

**Solution**:
```bash
# Check container logs
docker-compose logs backend

# Check container status
docker-compose ps

# Inspect container
docker inspect prompt-card-system_backend_1

# Debug container interactively
docker-compose exec backend bash
```

**Problem**: Service dependencies not starting
```
backend_1 | Error: connect ECONNREFUSED postgres:5432
```

**Solution**:
```bash
# Check service dependencies
docker-compose config

# Add health checks
healthcheck:
  test: ["CMD", "pg_isready", "-U", "promptcard"]
  interval: 30s
  timeout: 5s
  retries: 5

# Use depends_on with condition
depends_on:
  postgres:
    condition: service_healthy
```

### Resource Limits

**Problem**: Container running out of memory
```
Killed (OOMKilled)
```

**Solution**:
```bash
# Check memory usage
docker stats

# Increase memory limits
deploy:
  resources:
    limits:
      memory: 2G
    reservations:
      memory: 1G

# Optimize application memory usage
echo "NODE_OPTIONS=--max-old-space-size=1536" >> backend/.env
```

## 🔍 Debugging Techniques

### Logging and Monitoring

**Enable debug logging**:
```bash
# Backend debug logging
echo "LOG_LEVEL=debug" >> backend/.env

# Frontend debug logging
echo "NEXT_PUBLIC_DEBUG=true" >> frontend/.env.local

# Database query logging
echo "DATABASE_LOGGING=true" >> backend/.env
```

**Monitor resource usage**:
```bash
# Real-time monitoring
htop
iotop

# Docker resource monitoring
docker stats

# System monitoring
dstat -cdngy
```

### Testing and Validation

**Test API endpoints**:
```bash
# Health check
curl http://localhost:3001/api/health

# Test authentication
curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/prompt-cards

# Test database connection
curl http://localhost:3001/api/health/db
```

**Validate configuration**:
```bash
# Check environment variables
printenv | grep -E "(NODE_ENV|DATABASE_URL|API_KEY)"

# Validate JSON configuration
python -m json.tool config.json

# Check file permissions
ls -la backend/data/
```

## 🆘 Getting Help

### Log Collection

**Collect system logs**:
```bash
#!/bin/bash
# collect-logs.sh

mkdir -p logs/$(date +%Y%m%d)
cd logs/$(date +%Y%m%d)

# System logs
sudo journalctl --since "1 hour ago" > system.log

# Docker logs
docker-compose logs > docker.log

# Application logs
docker-compose exec backend cat /app/logs/app.log > backend.log

# Database logs
docker-compose logs postgres > postgres.log

# System information
uname -a > system-info.txt
df -h > disk-usage.txt
free -h > memory-usage.txt
docker version > docker-version.txt
docker-compose version > docker-compose-version.txt

echo "Logs collected in logs/$(date +%Y%m%d)/"
```

### Support Information

When contacting support, include:
- **Version information**: System version, Docker version
- **Environment details**: OS, hardware specs, configuration
- **Error messages**: Complete error messages and stack traces
- **Steps to reproduce**: Exact steps that lead to the issue
- **Logs**: Relevant log files and outputs

### Community Resources

- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Check the latest documentation
- **Community Forum**: Ask questions and share solutions
- **Stack Overflow**: Search for similar issues

---

**Still having issues?** Check the [FAQ](./faq.md) or create a support ticket with the information above.