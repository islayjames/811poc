import type { ExpectedUtilityMember, TicketDetail } from './types'

// Common Texas utility providers by region
const TEXAS_UTILITY_PROVIDERS: Record<string, ExpectedUtilityMember[]> = {
  // Major metropolitan areas
  'harris': [
    { utility: 'CenterPoint Energy', category: 'gas', priority: 'high' },
    { utility: 'CenterPoint Energy', category: 'electric', priority: 'high' },
    { utility: 'AT&T', category: 'telecom', priority: 'medium' },
    { utility: 'Comcast', category: 'cable', priority: 'medium' },
    { utility: 'City of Houston Water', category: 'water', priority: 'high' },
    { utility: 'City of Houston Sewer', category: 'sewer', priority: 'medium' },
  ],
  'dallas': [
    { utility: 'Atmos Energy', category: 'gas', priority: 'high' },
    { utility: 'Oncor Electric', category: 'electric', priority: 'high' },
    { utility: 'AT&T', category: 'telecom', priority: 'medium' },
    { utility: 'Spectrum', category: 'cable', priority: 'medium' },
    { utility: 'Dallas Water Utilities', category: 'water', priority: 'high' },
    { utility: 'Dallas Water Utilities', category: 'sewer', priority: 'medium' },
  ],
  'tarrant': [
    { utility: 'Atmos Energy', category: 'gas', priority: 'high' },
    { utility: 'Oncor Electric', category: 'electric', priority: 'high' },
    { utility: 'AT&T', category: 'telecom', priority: 'medium' },
    { utility: 'Spectrum', category: 'cable', priority: 'medium' },
    { utility: 'City of Fort Worth Water', category: 'water', priority: 'high' },
  ],
  'travis': [
    { utility: 'Texas Gas Service', category: 'gas', priority: 'high' },
    { utility: 'Austin Energy', category: 'electric', priority: 'high' },
    { utility: 'AT&T', category: 'telecom', priority: 'medium' },
    { utility: 'Spectrum', category: 'cable', priority: 'medium' },
    { utility: 'Austin Water', category: 'water', priority: 'high' },
    { utility: 'Austin Water', category: 'sewer', priority: 'medium' },
  ],
  'bexar': [
    { utility: 'CPS Energy', category: 'gas', priority: 'high' },
    { utility: 'CPS Energy', category: 'electric', priority: 'high' },
    { utility: 'AT&T', category: 'telecom', priority: 'medium' },
    { utility: 'Spectrum', category: 'cable', priority: 'medium' },
    { utility: 'San Antonio Water System', category: 'water', priority: 'high' },
    { utility: 'San Antonio Water System', category: 'sewer', priority: 'medium' },
  ],
  'williamson': [
    { utility: 'Texas Gas Service', category: 'gas', priority: 'high' },
    { utility: 'Oncor Electric', category: 'electric', priority: 'high' },
    { utility: 'AT&T', category: 'telecom', priority: 'medium' },
    { utility: 'Spectrum', category: 'cable', priority: 'medium' },
    { utility: 'City of Round Rock Utilities', category: 'water', priority: 'high' },
  ],
  // Default fallback for other counties
  'default': [
    { utility: 'Texas Gas Service', category: 'gas', priority: 'high' },
    { utility: 'Local Electric Coop', category: 'electric', priority: 'high' },
    { utility: 'AT&T', category: 'telecom', priority: 'medium' },
    { utility: 'Local Cable Provider', category: 'cable', priority: 'low' },
    { utility: 'Local Water Department', category: 'water', priority: 'high' },
    { utility: 'Local Sewer Authority', category: 'sewer', priority: 'medium' },
  ]
}

/**
 * Gets expected utility members for a ticket based on location and work type
 */
export function getExpectedUtilityMembers(ticket: TicketDetail): ExpectedUtilityMember[] {
  // If ticket already has expected utility members, use those
  if (ticket.expected_utility_members && ticket.expected_utility_members.length > 0) {
    return ticket.expected_utility_members
  }

  const county = (ticket.site?.county || 'default').toLowerCase().replace(/\s+county$/i, '')
  const workType = (ticket.work?.type_of_work || '').toLowerCase()

  // Get base utility providers for the county
  let expectedMembers = TEXAS_UTILITY_PROVIDERS[county] || TEXAS_UTILITY_PROVIDERS['default']

  // Filter based on work type if needed
  if (workType.includes('gas') || workType.includes('natural gas')) {
    expectedMembers = expectedMembers.filter(m => m.category === 'gas' || m.category === 'electric')
  } else if (workType.includes('electric') || workType.includes('power')) {
    expectedMembers = expectedMembers.filter(m => m.category === 'electric')
  } else if (workType.includes('water') || workType.includes('sewer')) {
    expectedMembers = expectedMembers.filter(m => ['water', 'sewer'].includes(m.category))
  } else if (workType.includes('telecom') || workType.includes('phone') || workType.includes('fiber')) {
    expectedMembers = expectedMembers.filter(m => m.category === 'telecom')
  }

  // For major excavations, include all utilities
  if (workType.includes('major') ||
      workType.includes('foundation') ||
      workType.includes('building') ||
      ticket.work?.depth_inches && ticket.work.depth_inches > 48) {
    expectedMembers = TEXAS_UTILITY_PROVIDERS[county] || TEXAS_UTILITY_PROVIDERS['default']
  }

  return expectedMembers
}

/**
 * Combines actual responses with expected utility members to show complete response status
 */
export function getCombinedUtilityStatus(ticket: TicketDetail) {
  const expectedMembers = getExpectedUtilityMembers(ticket)
  const actualResponses = ticket.responses || []

  // Create a map of actual responses
  const responseMap = new Map(
    actualResponses.map(response => [response.utility, response])
  )

  // Combine expected members with actual responses
  const combinedStatus = expectedMembers.map(expected => {
    const actualResponse = responseMap.get(expected.utility)

    if (actualResponse) {
      return {
        ...actualResponse,
        expectedMember: expected,
        hasResponse: true
      }
    } else {
      return {
        utility: expected.utility,
        status: 'No Response' as const,
        notes: null,
        expectedMember: expected,
        hasResponse: false
      }
    }
  })

  // Add any additional responses that weren't expected
  actualResponses.forEach(response => {
    if (!expectedMembers.some(expected => expected.utility === response.utility)) {
      combinedStatus.push({
        ...response,
        expectedMember: { utility: response.utility, category: 'other' as const, priority: 'medium' as const },
        hasResponse: true
      })
    }
  })

  return combinedStatus
}

/**
 * Gets response statistics for display
 */
export function getResponseStats(ticket: TicketDetail) {
  const combinedStatus = getCombinedUtilityStatus(ticket)
  const totalExpected = combinedStatus.length
  const responseCount = combinedStatus.filter(item => item.hasResponse).length
  const pendingCount = totalExpected - responseCount

  return {
    total: totalExpected,
    responded: responseCount,
    pending: pendingCount,
    responseRate: totalExpected > 0 ? Math.round((responseCount / totalExpected) * 100) : 0
  }
}
