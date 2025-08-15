#!/bin/bash

# Ollama Download Progress Monitor
# Shows real-time progress bar for model downloads

CONTAINER_NAME="docker-ollama-1"
PROGRESS_FILE="/tmp/ollama-progress.txt"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Progress bar function
draw_progress_bar() {
    local progress=$1
    local total=$2
    local downloaded=$3
    local speed=$4
    local eta=$5
    local model=$6
    
    # Calculate percentage
    local percent=0
    if [ "$total" != "0" ] && [ -n "$progress" ]; then
        percent=$(echo "scale=1; $progress * 100 / $total" | bc -l 2>/dev/null || echo "0")
    fi
    
    # Create progress bar (50 characters wide)
    local filled=$(echo "scale=0; $percent / 2" | bc -l 2>/dev/null || echo "0")
    local empty=$((50 - filled))
    
    local bar=""
    for ((i=0; i<filled; i++)); do bar+="█"; done
    for ((i=0; i<empty; i++)); do bar+="░"; done
    
    # Format sizes
    local prog_gb=$(echo "scale=1; $progress / 1000000000" | bc -l 2>/dev/null || echo "0")
    local total_gb=$(echo "scale=1; $total / 1000000000" | bc -l 2>/dev/null || echo "0")
    
    # Clear line and show progress
    printf "\r\033[K"
    printf "${BLUE}📦 Downloading Model:${NC} ${YELLOW}%s${NC}\n" "$model"
    printf "${GREEN}Progress:${NC} [%s] ${YELLOW}%.1f%%${NC}\n" "$bar" "$percent"
    printf "${BLUE}Size:${NC} %.1f GB / %.1f GB  ${BLUE}Speed:${NC} %s  ${BLUE}ETA:${NC} %s\n" "$prog_gb" "$total_gb" "$speed" "$eta"
    printf "\033[3A" # Move cursor up 3 lines for next update
}

echo -e "${GREEN}🚀 Ollama Model Download Progress Monitor${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""
echo ""
echo ""

# Check if container exists
if ! docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}" | grep -q "$CONTAINER_NAME"; then
    echo -e "${RED}❌ Container $CONTAINER_NAME not found or not running${NC}"
    exit 1
fi

# Monitor progress
while true; do
    # Get latest logs and extract progress info
    logs=$(docker logs "$CONTAINER_NAME" --tail 5 2>/dev/null)
    
    # Look for download progress pattern
    if echo "$logs" | grep -q "pulling.*%"; then
        # Extract progress information using more robust parsing
        progress_line=$(echo "$logs" | grep "pulling.*%" | tail -1)
        
        # Extract model name, percentage, downloaded/total, speed, and ETA
        model=$(echo "$progress_line" | sed -n 's/.*pulling \([^:]*\):.*/\1/p' || echo "Unknown Model")
        percent=$(echo "$progress_line" | sed -n 's/.*pulling [^:]*:[[:space:]]*\([0-9]*\)%.*/\1/p')
        sizes=$(echo "$progress_line" | sed -n 's/.*\([0-9.]*[[:space:]]*[KMGT]B\)[[:space:]]*\/[[:space:]]*\([0-9.]*[[:space:]]*[KMGT]B\).*/\1 \2/p')
        speed=$(echo "$progress_line" | sed -n 's/.*\([0-9.]*[[:space:]]*[KMGT]B\/s\).*/\1/p')
        eta=$(echo "$progress_line" | sed -n 's/.*[0-9.]*[[:space:]]*[KMGT]B\/s[[:space:]]*\([0-9]*m[0-9]*s\).*/\1/p')
        
        # Convert sizes to bytes for calculation
        downloaded_raw=$(echo "$sizes" | awk '{print $1}')
        total_raw=$(echo "$sizes" | awk '{print $2}')
        
        # Convert to bytes (simplified - assumes GB for now)
        downloaded_bytes=$(echo "$downloaded_raw" | sed 's/[^0-9.]//g' | awk '{print $1 * 1000000000}')
        total_bytes=$(echo "$total_raw" | sed 's/[^0-9.]//g' | awk '{print $1 * 1000000000}')
        
        # Draw progress bar
        draw_progress_bar "$downloaded_bytes" "$total_bytes" "$downloaded_raw" "$speed" "$eta" "$model"
        
    elif echo "$logs" | grep -q "success"; then
        printf "\r\033[K"
        echo -e "\n\n${GREEN}✅ Download Complete!${NC}"
        echo -e "${BLUE}Model successfully downloaded and ready to use.${NC}"
        break
    elif echo "$logs" | grep -qi "error\|fail"; then
        printf "\r\033[K"
        echo -e "\n\n${RED}❌ Download Failed!${NC}"
        echo -e "${YELLOW}Check logs with: docker logs $CONTAINER_NAME${NC}"
        break
    else
        # Show waiting message
        printf "\r\033[K"
        echo -e "${YELLOW}⏳ Initializing download...${NC}"
        printf "\033[1A" # Move cursor up 1 line
    fi
    
    sleep 2
done

echo ""
echo -e "${GREEN}Monitor complete!${NC}"