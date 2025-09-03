// ---------------------------
// MOCK DATA (synthetic only)
// ---------------------------

export type TicketStatus =
  | "Draft"
  | "ValidPendingConfirm"
  | "Ready"
  | "Submitted"
  | "ResponsesIn"
  | "ReadyToDig"
  | "Expiring"
  | "Expired"
  | "Cancelled"

export type TicketListItem = {
  id: string
  work_order_ref: string | null
  city: string
  county: string
  status: TicketStatus
  dates: { earliest_lawful_start: string | null; expires_at: string | null }
  gap_count: number
}

export type TicketDetail = {
  id: string
  status: TicketStatus
  ticket_type_hint: "Normal" | "Emergency" | "SurveyDesign"
  requested_at: string
  dates: {
    earliest_lawful_start: string | null
    positive_response_at: string | null
    expires_at: string | null
  }
  excavator: {
    company: string
    contact_name: string
    phone: string
    email: string | null
  }
  work: {
    work_for: string | null
    type_of_work: string
    is_trenchless: boolean
    is_blasting: boolean
    depth_inches: number | null
    duration_days: number | null
  }
  site: {
    county: string
    city: string
    address: string | null
    cross_street: string | null
    subdivision: string | null
    lot_block: string | null
    gps: { lat: number | null; lng: number | null }
    driving_directions: string | null
    marking_instructions: string | null
    remarks: string | null
    work_area_description: string
    site_marked_white: boolean
  }
  geom: {
    geometry_type: "Point" | "Polygon" | "LineBuffer"
    geojson: any | null
    confidence: number | null
    assumptions: string[] | null
    warnings: string[] | null
  }
  submit_packet: any
  responses: Array<{ utility: string; status: string; notes: string | null }>
  audit_log: Array<{ ts: string; actor: string; from: string | null; to: string; note: string | null }>
}

// helper to make a tiny bbox around a point
const box = (lng: number, lat: number, d = 0.00025) => ({
  type: "Polygon",
  coordinates: [
    [
      [lng - d, lat - d],
      [lng + d, lat - d],
      [lng + d, lat + d],
      [lng - d, lat + d],
      [lng - d, lat - d],
    ],
  ],
})

// ---------------------------
// LIST ITEMS
// ---------------------------
export const MOCK_TICKETS: TicketListItem[] = [
  {
    id: "00000000-0000-0000-0000-000000000101",
    work_order_ref: "WO-AX2001",
    city: "Round Rock",
    county: "Williamson",
    status: "ValidPendingConfirm",
    dates: { earliest_lawful_start: "2025-09-03T15:00:00Z", expires_at: null },
    gap_count: 1,
  },
  {
    id: "00000000-0000-0000-0000-000000000102",
    work_order_ref: "WO-AT3107",
    city: "Austin",
    county: "Travis",
    status: "Ready",
    dates: { earliest_lawful_start: "2025-09-02T14:00:00Z", expires_at: null },
    gap_count: 0,
  },
  {
    id: "00000000-0000-0000-0000-000000000103",
    work_order_ref: "WO-FW4412",
    city: "Fort Worth",
    county: "Tarrant",
    status: "Submitted",
    dates: { earliest_lawful_start: "2025-09-02T16:00:00Z", expires_at: null },
    gap_count: 0,
  },
  {
    id: "00000000-0000-0000-0000-000000000104",
    work_order_ref: "WO-CC5520",
    city: "Corpus Christi",
    county: "Nueces",
    status: "ResponsesIn",
    dates: { earliest_lawful_start: "2025-09-01T15:00:00Z", expires_at: "2025-09-12T00:00:00Z" },
    gap_count: 0,
  },
  {
    id: "00000000-0000-0000-0000-000000000105",
    work_order_ref: "WO-EP6618",
    city: "El Paso",
    county: "El Paso",
    status: "ReadyToDig",
    dates: { earliest_lawful_start: "2025-09-01T18:00:00Z", expires_at: "2025-09-15T00:00:00Z" },
    gap_count: 0,
  },
  {
    id: "00000000-0000-0000-0000-000000000106",
    work_order_ref: "WO-IR7710",
    city: "Irving",
    county: "Dallas",
    status: "Expiring",
    dates: { earliest_lawful_start: "2025-08-31T20:00:00Z", expires_at: "2025-09-02T00:00:00Z" },
    gap_count: 0,
  },
  {
    id: "00000000-0000-0000-0000-000000000107",
    work_order_ref: "WO-WA8811",
    city: "Waco",
    county: "McLennan",
    status: "Expired",
    dates: { earliest_lawful_start: "2025-08-29T15:00:00Z", expires_at: "2025-08-30T00:00:00Z" },
    gap_count: 0,
  },
  {
    id: "00000000-0000-0000-0000-000000000108",
    work_order_ref: "WO-AM9920",
    city: "Amarillo",
    county: "Potter",
    status: "Cancelled",
    dates: { earliest_lawful_start: null, expires_at: null },
    gap_count: 0,
  },
  {
    id: "00000000-0000-0000-0000-000000000109",
    work_order_ref: "WO-LB1003",
    city: "Lubbock",
    county: "Lubbock",
    status: "Draft",
    dates: { earliest_lawful_start: null, expires_at: null },
    gap_count: 4,
  },
  {
    id: "00000000-0000-0000-0000-000000000110",
    work_order_ref: "WO-SM1105",
    city: "San Marcos",
    county: "Hays",
    status: "Ready",
    dates: { earliest_lawful_start: "2025-09-02T13:30:00Z", expires_at: null },
    gap_count: 0,
  },
]

