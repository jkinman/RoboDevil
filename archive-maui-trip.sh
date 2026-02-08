#!/bin/bash
# Archive Maui-specific skills after trip is complete

echo "🗑️  Archiving Maui Trip Skills"
echo "==============================="
echo ""

cd ~/RoboDevil/skills/voice

# Create archive directory
mkdir -p archive-maui-2026

# Move Maui-specific skills
echo "📦 Archiving Maui-specific skills..."
for skill in flight.sh hotel.sh scuba.sh bike.sh hana.sh; do
    if [ -f "$skill" ]; then
        mv "$skill" archive-maui-2026/
        echo "  ✅ Archived: $skill"
    fi
done

# Remove trip config
echo ""
echo "🗑️  Removing trip configuration..."
if [ -f ~/RoboDevil/trip-config-maui-2026.env ]; then
    rm ~/RoboDevil/trip-config-maui-2026.env
    echo "  ✅ Removed trip-config-maui-2026.env"
fi

# Update .env to remove trip config reference
echo ""
echo "📝 Cleaning up .env..."
sed -i '/trip-config-maui-2026.env/d' ~/RoboDevil/.env
sed -i '/Trip-specific configuration/d' ~/RoboDevil/.env

echo ""
echo "🔄 Restarting voice assistant..."
cd ~/RoboDevil
./voice-control.sh restart

echo ""
echo "✅ Maui trip skills archived!"
echo ""
echo "🦑 Generic voice assistant ready for next adventure!"
echo ""
echo "To restore Maui skills later (if needed):"
echo "  cd ~/RoboDevil/skills/voice"
echo "  mv archive-maui-2026/*.sh ."
echo "  ./voice-control.sh restart"
