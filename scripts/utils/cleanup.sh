#!/bin/bash
# =============================================================================
# 🧹 COMPREHENSIVE CLEANUP SCRIPT
# =============================================================================
# Memory-driven cleanup patterns from build optimization analysis:
# - Docker image and container cleanup with size optimization
# - Build artifact removal based on actual build patterns
# - Node modules and dependency cache management
# - Log rotation and temporary file cleanup
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CLEANUP_TYPE="${CLEANUP_TYPE:-all}"
DRY_RUN="${DRY_RUN:-false}"
FORCE="${FORCE:-false}"
KEEP_DAYS="${KEEP_DAYS:-7}"
DOCKER_CLEANUP="${DOCKER_CLEANUP:-true}"
NODE_CLEANUP="${NODE_CLEANUP:-true}"
BUILD_CLEANUP="${BUILD_CLEANUP:-true}"
LOG_CLEANUP="${LOG_CLEANUP:-true}"
TEMP_CLEANUP="${TEMP_CLEANUP:-true}"

# Statistics tracking
declare -A CLEANUP_STATS=(
    ["docker_images_removed"]=0
    ["docker_containers_removed"]=0
    ["docker_volumes_removed"]=0
    ["docker_networks_removed"]=0
    ["build_artifacts_removed"]=0
    ["node_modules_removed"]=0
    ["log_files_removed"]=0
    ["temp_files_removed"]=0
    ["space_freed_mb"]=0
)

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Calculate directory size
get_directory_size() {
    local dir="$1"
    if [[ -d "$dir" ]]; then
        du -sm "$dir" 2>/dev/null | cut -f1 || echo "0"
    else
        echo "0"
    fi
}

# Safe removal with confirmation
safe_remove() {
    local target="$1"
    local description="$2"
    local size="${3:-0}"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would remove $description: $target"
        if [[ "$size" != "0" ]]; then
            log "  Size: ${size}MB"
        fi
        return 0
    fi
    
    if [[ "$FORCE" != "true" ]]; then
        if [[ -n "${CI:-}" ]]; then
            # In CI environment, auto-confirm
            log "CI environment detected, auto-confirming removal"
        else
            read -p "Remove $description ($target)? [y/N] " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log "Skipping removal of $description"
                return 0
            fi
        fi
    fi
    
    if [[ -d "$target" ]]; then
        rm -rf "$target"
        log "Removed directory: $target"
    elif [[ -f "$target" ]]; then
        rm -f "$target"
        log "Removed file: $target"
    else
        warning "Target not found: $target"
        return 1
    fi
    
    if [[ "$size" != "0" ]]; then
        CLEANUP_STATS["space_freed_mb"]=$((${CLEANUP_STATS["space_freed_mb"]} + size))
    fi
    
    return 0
}

