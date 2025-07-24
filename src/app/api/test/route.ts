import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ 
    message: 'Server is working!', 
    timestamp: new Date().toISOString() 
  })
}
