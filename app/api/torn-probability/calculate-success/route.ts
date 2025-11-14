export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const response = await fetch(
      'https://tornprobability.com:3000/api/CalculateSuccess',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://www.torn.com',
          'Referer': 'https://www.torn.com/',
        },
        body: JSON.stringify(body),
      }
    )

    if (!response.ok) {
      console.error('[API] Calculate success API responded with status:', response.status)
      const errorText = await response.text()
      console.error('[API] Error body:', errorText)
      return Response.json(
        { error: 'Failed to calculate success' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return Response.json(data)
  } catch (error) {
    console.error('[API] Error calculating success:', error)
    return Response.json(
      { error: 'Failed to calculate success' },
      { status: 500 }
    )
  }
}
