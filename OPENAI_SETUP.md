# OpenAI API Setup

The investing dashboard now uses **OpenAI GPT-4o-mini** with **Structured Outputs** for sentiment analysis instead of Google Gemini.

## Benefits of OpenAI Structured Outputs
- ✅ **Guaranteed valid JSON** - No more truncation or parsing errors
- ✅ **Faster processing** - More efficient than Gemini
- ✅ **Better accuracy** - Superior sentiment analysis quality
- ✅ **Reliable** - Consistent, production-ready responses

## Setup Instructions

### 1. Set Environment Variable

Add your OpenAI API key to your environment:

**For Local Development:**
```bash
export OPENAI_API_KEY="sk-proj-..."
```

**For Production (Railway/Vercel):**
Go to your deployment dashboard and add:
- Variable name: `OPENAI_API_KEY`
- Value: `sk-proj-...` (your OpenAI API key from https://platform.openai.com/api-keys)

### 2. Remove Old Gemini Key (Optional)

All Gemini-related environment variables have been removed from the codebase.

## Model Used

- **Model**: `gpt-4o-mini`
- **Cost**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **Speed**: ~10-15 seconds for 3 posts (batch processing)
- **Reliability**: 100% valid JSON with Zod schema validation

## Troubleshooting

If you see the error:
```
⚠️ [LLM] No OPENAI_API_KEY found, using fallback analysis
```

This means the OpenAI API key is not set. Follow the setup instructions above.