// ---------------------------
// DETAILS (first 8 tickets)
// ---------------------------
export const MOCK_TICKET_BY_ID: Record<string, TicketDetail> = {
  "00000000-0000-0000-0000-000000000101": {
    id: "00000000-0000-0000-0000-000000000101",
    status: "ValidPendingConfirm",
    ticket_type_hint: "Normal",
    requested_at: "2025-08-31T18:05:00Z",
    dates: {
      earliest_lawful_start: "2025-09-03T15:00:00Z",
      positive_response_at: null,
      expires_at: null,
    },
    excavator: {
      company: "Demo Utilities LLC",
      contact_name: "Alex Moreno",
      phone: "512-555-0199",
      email: "alex.moreno@demo-utilities.com",
    },
    work: {
      work_for: "City of Round Rock",
      type_of_work: "Replace utility pole and transfer service",
      is_trenchless: false,
      is_blasting: false,
      depth_inches: 36,
      duration_days: 2,
    },
    site: {
      county: "Williamson",
      city: "Round Rock",
      address: "1201 Heritage Center Cir",
      cross_street: "E Old Settlers Blvd",
      subdivision: null,
      lot_block: null,
      gps: { lat: 30.50828, lng: -97.6789 },
      driving_directions: "From E Old Settlers Blvd, north 150 ft on Heritage Center Cir; pole on east ROW.",
      marking_instructions: "Mark 75 ft along east ROW centered on pole; front easement only.",
      remarks: "Coordinate with city traffic control for lane closure",
      work_area_description: "Mark 75 ft along east ROW centered on pole; front easement only.",
      site_marked_white: true,
    },
    geom: {
      geometry_type: "Polygon",
      geojson: box(-97.6789, 30.50828),
      confidence: 0.88,
      assumptions: ["ROW width assumed 10–15 ft"],
      warnings: null,
    },
    submit_packet: {},
    responses: [],
    audit_log: [
      { ts: "2025-08-31T18:05:00Z", actor: "api", from: null, to: "Draft", note: "created" },
      {
        ts: "2025-08-31T18:06:00Z",
        actor: "api",
        from: "Draft",
        to: "ValidPendingConfirm",
        note: "validated with gaps",
      },
    ],
  },

  "00000000-0000-0000-0000-000000000102": {
    id: "00000000-0000-0000-0000-000000000102",
    status: "Ready",
    ticket_type_hint: "Normal",
    requested_at: "2025-08-31T17:35:00Z",
    dates: { earliest_lawful_start: "2025-09-02T14:00:00Z", positive_response_at: null, expires_at: null },
    excavator: {
      company: "Demo Utilities LLC",
      contact_name: "Kim Rivera",
      phone: "737-555-0132",
      email: "krivera@demo-utilities.com",
    },
    work: {
      work_for: "Neighborhood HOA",
      type_of_work: 'Bore 2" conduit under sidewalk',
      is_trenchless: true,
      is_blasting: false,
      depth_inches: 30,
      duration_days: 1,
    },
    site: {
      county: "Travis",
      city: "Austin",
      address: "6701 McNeil Dr",
      cross_street: "Pond Springs Rd",
      subdivision: "Milwood",
      lot_block: null,
      gps: { lat: 30.4271, lng: -97.7438 },
      driving_directions: null,
      marking_instructions: "Mark entry and exit points for bore; 5-foot radius around each point.",
      remarks: null,
      work_area_description: "Bore 60 ft crossing of sidewalk at McNeil Dr near Pond Springs Rd.",
      site_marked_white: true,
    },
    geom: {
      geometry_type: "Polygon",
      geojson: box(-97.7438, 30.4271),
      confidence: 0.9,
      assumptions: null,
      warnings: null,
    },
    submit_packet: {},
    responses: [],
    audit_log: [
      { ts: "2025-08-31T17:35:00Z", actor: "api", from: null, to: "Draft", note: null },
      { ts: "2025-08-31T17:45:00Z", actor: "user:pm", from: "ValidPendingConfirm", to: "Ready", note: "confirmed" },
    ],
  },

  "00000000-0000-0000-0000-000000000103": {
    id: "00000000-0000-0000-0000-000000000103",
    status: "Submitted",
    ticket_type_hint: "Normal",
    requested_at: "2025-08-31T16:20:00Z",
    dates: { earliest_lawful_start: "2025-09-02T16:00:00Z", positive_response_at: null, expires_at: null },
    excavator: {
      company: "Demo Utilities LLC",
      contact_name: "Jordan Lee",
      phone: "817-555-0177",
      email: "jlee@demo-utilities.com",
    },
    work: {
      work_for: "Private customer",
      type_of_work: "Trench 100 ft for service drop",
      is_trenchless: false,
      is_blasting: false,
      depth_inches: 24,
      duration_days: 1,
    },
    site: {
      county: "Tarrant",
      city: "Fort Worth",
      address: "3850 E Loop 820 S",
      cross_street: "Sun Valley Dr",
      subdivision: null,
      lot_block: null,
      gps: { lat: 32.6618, lng: -97.2694 },
      driving_directions: "From Sun Valley Dr, east on E Loop 820 S to property entrance",
      marking_instructions: "Mark 100 ft trench route along south property line from driveway to fence.",
      remarks: null,
      work_area_description: "Mark 100 ft along south property line from driveway east to fence corner.",
      site_marked_white: false,
    },
    geom: {
      geometry_type: "Polygon",
      geojson: box(-97.2694, 32.6618),
      confidence: 0.85,
      assumptions: null,
      warnings: null,
    },
    submit_packet: {},
    responses: [],
    audit_log: [
      { ts: "2025-08-31T16:20:00Z", actor: "api", from: null, to: "Draft", note: null },
      { ts: "2025-08-31T16:50:00Z", actor: "user:pm", from: "Ready", to: "Submitted", note: "manual submit" },
    ],
  },

  "00000000-0000-0000-0000-000000000104": {
    id: "00000000-0000-0000-0000-000000000104",
    status: "ResponsesIn",
    ticket_type_hint: "Normal",
    requested_at: "2025-08-30T15:10:00Z",
    dates: {
      earliest_lawful_start: "2025-09-01T15:00:00Z",
      positive_response_at: "2025-08-31T21:00:00Z",
      expires_at: "2025-09-12T00:00:00Z",
    },
    excavator: { company: "Demo Utilities LLC", contact_name: "Sam Patel", phone: "361-555-0144", email: null },
    work: {
      work_for: "Telecom carrier",
      type_of_work: "Set new pole; transfer telecom attachments",
      is_trenchless: false,
      is_blasting: false,
      depth_inches: 36,
      duration_days: 2,
    },
    site: {
      county: "Nueces",
      city: "Corpus Christi",
      address: "1525 Ayers St",
      cross_street: "S Staples St",
      subdivision: null,
      lot_block: null,
      gps: { lat: 27.7734, lng: -97.3982 },
      driving_directions: null,
      marking_instructions: "Mark 30 ft radius around pole; include guy wire anchors if present.",
      remarks: null,
      work_area_description: "Locate 30 ft radius around existing pole on east side of Ayers St.",
      site_marked_white: true,
    },
    geom: {
      geometry_type: "Point",
      geojson: { type: "Point", coordinates: [-97.3982, 27.7734] },
      confidence: 0.92,
      assumptions: null,
      warnings: null,
    },
    submit_packet: {},
    responses: [
      { utility: "GasCo", status: "Clear/No Conflict", notes: null },
      { utility: "ElectricCo", status: "Located – Facility Marked", notes: "east ROW" },
    ],
    audit_log: [
      { ts: "2025-08-30T15:10:00Z", actor: "api", from: null, to: "Draft", note: null },
      { ts: "2025-08-30T17:05:00Z", actor: "user:pm", from: "Submitted", to: "ResponsesIn", note: "all responses" },
    ],
  },

  "00000000-0000-0000-0000-000000000105": {
    id: "00000000-0000-0000-0000-000000000105",
    status: "ReadyToDig",
    ticket_type_hint: "Normal",
    requested_at: "2025-08-29T20:40:00Z",
    dates: {
      earliest_lawful_start: "2025-09-01T18:00:00Z",
      positive_response_at: "2025-08-31T18:30:00Z",
      expires_at: "2025-09-15T00:00:00Z",
    },
    excavator: {
      company: "Demo Utilities LLC",
      contact_name: "Tanya Gomez",
      phone: "915-555-0108",
      email: "tanya@demo-utilities.com",
    },
    work: {
      work_for: "City of El Paso",
      type_of_work: 'Bore 4" conduit under roadway',
      is_trenchless: true,
      is_blasting: false,
      depth_inches: 48,
      duration_days: 2,
    },
    site: {
      county: "El Paso",
      city: "El Paso",
      address: "700 S San Antonio St",
      cross_street: "E 7th Ave",
      subdivision: null,
      lot_block: null,
      gps: { lat: 31.7573, lng: -106.4827 },
      driving_directions: null,
      marking_instructions: "Mark bore path 60 ft wide crossing S San Antonio St; include entry/exit pits.",
      remarks: "Night work preferred to minimize traffic impact",
      work_area_description: "Bore crossing of S San Antonio St at 7th Ave; 60 ft wide swath.",
      site_marked_white: true,
    },
    geom: {
      geometry_type: "Polygon",
      geojson: box(-106.4827, 31.7573, 0.00035),
      confidence: 0.86,
      assumptions: ["swath width assumed"],
      warnings: null,
    },
    submit_packet: {},
    responses: [],
    audit_log: [
      { ts: "2025-08-29T20:40:00Z", actor: "api", from: null, to: "Draft", note: null },
      { ts: "2025-08-31T18:30:30Z", actor: "system", from: "ResponsesIn", to: "ReadyToDig", note: "computed expiry" },
    ],
  },

  "00000000-0000-0000-0000-000000000106": {
    id: "00000000-0000-0000-0000-000000000106",
    status: "Expiring",
    ticket_type_hint: "Normal",
    requested_at: "2025-08-27T13:00:00Z",
    dates: {
      earliest_lawful_start: "2025-08-29T13:00:00Z",
      positive_response_at: "2025-08-19T13:00:00Z",
      expires_at: "2025-09-02T00:00:00Z",
    },
    excavator: { company: "Demo Utilities LLC", contact_name: "Chris Li", phone: "214-555-0198", email: null },
    work: {
      work_for: "Municipal Water",
      type_of_work: "Valve box repair excavation",
      is_trenchless: false,
      is_blasting: false,
      depth_inches: 24,
      duration_days: 1,
    },
    site: {
      county: "Dallas",
      city: "Irving",
      address: "1200 E Shady Grove Rd",
      cross_street: "N Rogers Rd",
      subdivision: null,
      lot_block: null,
      gps: { lat: 32.8124, lng: -96.944 },
      driving_directions: "From N Rogers Rd intersection, south shoulder 200 ft past traffic light",
      marking_instructions: "Mark 30 ft radius around valve box; avoid traffic lanes if possible.",
      remarks: null,
      work_area_description: "Mark 30 ft radius centered on valve box on south shoulder.",
      site_marked_white: false,
    },
    geom: {
      geometry_type: "Polygon",
      geojson: box(-96.944, 32.8124),
      confidence: 0.84,
      assumptions: null,
      warnings: ["Expiring in ≤ 3 days"],
    },
    submit_packet: {},
    responses: [],
    audit_log: [],
  },

  "00000000-0000-0000-0000-000000000107": {
    id: "00000000-0000-0000-0000-000000000107",
    status: "Expired",
    ticket_type_hint: "Normal",
    requested_at: "2025-08-18T12:00:00Z",
    dates: {
      earliest_lawful_start: "2025-08-20T12:00:00Z",
      positive_response_at: "2025-08-16T12:00:00Z",
      expires_at: "2025-08-30T00:00:00Z",
    },
    excavator: { company: "Demo Utilities LLC", contact_name: "Nina Shah", phone: "254-555-0166", email: null },
    work: {
      work_for: "Private property",
      type_of_work: "Fence posts along rear line",
      is_trenchless: false,
      is_blasting: false,
      depth_inches: 24,
      duration_days: 1,
    },
    site: {
      county: "McLennan",
      city: "Waco",
      address: "2100 N 19th St",
      cross_street: "Jefferson Ave",
      subdivision: null,
      lot_block: null,
      gps: { lat: 31.5594, lng: -97.1479 },
      driving_directions: "From Jefferson Ave, north on N 19th St to second house on left",
      marking_instructions: "Mark fence post locations every 6-8 ft along 120 ft rear property line.",
      remarks: "Property owner will be present during work",
      work_area_description: "Mark rear property line—120 ft east-west; backyard only.",
      site_marked_white: true,
    },
    geom: {
      geometry_type: "Polygon",
      geojson: box(-97.1479, 31.5594),
      confidence: 0.83,
      assumptions: null,
      warnings: null,
    },
    submit_packet: {},
    responses: [],
    audit_log: [],
  },

  "00000000-0000-0000-0000-000000000108": {
    id: "00000000-0000-0000-0000-000000000108",
    status: "Cancelled",
    ticket_type_hint: "SurveyDesign",
    requested_at: "2025-08-20T10:30:00Z",
    dates: { earliest_lawful_start: null, positive_response_at: null, expires_at: null },
    excavator: { company: "Demo Utilities LLC", contact_name: "Omar Diaz", phone: "806-555-0121", email: null },
    work: {
      work_for: "Telecom survey",
      type_of_work: "Design locate—no excavation",
      is_trenchless: false,
      is_blasting: false,
      depth_inches: null,
      duration_days: null,
    },
    site: {
      county: "Potter",
      city: "Amarillo",
      address: "500 S Buchanan St",
      cross_street: "SE 5th Ave",
      subdivision: null,
      lot_block: null,
      gps: { lat: 35.2089, lng: -101.8345 },
      driving_directions: null,
      marking_instructions: null,
      remarks: null,
      work_area_description: "Design marks along frontage only.",
      site_marked_white: false,
    },
    geom: {
      geometry_type: "Point",
      geojson: { type: "Point", coordinates: [-101.8345, 35.2089] },
      confidence: 0.9,
      assumptions: null,
      warnings: null,
    },
    submit_packet: {},
    responses: [],
    audit_log: [
      { ts: "2025-08-21T12:00:00Z", actor: "user:pm", from: "Draft", to: "Cancelled", note: "scope cancelled" },
    ],
  },
}

// ---------------------------
// END MOCK DATA
// ---------------------------
