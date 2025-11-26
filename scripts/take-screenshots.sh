#!/bin/bash

# App Store Screenshot Helper Script
# This script helps you take screenshots for App Store submission

echo "📸 App Store Screenshot Helper"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create screenshots directory
SCREENSHOT_DIR="$HOME/Desktop/Roll-Screenshots"
mkdir -p "$SCREENSHOT_DIR"

echo "Screenshots will be saved to: $SCREENSHOT_DIR"
echo ""

# Function to take screenshot
take_screenshot() {
    local device_name=$1
    local screenshot_name=$2
    
    echo "${BLUE}📱 Switching to $device_name...${NC}"
    xcrun simctl boot "$device_name" 2>/dev/null || echo "Device already booted or not found"
    
    sleep 2
    
    echo "${GREEN}📸 Taking screenshot: $screenshot_name${NC}"
    xcrun simctl io booted screenshot "$SCREENSHOT_DIR/$screenshot_name.png"
    
    if [ $? -eq 0 ]; then
        echo "${GREEN}✅ Screenshot saved: $screenshot_name.png${NC}"
    else
        echo "${YELLOW}⚠️  Failed to take screenshot. Make sure simulator is running.${NC}"
    fi
    echo ""
}

# Check if simulator is running
if ! xcrun simctl list devices | grep -q "Booted"; then
    echo "${YELLOW}⚠️  No simulator is currently running.${NC}"
    echo "Please start your app in the simulator first:"
    echo "  1. Run: npm start"
    echo "  2. Press 'i' to open iOS simulator"
    echo "  3. Navigate to the screen you want to screenshot"
    echo "  4. Run this script again"
    echo ""
    exit 1
fi

echo "Available screenshot options:"
echo "1. iPhone 14 Pro Max (6.7\" - 1290x2796)"
echo "2. iPhone 11 Pro Max (6.5\" - 1242x2688)"
echo "3. iPhone 8 Plus (5.5\" - 1242x2208)"
echo "4. Take all three sizes"
echo ""
read -p "Select option (1-4): " choice

case $choice in
    1)
        echo ""
        echo "📱 iPhone 14 Pro Max Screenshots"
        echo "Navigate to each screen in your app, then press Enter to take screenshot"
        echo ""
        read -p "Press Enter when ready for screenshot 1 (Feed Screen)..."
        take_screenshot "iPhone 14 Pro Max" "iphone-14-pro-max-1"
        read -p "Press Enter when ready for screenshot 2 (Groups Screen)..."
        take_screenshot "iPhone 14 Pro Max" "iphone-14-pro-max-2"
        read -p "Press Enter when ready for screenshot 3 (Chat Screen)..."
        take_screenshot "iPhone 14 Pro Max" "iphone-14-pro-max-3"
        read -p "Press Enter when ready for screenshot 4 (Events Screen)..."
        take_screenshot "iPhone 14 Pro Max" "iphone-14-pro-max-4"
        read -p "Press Enter when ready for screenshot 5 (Map Screen)..."
        take_screenshot "iPhone 14 Pro Max" "iphone-14-pro-max-5"
        ;;
    2)
        echo ""
        echo "📱 iPhone 11 Pro Max Screenshots"
        echo "Navigate to each screen in your app, then press Enter to take screenshot"
        echo ""
        read -p "Press Enter when ready for screenshot 1 (Feed Screen)..."
        take_screenshot "iPhone 11 Pro Max" "iphone-11-pro-max-1"
        read -p "Press Enter when ready for screenshot 2 (Groups Screen)..."
        take_screenshot "iPhone 11 Pro Max" "iphone-11-pro-max-2"
        read -p "Press Enter when ready for screenshot 3 (Chat Screen)..."
        take_screenshot "iPhone 11 Pro Max" "iphone-11-pro-max-3"
        read -p "Press Enter when ready for screenshot 4 (Events Screen)..."
        take_screenshot "iPhone 11 Pro Max" "iphone-11-pro-max-4"
        read -p "Press Enter when ready for screenshot 5 (Map Screen)..."
        take_screenshot "iPhone 11 Pro Max" "iphone-11-pro-max-5"
        ;;
    3)
        echo ""
        echo "📱 iPhone 8 Plus Screenshots"
        echo "Navigate to each screen in your app, then press Enter to take screenshot"
        echo ""
        read -p "Press Enter when ready for screenshot 1 (Feed Screen)..."
        take_screenshot "iPhone 8 Plus" "iphone-8-plus-1"
        read -p "Press Enter when ready for screenshot 2 (Groups Screen)..."
        take_screenshot "iPhone 8 Plus" "iphone-8-plus-2"
        read -p "Press Enter when ready for screenshot 3 (Chat Screen)..."
        take_screenshot "iPhone 8 Plus" "iphone-8-plus-3"
        read -p "Press Enter when ready for screenshot 4 (Events Screen)..."
        take_screenshot "iPhone 8 Plus" "iphone-8-plus-4"
        read -p "Press Enter when ready for screenshot 5 (Map Screen)..."
        take_screenshot "iPhone 8 Plus" "iphone-8-plus-5"
        ;;
    4)
        echo ""
        echo "📱 Taking screenshots for all three device sizes"
        echo "This will switch between devices. Make sure your app is running."
        echo ""
        
        # iPhone 14 Pro Max
        echo "=== iPhone 14 Pro Max ==="
        read -p "Navigate to Feed screen, then press Enter..."
        take_screenshot "iPhone 14 Pro Max" "iphone-14-pro-max-1"
        read -p "Navigate to Groups screen, then press Enter..."
        take_screenshot "iPhone 14 Pro Max" "iphone-14-pro-max-2"
        read -p "Navigate to Chat screen, then press Enter..."
        take_screenshot "iPhone 14 Pro Max" "iphone-14-pro-max-3"
        
        # iPhone 11 Pro Max
        echo "=== iPhone 11 Pro Max ==="
        read -p "Navigate to Feed screen, then press Enter..."
        take_screenshot "iPhone 11 Pro Max" "iphone-11-pro-max-1"
        read -p "Navigate to Groups screen, then press Enter..."
        take_screenshot "iPhone 11 Pro Max" "iphone-11-pro-max-2"
        read -p "Navigate to Chat screen, then press Enter..."
        take_screenshot "iPhone 11 Pro Max" "iphone-11-pro-max-3"
        
        # iPhone 8 Plus
        echo "=== iPhone 8 Plus ==="
        read -p "Navigate to Feed screen, then press Enter..."
        take_screenshot "iPhone 8 Plus" "iphone-8-plus-1"
        read -p "Navigate to Groups screen, then press Enter..."
        take_screenshot "iPhone 8 Plus" "iphone-8-plus-2"
        read -p "Navigate to Chat screen, then press Enter..."
        take_screenshot "iPhone 8 Plus" "iphone-8-plus-3"
        ;;
    *)
        echo "Invalid option"
        exit 1
        ;;
esac

echo ""
echo "${GREEN}✅ Screenshots complete!${NC}"
echo "Screenshots saved to: $SCREENSHOT_DIR"
echo ""
echo "Next steps:"
echo "1. Review screenshots in the folder"
echo "2. Rename them if needed"
echo "3. Upload to App Store Connect"
echo ""
open "$SCREENSHOT_DIR"

