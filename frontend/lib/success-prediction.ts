export const SUPPORTED_SCENARIOS = [
  'Break the Bank',
  'Blast from the Past',
  'Honey Trap',
  'Leave No Trace',
  'Snow Blind',
  'Cash Me if You Can',
  'Stage Fright',
  'Smoke and Wing Mirrors',
  'Mob Mentality',
  'Pet Project',
  'Best of the Lot',
  'Market Forces',
  'Stacking the Deck',
  'Ace in the Hole',
  'No Reserve',
  'Bidding War',
  'Counter Offer',
  'Gaslight the Way',
  'Clinical Precision',
  'Guardian Ángels',
  'Sneaky Git Grab',
]

export interface SuccessPrediction {
  successChance: number
  supported: boolean
}

export async function getSuccessPrediction(
  scenario: string,
  parameters: number[]
): Promise<SuccessPrediction> {
  try {
    const response = await fetch('https://tornproxy.abhinavkm.com/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scenario,
        parameters,
      }),
    })

    const data = await response.json()

    if (data.error) {
      return { successChance: 0, supported: false }
    }

    return {
      successChance: data.successChance * 100,
      supported: true,
    }
  } catch (error) {
    console.error('[v0] Error fetching success prediction:', error)
    return { successChance: 0, supported: false }
  }
}
