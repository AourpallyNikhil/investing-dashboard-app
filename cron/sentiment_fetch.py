#!/usr/bin/env python3
"""
Simple local cron job script for fetching sentiment data daily at 9 AM.
This script calls the existing sentiment analysis endpoint instead of complex Supabase pg_cron setup.
"""

import os
import sys
import requests
import json
from datetime import datetime
import logging
from pathlib import Path

# Setup logging
script_dir = Path(__file__).parent
log_file = script_dir / "sentiment_cron.log"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

def load_config():
    """Load configuration from environment or config file"""
    config_file = script_dir / "config.env"
    
    # Load from config file if it exists, but don't override existing env vars
    if config_file.exists():
        logger.info(f"Loading config from {config_file}")
        with open(config_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    # Only set if not already in environment (prioritize env vars)
                    if key not in os.environ:
                        os.environ[key] = value.strip()
    
    # Required configuration
    base_url = os.getenv('BASE_URL')
    cron_secret = os.getenv('CRON_SECRET')
    
    if not base_url:
        logger.error("BASE_URL environment variable is required")
        sys.exit(1)
    
    if not cron_secret:
        logger.error("CRON_SECRET environment variable is required")
        sys.exit(1)
    
    return {
        'base_url': base_url.rstrip('/'),
        'cron_secret': cron_secret,
        'timeout': int(os.getenv('REQUEST_TIMEOUT', '300'))  # 5 minutes default
    }

def fetch_sentiment_data(config):
    """Call the sentiment analysis endpoint"""
    url = f"{config['base_url']}/api/cron/sentiment-data"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f"Bearer {config['cron_secret']}"
    }
    
    logger.info(f"🤖 Starting sentiment data fetch from {url}")
    
    try:
        response = requests.post(
            url,
            headers=headers,
            json={},
            timeout=config['timeout']
        )
        
        logger.info(f"📡 Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            logger.info(f"✅ Sentiment data fetch successful!")
            logger.info(f"📊 Data points: {result.get('dataPoints', 'N/A')}")
            logger.info(f"📱 Top posts: {result.get('topPosts', 'N/A')}")
            logger.info(f"⏰ Timestamp: {result.get('timestamp', 'N/A')}")
            return True
        else:
            logger.error(f"❌ Request failed with status {response.status_code}")
            logger.error(f"Response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        logger.error(f"⏰ Request timed out after {config['timeout']} seconds")
        return False
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Request failed: {str(e)}")
        return False
    except json.JSONDecodeError as e:
        logger.error(f"❌ Failed to parse JSON response: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"❌ Unexpected error: {str(e)}")
        return False

def main():
    """Main function"""
    logger.info("=" * 60)
    logger.info("🕘 DAILY SENTIMENT ANALYSIS CRON JOB STARTED")
    logger.info(f"⏰ Current time: {datetime.now().isoformat()}")
    logger.info("=" * 60)
    
    try:
        # Load configuration
        config = load_config()
        logger.info(f"🔧 Configuration loaded - Base URL: {config['base_url']}")
        
        # Fetch sentiment data
        success = fetch_sentiment_data(config)
        
        if success:
            logger.info("✅ Sentiment analysis cron job completed successfully")
            logger.info("=" * 60)
            sys.exit(0)
        else:
            logger.error("❌ Sentiment analysis cron job failed")
            logger.info("=" * 60)
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"❌ Fatal error in cron job: {str(e)}")
        logger.info("=" * 60)
        sys.exit(1)

if __name__ == "__main__":
    main()
