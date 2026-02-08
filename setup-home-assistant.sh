#!/bin/bash
# Home Assistant Token Setup Helper
# Run this to configure Home Assistant access for Squidworth

echo "🦑 Squidworth <-> Home Assistant Setup"
echo "========================================"
echo ""

# Check if Home Assistant is running
if ! curl -s http://localhost:8123 >/dev/null 2>&1; then
    echo "❌ Home Assistant not accessible at http://localhost:8123"
    echo ""
    echo "Please ensure:"
    echo "  1. Docker is running"
    echo "  2. Home Assistant container is started:"
    echo "     cd ~/homeassistant && docker-compose up -d"
    exit 1
fi

echo "✅ Home Assistant is running!"
echo ""
echo "🔑 To create an access token:"
echo ""
echo "  1. Open: http://$(hostname -I | awk '{print $1}'):8123"
echo "  2. Click your username (bottom left)"
echo "  3. Scroll to 'Long-lived access tokens'"
echo "  4. Click 'Create Token'"
echo "  5. Name it: 'Squidworth'"
echo "  6. Copy the token (starts with 'eyJ...')"
echo ""

# Check if token already exists
if [ -f ~/RoboDevil/.env ]; then
    existing_token=$(grep HOME_ASSISTANT_TOKEN ~/RoboDevil/.env | cut -d'=' -f2)
    if [ -n "$existing_token" ]; then
        echo "⚠️  Token already configured: ${existing_token:0:20}..."
        read -p "Do you want to update it? (y/n): " update
        if [ "$update" != "y" ]; then
            echo "Keeping existing token."
            exit 0
        fi
    fi
fi

read -p "Paste your Home Assistant token: " token

if [ -z "$token" ]; then
    echo "❌ No token provided"
    exit 1
fi

# Test the token
echo ""
echo "🧪 Testing token..."
response=$(curl -s -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    http://localhost:8123/api/states)

if [ -z "$response" ] || [ "$response" = "401" ]; then
    echo "❌ Token invalid or API error"
    exit 1
fi

# Count entities
entity_count=$(echo "$response" | grep -o '"entity_id"' | wc -l)
lights=$(echo "$response" | grep '"entity_id":"light\.' | wc -l)
switches=$(echo "$response" | grep '"entity_id":"switch\.' | wc -l)
sensors=$(echo "$response" | grep '"entity_id":"sensor\.' | wc -l)

echo "✅ Token works!"
echo ""
echo "📊 Found:"
echo "  • Total entities: $entity_count"
echo "  • Lights: $lights"
echo "  • Switches: $switches"
echo "  • Sensors: $sensors"

# Save to .env
echo ""
echo "💾 Saving configuration..."

# Read existing .env
if [ -f ~/RoboDevil/.env ]; then
    # Remove existing HA entries
    grep -v "HOME_ASSISTANT" ~/RoboDevil/.env > /tmp/.env.tmp || true
    mv /tmp/.env.tmp ~/RoboDevil/.env
fi

# Add new config
cat >> ~/RoboDevil/.env << EOF

# Home Assistant Integration
HOME_ASSISTANT_URL=http://localhost:8123
HOME_ASSISTANT_TOKEN=$token
EOF

echo "✅ Configuration saved to ~/RoboDevil/.env"
echo ""
echo "🎉 Setup complete!"
echo ""
echo "🗣️  Try these voice commands:"
echo "  • 'Squidworth turn on the lights'"
echo "  • 'Squidworth turn off living room'"
echo "  • 'Squidworth dim the bedroom light'"
echo ""
echo "🔄 Restart the voice assistant to load the new skill:"
echo "   cd ~/RoboDevil && ./voice-control.sh restart"
