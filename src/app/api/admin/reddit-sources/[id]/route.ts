import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    
    const { data, error } = await supabase
      .from('reddit_sources')
      .update(body)
      .eq('id', id)
      .select()

    if (error) {
      console.error('Error updating Reddit source:', error)
      return NextResponse.json({ error: 'Failed to update Reddit source' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Reddit source not found' }, { status: 404 })
    }

    return NextResponse.json(data[0])
  } catch (error) {
    console.error('Error in PATCH /api/admin/reddit-sources/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    
    const { error } = await supabase
      .from('reddit_sources')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting Reddit source:', error)
      return NextResponse.json({ error: 'Failed to delete Reddit source' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/admin/reddit-sources/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


