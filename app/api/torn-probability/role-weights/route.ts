export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const response = await fetch(
      'https://tornprobability.com:3000/api/GetRoleWeights',
      {
        method: 'GET',
        headers: {
          'Origin': 'https://www.torn.com',
          'Referer': 'https://www.torn.com/',
        },
      }
    )

    if (!response.ok) {
      console.error('[API] Role weights API responded with status:', response.status)
      return Response.json(
        { error: 'Failed to fetch role weights' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return Response.json(data)
  } catch (error) {
    console.error('[API] Error fetching role weights:', error)
    return Response.json(
      { error: 'Failed to fetch role weights' },
      { status: 500 }
    )
  }
}
