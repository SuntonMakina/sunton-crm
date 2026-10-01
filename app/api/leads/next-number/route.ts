import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const currYear = new Date().getFullYear()

    // 1. Try to find the max lead_number across all accessible leads
    const { data: leads, error } = await supabase
      .from('leads')
      .select('lead_number')
      .not('lead_number', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500)

    let maxSeq = 3213
    if (leads && leads.length > 0) {
      for (const l of leads) {
        if (l.lead_number) {
          const m = l.lead_number.match(/(\d+)$/)
          if (m) {
            const num = parseInt(m[1], 10)
            if (num > maxSeq) maxSeq = num
          }
        }
      }
    }

    let candidateSeq = maxSeq + 1
    let candidateNum = `LD-${currYear}-${String(candidateSeq).padStart(6, '0')}`

    // 2. Ensure candidate does not exist
    for (let i = 0; i < 50; i++) {
      const { data: exists } = await supabase
        .from('leads')
        .select('id')
        .eq('lead_number', candidateNum)
        .maybeSingle()

      if (!exists) {
        return NextResponse.json({ lead_number: candidateNum, seq: candidateSeq })
      }
      candidateSeq++
      candidateNum = `LD-${currYear}-${String(candidateSeq).padStart(6, '0')}`
    }

    return NextResponse.json({ lead_number: candidateNum, seq: candidateSeq })
  } catch (err: any) {
    const currYear = new Date().getFullYear()
    const randomSalt = Math.floor(1000 + Math.random() * 9000)
    const fallbackNum = `LD-${currYear}-${String(Date.now()).slice(-4)}${randomSalt.toString().slice(-2)}`
    return NextResponse.json({ lead_number: fallbackNum, fallback: true })
  }
}
