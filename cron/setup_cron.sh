#!/bin/bash

# Simple Local Cron Job Setup for Sentiment Analysis
# This script sets up a daily cron job that runs sentiment analysis at 9 AM

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.env"
CONFIG_EXAMPLE="$SCRIPT_DIR/config.env.example"
SENTIMENT_SCRIPT="$SCRIPT_DIR/sentiment_fetch.py"
LOG_FILE="$SCRIPT_DIR/sentiment_cron.log"

echo "🚀 Setting up Daily Sentiment Analysis Cron Job"
echo "================================================="

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3 first."
    echo "   On macOS: brew install python3"
    echo "   On Ubuntu/Debian: sudo apt install python3 python3-pip"
    exit 1
fi

# Check if requests library is installed
if ! python3 -c "import requests" &> /dev/null; then
    echo "📦 Installing requests library..."
    pip3 install requests || {
        echo "❌ Failed to install requests library"
        echo "   Please run: pip3 install requests"
        exit 1
    }
fi

# Create config file if it doesn't exist
if [ ! -f "$CONFIG_FILE" ]; then
    echo "📝 Creating configuration file..."
    
    if [ -f "$CONFIG_EXAMPLE" ]; then
        cp "$CONFIG_EXAMPLE" "$CONFIG_FILE"
    else
        cat > "$CONFIG_FILE" << EOF
# Configuration for sentiment analysis cron job

# Your application URL (local or deployed)
BASE_URL=http://localhost:3000

# Authentication secret for the cron endpoint
# Generate a secure random string: openssl rand -base64 32
CRON_SECRET=\$(openssl rand -base64 32)

# Request timeout in seconds (default: 300 = 5 minutes)
REQUEST_TIMEOUT=300
EOF
    fi
    
    # Prompt for configuration
    echo ""
    echo "🔧 Please configure your settings:"
    echo ""
    
    # Ask for BASE_URL
    echo "What is your application URL?"
    echo "  - For local development: http://localhost:3000"
    echo "  - For production: https://your-app.vercel.app"
    read -p "BASE_URL: " base_url
    
    if [ -n "$base_url" ]; then
        sed -i.bak "s|BASE_URL=.*|BASE_URL=$base_url|" "$CONFIG_FILE"
        rm "$CONFIG_FILE.bak"
    fi
    
    # Generate secure CRON_SECRET
    echo ""
    echo "🔐 Generating secure CRON_SECRET..."
    cron_secret=$(openssl rand -base64 32)
    sed -i.bak "s|CRON_SECRET=.*|CRON_SECRET=$cron_secret|" "$CONFIG_FILE"
    rm "$CONFIG_FILE.bak"
    
    echo "✅ Configuration file created: $CONFIG_FILE"
else
    echo "✅ Configuration file already exists: $CONFIG_FILE"
fi

# Make scripts executable
chmod +x "$SENTIMENT_SCRIPT"
echo "✅ Made sentiment_fetch.py executable"

# Create log file if it doesn't exist
touch "$LOG_FILE"
echo "✅ Created log file: $LOG_FILE"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$SENTIMENT_SCRIPT"; then
    echo "✅ Cron job already exists"
    echo ""
    echo "Current cron jobs:"
    crontab -l | grep "$SENTIMENT_SCRIPT"
else
    echo "📅 Adding cron job..."
    
    # Create temporary cron file
    TEMP_CRON=$(mktemp)
    
    # Add existing cron jobs (if any)
    crontab -l 2>/dev/null > "$TEMP_CRON" || true
    
    # Add our cron job
    echo "" >> "$TEMP_CRON"
    echo "# Daily sentiment analysis at 9 AM" >> "$TEMP_CRON"
    echo "0 9 * * * cd $SCRIPT_DIR && python3 $SENTIMENT_SCRIPT >> $LOG_FILE 2>&1" >> "$TEMP_CRON"
    
    # Install the new crontab
    crontab "$TEMP_CRON"
    rm "$TEMP_CRON"
    
    echo "✅ Cron job added successfully"
fi

# Test the script
echo ""
echo "🧪 Testing the sentiment fetch script..."
echo "This may take a few minutes..."

cd "$SCRIPT_DIR"
if python3 "$SENTIMENT_SCRIPT"; then
    echo "✅ Test successful!"
else
    echo "⚠️  Test failed, but cron job is still set up"
    echo "   Check the logs: tail -f $LOG_FILE"
fi

echo ""
echo "🎉 Setup Complete!"
echo "==================="
echo "✅ Cron job configured to run daily at 9:00 AM"
echo "✅ Configuration file: $CONFIG_FILE"
echo "✅ Log file: $LOG_FILE"
echo ""
echo "📋 Useful Commands:"
echo "   View cron jobs:    crontab -l"
echo "   View logs:         tail -f $LOG_FILE"
echo "   Test manually:     cd $SCRIPT_DIR && python3 sentiment_fetch.py"
echo "   Edit config:       nano $CONFIG_FILE"
echo ""
echo "🔍 Monitoring:"
echo "   The sentiment analysis will run automatically every morning at 9 AM"
echo "   Check the logs regularly to ensure everything is working correctly"
echo ""