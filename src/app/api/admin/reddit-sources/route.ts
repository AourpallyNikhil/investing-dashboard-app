import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  try {
    const supabase = getSupabaseClient()
    
    const { data, error } = await supabase
      .from('reddit_sources')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching Reddit sources:', error)
      return NextResponse.json({ error: 'Failed to fetch Reddit sources' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in GET /api/admin/reddit-sources:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subreddit, display_name, description } = body

    if (!subreddit) {
      return NextResponse.json({ error: 'Subreddit name is required' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    
    const { data, error } = await supabase
      .from('reddit_sources')
      .insert([{
        subreddit: subreddit.toLowerCase().replace(/^r\//, ''), // Remove r/ prefix if present
        display_name: display_name || subreddit,
        description: description || '',
        is_active: true
      }])
      .select()

    if (error) {
      console.error('Error creating Reddit source:', error)
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'Subreddit already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to create Reddit source' }, { status: 500 })
    }

    return NextResponse.json(data[0], { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/admin/reddit-sources:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
