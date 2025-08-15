#!/bin/bash

# Simple Ollama Progress Monitor
CONTAINER_NAME="docker-ollama-1"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}🚀 Ollama Model Download Monitor${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""

# Check if container is running
if ! docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}" | grep -q "$CONTAINER_NAME"; then
    echo -e "${RED}❌ Container $CONTAINER_NAME not found${NC}"
    exit 1
fi

echo -e "${CYAN}📊 Live Progress Updates:${NC}"
echo ""

# Follow logs with real-time filtering
docker logs "$CONTAINER_NAME" -f 2>&1 | while IFS= read -r line; do
    # Filter and colorize progress lines
    if [[ "$line" =~ pulling.*% ]]; then
        # Extract percentage
        percent=$(echo "$line" | grep -o '[0-9]*%' | head -1)
        
        # Extract download info
        download_info=$(echo "$line" | grep -o '[0-9.]*[[:space:]]*[KMGT]B[[:space:]]*/[[:space:]]*[0-9.]*[[:space:]]*[KMGT]B')
        speed_info=$(echo "$line" | grep -o '[0-9.]*[[:space:]]*[KMGT]B/s')
        eta_info=$(echo "$line" | grep -o '[0-9]*m[0-9]*s')
        
        # Create simple progress bar
        if [[ "$percent" =~ ([0-9]+)% ]]; then
            pct=${BASH_REMATCH[1]}
            filled=$((pct / 2))
            empty=$((50 - filled))
            
            bar=""
            for ((i=0; i<filled; i++)); do bar+="█"; done
            for ((i=0; i<empty; i++)); do bar+="░"; done
            
            printf "\r${YELLOW}Progress: ${GREEN}[$bar] $percent${NC}"
            
            if [ -n "$download_info" ]; then
                printf " ${BLUE}Size: $download_info${NC}"
            fi
            if [ -n "$speed_info" ]; then
                printf " ${CYAN}Speed: $speed_info${NC}"
            fi
            if [ -n "$eta_info" ]; then
                printf " ${YELLOW}ETA: $eta_info${NC}"
            fi
        fi
    elif [[ "$line" =~ success ]] || [[ "$line" =~ "verifying sha256" ]]; then
        echo ""
        echo -e "${GREEN}✅ Download Complete!${NC}"
        break
    elif [[ "$line" =~ error ]] || [[ "$line" =~ fail ]]; then
        echo ""
        echo -e "${RED}❌ Error occurred: $line${NC}"
    elif [[ "$line" =~ "pulling manifest" ]]; then
        echo -e "${BLUE}📦 Pulling model manifest...${NC}"
    elif [[ "$line" =~ "pulling.*:" ]]; then
        model=$(echo "$line" | sed 's/.*pulling \([^:]*\):.*/\1/')
        echo -e "${CYAN}🔽 Downloading model: ${YELLOW}$model${NC}"
    fi
done

echo ""
echo -e "${GREEN}Monitor complete!${NC}"