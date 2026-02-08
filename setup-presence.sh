#!/bin/bash
# Setup Presence Detection
# Run this to configure device presence monitoring

echo "🏠 Presence Detection Setup"
echo "==========================="
echo ""
echo "This feature detects when phones/devices join your WiFi"
echo "and can trigger custom voice greetings!"
echo ""

# Check if HA is available
if [ -n "$HOME_ASSISTANT_TOKEN" ]; then
    echo "✅ Home Assistant detected - Using HA device tracker (recommended)"
    echo ""
    echo "📋 To add people to Home Assistant:"
    echo "   1. Go to http://192.168.0.50:8123"
    echo "   2. Settings → People"
    echo "   3. Add person with device tracker"
    echo "   4. Add their phone (via Companion App or router integration)"
    echo ""
else
    echo "⚠️  Home Assistant not configured - Will use MAC address detection"
    echo ""
fi

echo "📱 Option 1: MAC Address Detection (works without HA)"
echo ""

# Find current devices on network
echo "Scanning for devices on your network..."
echo "(This shows currently connected devices)"
echo ""

# Show ARP table
ip neigh show 2>/dev/null | grep -v "FAILED\|INCOMPLETE" | head -10

echo ""
echo "📋 To add a device:"
echo "   1. Find the MAC address above (format: aa:bb:cc:dd:ee:ff)"
echo "   2. Add to ~/RoboDevil/.env:"
echo ""
echo "   PRESENCE_DEVICE_1_NAME='Joel'"
echo "   PRESENCE_DEVICE_1_MAC='aa:bb:cc:dd:ee:ff'"
echo "   PRESENCE_DEVICE_1_GREETING='Welcome home, Joel!'"
echo ""
echo "   PRESENCE_DEVICE_2_NAME='Amanda'"
echo "   PRESENCE_DEVICE_2_MAC='11:22:33:44:55:66'"
echo "   PRESENCE_DEVICE_2_GREETING='Hello Amanda! Nice to see you!'"
echo ""

# Offer to start presence monitor
read -p "Start presence monitoring daemon? (y/n): " start_monitor

if [ "$start_monitor" = "y" ]; then
    echo "Starting presence monitor..."
    cd ~/RoboDevil
    chmod +x presence-monitor.sh
    nohup ./presence-monitor.sh > /tmp/presence-monitor.log 2>&1 &
echo $! > /tmp/presence-monitor.pid
    echo "✅ Presence monitor started (PID: $(cat /tmp/presence-monitor.pid))"
    echo "   Logs: tail -f /tmp/presence-monitor.log"
fi

echo ""
echo "🗣️  Try voice command: 'Squidworth who is home'"
