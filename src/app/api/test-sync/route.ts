import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: 'Test sync endpoint',
    instructions: 'Click the button below to test the sync'
  });
}

export async function POST() {
  try {
    console.log('🧪 Testing sync API call...');
    
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/admin/boxhero-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'full-sync',
        dryRun: true,
        updateExisting: true,
        addNew: true,
        syncStock: true
      })
    });
    
    const data = await response.json();
    
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      data: data
    });
    
  } catch (error) {
    console.error('❌ Test sync failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
