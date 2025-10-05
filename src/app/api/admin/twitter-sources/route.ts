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
      .from('twitter_sources')
      .select('*')
      .order('follower_count', { ascending: false })

    if (error) {
      console.error('Error fetching Twitter sources:', error)
      return NextResponse.json({ error: 'Failed to fetch Twitter sources' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in GET /api/admin/twitter-sources:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, display_name, description, follower_count } = body

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    
    const { data, error } = await supabase
      .from('twitter_sources')
      .insert([{
        username: username.toLowerCase().replace(/^@/, ''), // Remove @ prefix if present
        display_name: display_name || username,
        description: description || '',
        follower_count: follower_count || 0,
        is_active: true
      }])
      .select()

    if (error) {
      console.error('Error creating Twitter source:', error)
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'Twitter account already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to create Twitter source' }, { status: 500 })
    }

    return NextResponse.json(data[0], { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/admin/twitter-sources:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
