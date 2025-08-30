# 🔄 Alternative Cron Solutions

Since pg_cron tables aren't initialized in your Supabase instance, here are alternative approaches:

## Option 1: GitHub Actions (Recommended Alternative)

Create `.github/workflows/daily-sentiment.yml`:

```yaml
name: Daily Sentiment Data Collection

on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM UTC
  workflow_dispatch:     # Allow manual trigger

jobs:
  fetch-sentiment-data:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Sentiment Data Collection
        run: |
          curl -X POST \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            "${{ secrets.VERCEL_APP_URL }}/api/cron/sentiment-data"
```

**Setup:**
1. Go to your GitHub repo settings → Secrets
2. Add:
   - `CRON_SECRET`: A secure random string
   - `VERCEL_APP_URL`: Your Vercel app URL
3. Add the same `CRON_SECRET` to your Vercel environment variables

## Option 2: Vercel Cron (If on Pro Plan)

Create `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/sentiment-data",
      "schedule": "0 6 * * *"
    }
  ]
}
```

**Note:** Vercel Cron requires a Pro plan ($20/month)

## Option 3: External Cron Service

Use a service like **cron-job.org** or **EasyCron**:

1. **URL**: `https://your-app.vercel.app/api/cron/sentiment-data`
2. **Method**: POST
3. **Headers**: `Authorization: Bearer your-cron-secret`
4. **Schedule**: Daily at 6 AM UTC (`0 6 * * *`)

## Option 4: Enable pg_cron via Supabase Support

1. **Contact Supabase Support**: https://supabase.com/dashboard/support
2. **Request**: "Please enable and initialize pg_cron for project yfqdtjwgvsixnhyseqbi"
3. **Mention**: You need the `cron.job` table and `cron.schedule()` function

## Recommendation

**For immediate setup**: Use **GitHub Actions** (Option 1)
- ✅ Free
- ✅ Reliable
- ✅ Easy to set up
- ✅ Can be manually triggered for testing

**For long-term**: Get pg_cron properly enabled via Supabase support

## Testing the Endpoint

You can manually test the cron endpoint right now:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-cron-secret" \
  "https://your-app.vercel.app/api/cron/sentiment-data"
```

This will trigger the data collection immediately and populate your database tables.

Which option would you prefer to implement?

