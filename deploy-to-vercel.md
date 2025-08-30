# 🚀 Deploy to Vercel (Free)

## Quick Deployment Steps

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Deploy from your project directory
```bash
cd investing-dashboard
vercel --prod
```

### 3. Follow the prompts:
- **Set up and deploy**: Yes
- **Which scope**: Your personal account
- **Link to existing project**: No (create new)
- **Project name**: investing-dashboard (or your choice)
- **Directory**: ./ (current directory)
- **Override settings**: No (use defaults)

### 4. Set Environment Variables
After deployment, add your environment variables:

```bash
# Add all your environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add FINANCIAL_DATASETS_API_KEY
vercel env add GEMINI_API_KEY
vercel env add TWITTER_BEARER_TOKEN
vercel env add CRON_SECRET
```

Or do it via the Vercel dashboard:
1. Go to your project on vercel.com
2. Settings → Environment Variables
3. Add all variables from your `.env.local`

### 5. Redeploy with environment variables
```bash
vercel --prod
```

## Your App Will Be Available At:
`https://your-project-name.vercel.app`

## Cost: $0/month
- ✅ 100GB bandwidth
- ✅ Unlimited projects
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Perfect for Next.js

## Alternative: Use ngrok for Local Development

If you prefer to keep developing locally:

```bash
# Terminal 1: Start your app
npm run dev

# Terminal 2: Create public tunnel
ngrok http 3000
```

Use the ngrok URL in your Supabase cron job.

**Recommendation: Deploy to Vercel - it's free, reliable, and you can still develop locally and push updates easily.**