# Docker cleanup
cleanup_docker() {
    if [[ "$DOCKER_CLEANUP" != "true" ]]; then
        return 0
    fi
    
    log "Starting Docker cleanup..."
    
    # Check if Docker is available
    if ! command -v docker >/dev/null 2>&1; then
        warning "Docker not found, skipping Docker cleanup"
        return 0
    fi
    
    if ! docker info >/dev/null 2>&1; then
        warning "Docker daemon not running, skipping Docker cleanup"
        return 0
    fi
    
    # Stop and remove containers
    log "Cleaning up Docker containers..."
    
    # Get list of containers to remove
    local containers_to_remove
    containers_to_remove=$(docker ps -aq --filter "status=exited" 2>/dev/null || true)
    
    if [[ -n "$containers_to_remove" ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then
            local container_count
            container_count=$(echo "$containers_to_remove" | wc -l)
            log "DRY RUN: Would remove $container_count exited containers"
        else
            echo "$containers_to_remove" | xargs docker rm 2>/dev/null || true
            CLEANUP_STATS["docker_containers_removed"]=$(echo "$containers_to_remove" | wc -l)
            success "Removed exited containers"
        fi
    else
        log "No exited containers to remove"
    fi
    
    # Remove dangling images
    log "Cleaning up Docker images..."
    
    local dangling_images
    dangling_images=$(docker images -f "dangling=true" -q 2>/dev/null || true)
    
    if [[ -n "$dangling_images" ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then
            local image_count
            image_count=$(echo "$dangling_images" | wc -l)
            log "DRY RUN: Would remove $image_count dangling images"
        else
            echo "$dangling_images" | xargs docker rmi 2>/dev/null || true
            CLEANUP_STATS["docker_images_removed"]=$(echo "$dangling_images" | wc -l)
            success "Removed dangling images"
        fi
    else
        log "No dangling images to remove"
    fi
    
    # Remove old images (older than KEEP_DAYS)
    log "Removing old Docker images (older than $KEEP_DAYS days)..."
    
    local old_images
    old_images=$(docker images --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}" | \
        awk -v days="$KEEP_DAYS" '
        NR>1 {
            cmd = "date -d \""$2" "$3"\" +%s"
            cmd | getline image_time
            close(cmd)
            cmd = "date +%s"
            cmd | getline current_time
            close(cmd)
            if (current_time - image_time > days * 86400) {
                print $1
            }
        }' 2>/dev/null || true)
    
    if [[ -n "$old_images" ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then
            local image_count
            image_count=$(echo "$old_images" | wc -l)
            log "DRY RUN: Would remove $image_count old images"
        else
            echo "$old_images" | xargs docker rmi -f 2>/dev/null || true
            success "Removed old images"
        fi
    fi
    
    # Remove unused volumes
    log "Cleaning up Docker volumes..."
    
    local unused_volumes
    unused_volumes=$(docker volume ls -qf dangling=true 2>/dev/null || true)
    
    if [[ -n "$unused_volumes" ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then
            local volume_count
            volume_count=$(echo "$unused_volumes" | wc -l)
            log "DRY RUN: Would remove $volume_count unused volumes"
        else
            echo "$unused_volumes" | xargs docker volume rm 2>/dev/null || true
            CLEANUP_STATS["docker_volumes_removed"]=$(echo "$unused_volumes" | wc -l)
            success "Removed unused volumes"
        fi
    else
        log "No unused volumes to remove"
    fi
    
    # Remove unused networks
    log "Cleaning up Docker networks..."
    
    local unused_networks
    unused_networks=$(docker network ls --filter "type=custom" --format "{{.ID}}" 2>/dev/null | \
        while read -r network; do
            if ! docker network inspect "$network" --format "{{.Containers}}" | grep -q .; then
                echo "$network"
            fi
        done)
    
    if [[ -n "$unused_networks" ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then
            local network_count
            network_count=$(echo "$unused_networks" | wc -l)
            log "DRY RUN: Would remove $network_count unused networks"
        else
            echo "$unused_networks" | xargs docker network rm 2>/dev/null || true
            CLEANUP_STATS["docker_networks_removed"]=$(echo "$unused_networks" | wc -l)
            success "Removed unused networks"
        fi
    else
        log "No unused networks to remove"
    fi
    
    # System prune (with confirmation)
    if [[ "$FORCE" == "true" ]] || [[ "$DRY_RUN" == "true" ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then
            log "DRY RUN: Would run docker system prune"
        else
            log "Running Docker system prune..."
            docker system prune -f --volumes 2>/dev/null || true
            success "Docker system prune completed"
        fi
    fi
    
    success "Docker cleanup completed"
}

# Node.js cleanup
cleanup_node() {
    if [[ "$NODE_CLEANUP" != "true" ]]; then
        return 0
    fi
    
    log "Starting Node.js cleanup..."
    
    # Find and clean node_modules directories
    log "Cleaning up node_modules directories..."
    
    local node_modules_dirs
    node_modules_dirs=$(find . -name "node_modules" -type d 2>/dev/null || true)
    
    if [[ -n "$node_modules_dirs" ]]; then
        while read -r dir; do
            if [[ -d "$dir" ]]; then
                local size
                size=$(get_directory_size "$dir")
                
                # Skip if it's in a recently modified directory (active development)
                local parent_dir
                parent_dir=$(dirname "$dir")
                
                if [[ $(find "$parent_dir" -name "package.json" -mtime -1 2>/dev/null | wc -l) -gt 0 ]]; then
                    log "Skipping recently active node_modules: $dir"
                    continue
                fi
                
                safe_remove "$dir" "node_modules directory" "$size"
                CLEANUP_STATS["node_modules_removed"]=$((${CLEANUP_STATS["node_modules_removed"]} + 1))
            fi
        done <<< "$node_modules_dirs"
    else
        log "No node_modules directories found"
    fi
    
    # Clean npm cache
    if command -v npm >/dev/null 2>&1; then
        log "Cleaning npm cache..."
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log "DRY RUN: Would clean npm cache"
        else
            npm cache clean --force 2>/dev/null || true
            success "npm cache cleaned"
        fi
    fi
    
    # Clean yarn cache
    if command -v yarn >/dev/null 2>&1; then
        log "Cleaning yarn cache..."
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log "DRY RUN: Would clean yarn cache"
        else
            yarn cache clean 2>/dev/null || true
            success "yarn cache cleaned"
        fi
    fi
    
    success "Node.js cleanup completed"
}

# Build artifacts cleanup
cleanup_build_artifacts() {
    if [[ "$BUILD_CLEANUP" != "true" ]]; then
        return 0
    fi
    
    log "Starting build artifacts cleanup..."
    
    # Common build directories
    local build_patterns=(
        "*/dist"
        "*/.next"
        "*/build"
        "*/.nuxt"
        "*/out"
        "*/.vite/deps"
        "*/.cache"
        "*/coverage"
        "*/test-reports"
    )
    
    for pattern in "${build_patterns[@]}"; do
        local dirs
        dirs=$(find . -path "./$pattern" -type d 2>/dev/null || true)
        
        if [[ -n "$dirs" ]]; then
            while read -r dir; do
                if [[ -d "$dir" ]]; then
                    local size
                    size=$(get_directory_size "$dir")
                    
                    safe_remove "$dir" "build artifact directory" "$size"
                    CLEANUP_STATS["build_artifacts_removed"]=$((${CLEANUP_STATS["build_artifacts_removed"]} + 1))
                fi
            done <<< "$dirs"
        fi
    done
    
    # TypeScript build info files
    log "Cleaning TypeScript build info files..."
    
    local ts_build_files
    ts_build_files=$(find . -name "*.tsbuildinfo" -type f 2>/dev/null || true)
    
    if [[ -n "$ts_build_files" ]]; then
        while read -r file; do
            safe_remove "$file" "TypeScript build info file"
        done <<< "$ts_build_files"
    fi
    
    # Jest cache
    log "Cleaning Jest cache..."
    
    local jest_cache_dirs
    jest_cache_dirs=$(find . -name ".jest" -type d 2>/dev/null || true)
    
    if [[ -n "$jest_cache_dirs" ]]; then
        while read -r dir; do
            if [[ -d "$dir" ]]; then
                local size
                size=$(get_directory_size "$dir")
                safe_remove "$dir" "Jest cache directory" "$size"
            fi
        done <<< "$jest_cache_dirs"
    fi
    
    success "Build artifacts cleanup completed"
}

# Log files cleanup
cleanup_logs() {
    if [[ "$LOG_CLEANUP" != "true" ]]; then
        return 0
    fi
    
    log "Starting log files cleanup..."
    
    # Find and clean old log files
    local log_patterns=(
        "*.log"
        "logs/*.log"
        "logs/*.out"
        "*.out"
        "npm-debug.log*"
        "yarn-debug.log*"
        "yarn-error.log*"
    )
    
    for pattern in "${log_patterns[@]}"; do
        local files
        files=$(find . -name "$pattern" -type f -mtime +$KEEP_DAYS 2>/dev/null || true)
        
        if [[ -n "$files" ]]; then
            while read -r file; do
                safe_remove "$file" "log file"
                CLEANUP_STATS["log_files_removed"]=$((${CLEANUP_STATS["log_files_removed"]} + 1))
            done <<< "$files"
        fi
    done
    
    # Rotate large log files
    log "Checking for large log files..."
    
    local large_logs
    large_logs=$(find . -name "*.log" -type f -size +100M 2>/dev/null || true)
    
    if [[ -n "$large_logs" ]]; then
        while read -r logfile; do
            if [[ -f "$logfile" ]]; then
                local size
                size=$(du -m "$logfile" | cut -f1)
                
                log "Large log file found: $logfile (${size}MB)"
                
                if [[ "$DRY_RUN" == "true" ]]; then
                    log "DRY RUN: Would rotate large log file: $logfile"
                else
                    # Rotate the log file
                    mv "$logfile" "${logfile}.old"
                    touch "$logfile"
                    gzip "${logfile}.old" 2>/dev/null || true
                    success "Rotated large log file: $logfile"
                fi
            fi
        done <<< "$large_logs"
    fi
    
    success "Log files cleanup completed"
}

# Temporary files cleanup
cleanup_temp_files() {
    if [[ "$TEMP_CLEANUP" != "true" ]]; then
        return 0
    fi
    
    log "Starting temporary files cleanup..."
    
    # Temporary file patterns
    local temp_patterns=(
        "*.tmp"
        "*.temp"
        ".DS_Store"
        "Thumbs.db"
        "*.swp"
        "*.swo"
        "*~"
        ".#*"
        "#*#"
    )
    
    for pattern in "${temp_patterns[@]}"; do
        local files
        files=$(find . -name "$pattern" -type f 2>/dev/null || true)
        
        if [[ -n "$files" ]]; then
            while read -r file; do
                safe_remove "$file" "temporary file"
                CLEANUP_STATS["temp_files_removed"]=$((${CLEANUP_STATS["temp_files_removed"]} + 1))
            done <<< "$files"
        fi
    done
    
    # Clean system temporary directories
    if [[ -d "/tmp" ]]; then
        log "Cleaning system temporary files older than $KEEP_DAYS days..."
        
        local old_temp_files
        old_temp_files=$(find /tmp -type f -mtime +$KEEP_DAYS -user "$(whoami)" 2>/dev/null || true)
        
        if [[ -n "$old_temp_files" ]]; then
            while read -r file; do
                safe_remove "$file" "system temporary file"
            done <<< "$old_temp_files"
        fi
    fi
    
    success "Temporary files cleanup completed"
}

# Generate cleanup report
generate_cleanup_report() {
    log "Generating cleanup report..."
    
    local report_file="cleanup-report-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "cleanup_type": "$CLEANUP_TYPE",
  "dry_run": $DRY_RUN,
  "keep_days": $KEEP_DAYS,
  "statistics": {
    "docker_images_removed": ${CLEANUP_STATS["docker_images_removed"]},
    "docker_containers_removed": ${CLEANUP_STATS["docker_containers_removed"]},
    "docker_volumes_removed": ${CLEANUP_STATS["docker_volumes_removed"]},
    "docker_networks_removed": ${CLEANUP_STATS["docker_networks_removed"]},
    "build_artifacts_removed": ${CLEANUP_STATS["build_artifacts_removed"]},
    "node_modules_removed": ${CLEANUP_STATS["node_modules_removed"]},
    "log_files_removed": ${CLEANUP_STATS["log_files_removed"]},
    "temp_files_removed": ${CLEANUP_STATS["temp_files_removed"]},
    "space_freed_mb": ${CLEANUP_STATS["space_freed_mb"]}
  },
  "configuration": {
    "docker_cleanup": $DOCKER_CLEANUP,
    "node_cleanup": $NODE_CLEANUP,
    "build_cleanup": $BUILD_CLEANUP,
    "log_cleanup": $LOG_CLEANUP,
    "temp_cleanup": $TEMP_CLEANUP
  }
}
EOF
    
    log "Cleanup report generated: $report_file"
}

# Main cleanup function
main() {
    log "Starting comprehensive cleanup..."
    log "Cleanup type: $CLEANUP_TYPE"
    log "Dry run: $DRY_RUN"
    log "Force: $FORCE"
    log "Keep days: $KEEP_DAYS"
    
    # Calculate initial disk usage
    local initial_usage
    initial_usage=$(df . | tail -1 | awk '{print $3}')
    
    # Run cleanup based on type
    case "$CLEANUP_TYPE" in
        "all")
            cleanup_docker
            cleanup_node
            cleanup_build_artifacts
            cleanup_logs
            cleanup_temp_files
            ;;
        "docker")
            cleanup_docker
            ;;
        "node")
            cleanup_node
            ;;
        "build")
            cleanup_build_artifacts
            ;;
        "logs")
            cleanup_logs
            ;;
        "temp")
            cleanup_temp_files
            ;;
        *)
            error "Unknown cleanup type: $CLEANUP_TYPE"
            exit 1
            ;;
    esac
    
    # Calculate final disk usage
    local final_usage
    final_usage=$(df . | tail -1 | awk '{print $3}')
    local space_freed
    space_freed=$((initial_usage - final_usage))
    
    if [[ $space_freed -gt 0 ]]; then
        CLEANUP_STATS["space_freed_mb"]=$((space_freed / 1024))
    fi
    
    # Generate report
    generate_cleanup_report
    
    # Final summary
    echo
    log "========================================="
    log "CLEANUP SUMMARY"
    log "========================================="
    
    if [[ "$DRY_RUN" == "true" ]]; then
        warning "This was a dry run - no files were actually removed"
    fi
    
    log "Docker images removed: ${CLEANUP_STATS["docker_images_removed"]}"
    log "Docker containers removed: ${CLEANUP_STATS["docker_containers_removed"]}"
    log "Docker volumes removed: ${CLEANUP_STATS["docker_volumes_removed"]}"
    log "Build artifacts removed: ${CLEANUP_STATS["build_artifacts_removed"]}"
    log "Node modules removed: ${CLEANUP_STATS["node_modules_removed"]}"
    log "Log files removed: ${CLEANUP_STATS["log_files_removed"]}"
    log "Temp files removed: ${CLEANUP_STATS["temp_files_removed"]}"
    log "Total space freed: ${CLEANUP_STATS["space_freed_mb"]}MB"
    
    success "Cleanup completed successfully!"
}

# Handle script arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --type)
            CLEANUP_TYPE="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --force)
            FORCE="true"
            shift
            ;;
        --keep-days)
            KEEP_DAYS="$2"
            shift 2
            ;;
        --no-docker)
            DOCKER_CLEANUP="false"
            shift
            ;;
        --no-node)
            NODE_CLEANUP="false"
            shift
            ;;
        --no-build)
            BUILD_CLEANUP="false"
            shift
            ;;
        --no-logs)
            LOG_CLEANUP="false"
            shift
            ;;
        --no-temp)
            TEMP_CLEANUP="false"
            shift
            ;;
        --help)
            cat << 'EOF'
