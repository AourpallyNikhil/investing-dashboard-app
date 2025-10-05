# Simple Local Cron Job for Sentiment Analysis

This directory contains a simple local cron job setup that runs the sentiment analysis at 9 AM every morning, replacing the complicated Supabase pg_cron or GitHub Actions setup.

## Quick Setup

1. **Install dependencies** (if not already installed):
   ```bash
   pip3 install requests
   ```

2. **Configure the cron job**:
   ```bash
   cd investing-dashboard/cron
   chmod +x setup_cron.sh
   ./setup_cron.sh
   ```

3. **Follow the prompts** to configure your `BASE_URL` and `CRON_SECRET`

That's it! The sentiment analysis will run automatically every morning at 9 AM.

## Manual Configuration

If you prefer to configure manually:

1. **Copy the config file**:
   ```bash
   cp config.env.example config.env
   ```

2. **Edit config.env** with your settings:
   ```bash
   # For local development
   BASE_URL=http://localhost:3000
   
   # For production
   BASE_URL=https://your-app.vercel.app
   
   # Generate a secure secret
   CRON_SECRET=$(openssl rand -base64 32)
   ```

3. **Test the script**:
   ```bash
   python3 sentiment_fetch.py
   ```

4. **Add to crontab**:
   ```bash
   crontab -e
   ```
   Add this line:
   ```
   # Daily sentiment analysis at 9 AM
   0 9 * * * cd /path/to/investing-dashboard/cron && python3 sentiment_fetch.py >> sentiment_cron.log 2>&1
   ```

## Files

- **`sentiment_fetch.py`** - Main Python script that calls the sentiment analysis endpoint
- **`setup_cron.sh`** - Automated setup script that configures everything
- **`config.env.example`** - Example configuration file
- **`config.env`** - Your actual configuration (created during setup)
- **`sentiment_cron.log`** - Log file with execution history

## Monitoring

- **View logs**: `tail -f sentiment_cron.log`
- **Test manually**: `python3 sentiment_fetch.py`
- **Check cron jobs**: `crontab -l`

## Environment Variables

The script needs these environment variables (set in `config.env`):

- **`BASE_URL`** - Your application URL (local or deployed)
- **`CRON_SECRET`** - Authentication secret for the cron endpoint
- **`REQUEST_TIMEOUT`** - Request timeout in seconds (default: 300)

## Troubleshooting

1. **Permission denied**: Make sure scripts are executable:
   ```bash
   chmod +x setup_cron.sh sentiment_fetch.py
   ```

2. **Python not found**: Install Python 3:
   ```bash
   # On macOS
   brew install python3
   
   # On Ubuntu/Debian
   sudo apt install python3 python3-pip
   ```

3. **Requests library missing**:
   ```bash
   pip3 install requests
   ```

4. **Cron job not running**: Check if cron service is running:
   ```bash
   # On macOS (should be running by default)
   sudo launchctl list | grep cron
   
   # On Linux
   sudo systemctl status cron
   ```

5. **Check logs** for detailed error messages:
   ```bash
   tail -f sentiment_cron.log
   ```

## Why This Approach?

This simple local cron job approach has several advantages over the complex Supabase pg_cron or GitHub Actions setup:

✅ **Simple**: No need to configure Supabase extensions or GitHub secrets  
✅ **Reliable**: Runs on your local machine with full control  
✅ **Easy to debug**: Clear logs and straightforward error handling  
✅ **Flexible**: Easy to modify timing or add additional logic  
✅ **No dependencies**: Doesn't rely on external services beyond your app  

The sentiment analysis will run every morning at 9 AM and fetch fresh data from Reddit and Twitter, analyzing it with LLM and storing it in your database.














