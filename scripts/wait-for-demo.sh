#!/bin/bash

# Wait for backend to be ready, then load demo data
echo "🔄 Waiting for backend to be ready..."

# Wait up to 2 minutes for backend
timeout=120
count=0
while [ $count -lt $timeout ]; do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "✅ Backend is ready!"
        break
    fi
    sleep 2
    count=$((count + 2))
    if [ $((count % 10)) -eq 0 ]; then
        echo "⏳ Still waiting for backend... (${count}s)"
    fi
done

if [ $count -ge $timeout ]; then
    echo "❌ Backend failed to start within ${timeout} seconds"
    exit 1
fi

# Load demo data
echo "🎮 Loading demo data..."
response=$(curl -X POST http://localhost:3001/api/demo/load -H "Content-Type: application/json" -s)

if echo "$response" | grep -q '"success":true'; then
    echo "✅ Demo data loaded successfully!"
    echo "🎉 Demo ready! Visit: http://localhost:3000?demo=true"
else
    echo "⚠️  Demo data loading returned: $response"
    echo "🔄 You can manually load demo data by visiting: http://localhost:3001/api/demo/load"
fi