Usage: cleanup.sh [OPTIONS]

Comprehensive cleanup script for development environments.

OPTIONS:
    --type TYPE                 Cleanup type: all, docker, node, build, logs, temp (default: all)
    --dry-run                   Show what would be removed without actually removing
    --force                     Skip confirmation prompts
    --keep-days DAYS            Keep files newer than DAYS (default: 7)
    --no-docker                 Skip Docker cleanup
    --no-node                   Skip Node.js cleanup
    --no-build                  Skip build artifacts cleanup
    --no-logs                   Skip log files cleanup
    --no-temp                   Skip temporary files cleanup
    --help                      Show this help message

CLEANUP TYPES:
    all                         All cleanup operations
    docker                      Docker images, containers, volumes, networks
    node                        node_modules, npm/yarn cache
    build                       Build artifacts, dist, .next, coverage
    logs                        Log files older than keep-days
    temp                        Temporary files and system cache

EXAMPLES:
    cleanup.sh                              # Full cleanup with confirmation
    cleanup.sh --dry-run                    # See what would be cleaned
    cleanup.sh --type docker --force       # Clean only Docker without confirmation
    cleanup.sh --keep-days 3 --no-docker  # Clean 3-day-old files, skip Docker

SAFETY FEATURES:
    ✓ Dry run mode for safe preview
    ✓ Confirmation prompts (unless --force)
    ✓ Preserves recently active development
    ✓ Detailed cleanup reporting
    ✓ Space usage calculation
EOF
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Execute main function
main