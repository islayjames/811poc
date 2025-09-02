import type { TicketListResponse, TicketDetailResponse } from "./types"

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
    anticipated_completion_at: string | null
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
    work_area_description: string
    site_marked_white: boolean
    remarks: string | null
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
      anticipated_completion_at: "2025-09-05T17:00:00Z",
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
      work_area_description: "Mark 75 ft along east ROW centered on pole; front easement only.",
      site_marked_white: true,
      remarks: "Coordinate with city traffic control for lane closure",
    },
    geom: {
      geometry_type: "Polygon",
      geojson: box(-97.6789, 30.50828),
      confidence: 0.88,
      assumptions: ["ROW width assumed 10–15 ft"],
      warnings: null,
    },
    submit_packet: {
      ticket_type: "Normal",
      caller_excavator: {
        company: "Demo Utilities LLC",
        contact_name: "Alex Moreno",
        phone: "512-555-0199",
        email: "alex.moreno@demo-utilities.com",
        onsite_contact_name: "Maria Santos",
        onsite_contact_phone: "512-555-0201",
        onsite_contact_best_time: "8:00 AM - 4:00 PM",
      },
      work: {
        work_for: "City of Round Rock",
        type_of_work: "Replace utility pole and transfer service",
        is_trenchless: false,
        is_blasting: false,
        depth_inches: 36,
        duration_days: 2,
        anticipated_completion_at: "2025-09-05T17:00:00Z",
      },
      location: {
        county: "Williamson",
        city: "Round Rock",
        address: "1201 Heritage Center Cir",
        cross_street: "E Old Settlers Blvd",
        gps: { lat: 30.50828, lng: -97.6789 },
        driving_directions: "From E Old Settlers Blvd, north 150 ft on Heritage Center Cir; pole on east ROW.",
        marking_instructions: "Mark 75 ft along east ROW centered on pole; front easement only.",
        work_area_description: "Mark 75 ft along east ROW centered on pole; front easement only.",
        remarks: "Coordinate with city traffic control for lane closure",
      },
      map_description: {
        geometry_type: "Polygon",
        confidence: 0.88,
        site_marked_white: true,
      },
      dates: {
        requested_at: "2025-08-31T18:05:00Z",
        earliest_lawful_start: "2025-09-03T15:00:00Z",
        expires_at: null,
      },
    },
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
    submit_packet: {
      ticket_type: "Normal",
      caller_excavator: {
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
      location: {
        county: "Travis",
        city: "Austin",
        address: "6701 McNeil Dr",
        cross_street: "Pond Springs Rd",
        gps: { lat: 30.4271, lng: -97.7438 },
        marking_instructions: "Mark entry and exit points for bore; 5-foot radius around each point.",
        work_area_description: "Bore 60 ft crossing of sidewalk at McNeil Dr near Pond Springs Rd.",
      },
      map_description: {
        geometry_type: "Polygon",
        confidence: 0.9,
        site_marked_white: true,
      },
      dates: {
        requested_at: "2025-08-31T17:35:00Z",
        earliest_lawful_start: "2025-09-02T14:00:00Z",
        expires_at: null,
      },
    },
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
    submit_packet: {
      ticket_type: "Normal",
      caller_excavator: {
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
      location: {
        county: "Tarrant",
        city: "Fort Worth",
        address: "3850 E Loop 820 S",
        cross_street: "Sun Valley Dr",
        gps: { lat: 32.6618, lng: -97.2694 },
        driving_directions: "From Sun Valley Dr, east on E Loop 820 S to property entrance",
        marking_instructions: "Mark 100 ft trench route along south property line from driveway to fence.",
        work_area_description: "Mark 100 ft along south property line from driveway east to fence corner.",
      },
      map_description: {
        geometry_type: "Polygon",
        confidence: 0.85,
        site_marked_white: false,
      },
      dates: {
        requested_at: "2025-08-31T16:20:00Z",
        earliest_lawful_start: "2025-09-02T16:00:00Z",
        expires_at: null,
      },
    },
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
    submit_packet: {
      ticket_type: "Normal",
      caller_excavator: {
        company: "Demo Utilities LLC",
        contact_name: "Sam Patel",
        phone: "361-555-0144",
        email: null,
      },
      work: {
        work_for: "Telecom carrier",
        type_of_work: "Set new pole; transfer telecom attachments",
        is_trenchless: false,
        is_blasting: false,
        depth_inches: 36,
        duration_days: 2,
      },
      location: {
        county: "Nueces",
        city: "Corpus Christi",
        address: "1525 Ayers St",
        cross_street: "S Staples St",
        gps: { lat: 27.7734, lng: -97.3982 },
        marking_instructions: "Mark 30 ft radius around pole; include guy wire anchors if present.",
        work_area_description: "Locate 30 ft radius around existing pole on east side of Ayers St.",
      },
      map_description: {
        geometry_type: "Point",
        confidence: 0.92,
        site_marked_white: true,
      },
      dates: {
        requested_at: "2025-08-30T15:10:00Z",
        earliest_lawful_start: "2025-09-01T15:00:00Z",
        expires_at: "2025-09-12T00:00:00Z",
      },
    },
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
      anticipated_completion_at: "2025-09-03T18:00:00Z",
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
      work_area_description: "Bore crossing of S San Antonio St at 7th Ave; 60 ft wide swath.",
      site_marked_white: true,
      remarks: "Night work preferred to minimize traffic impact",
    },
    geom: {
      geometry_type: "Polygon",
      geojson: box(-106.4827, 31.7573, 0.00035),
      confidence: 0.86,
      assumptions: ["swath width assumed"],
      warnings: null,
    },
    submit_packet: {
      ticket_type: "Normal",
      caller_excavator: {
        company: "Demo Utilities LLC",
        contact_name: "Tanya Gomez",
        phone: "915-555-0108",
        email: "tanya@demo-utilities.com",
        onsite_contact_name: "Carlos Rodriguez",
        onsite_contact_phone: "915-555-0109",
        onsite_contact_best_time: "7:00 AM - 3:00 PM",
      },
      work: {
        work_for: "City of El Paso",
        type_of_work: 'Bore 4" conduit under roadway',
        is_trenchless: true,
        is_blasting: false,
        depth_inches: 48,
        anticipated_completion_at: "2025-09-03T18:00:00Z",
      },
      location: {
        county: "El Paso",
        city: "El Paso",
        address: "700 S San Antonio St",
        cross_street: "E 7th Ave",
        gps: { lat: 31.7573, lng: -106.4827 },
        marking_instructions: "Mark bore path 60 ft wide crossing S San Antonio St; include entry/exit pits.",
        work_area_description: "Bore crossing of S San Antonio St at 7th Ave; 60 ft wide swath.",
        remarks: "Night work preferred to minimize traffic impact",
      },
      map_description: {
        geometry_type: "Polygon",
        confidence: 0.86,
        site_marked_white: true,
      },
      dates: {
        requested_at: "2025-08-29T20:40:00Z",
        earliest_lawful_start: "2025-09-01T18:00:00Z",
        expires_at: "2025-09-15T00:00:00Z",
      },
    },
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
      work_area_description: "Mark 30 ft radius centered on valve box on south shoulder.",
      site_marked_white: true,
    },
    geom: {
      geometry_type: "Polygon",
      geojson: box(-96.944, 32.8124),
      confidence: 0.84,
      assumptions: null,
      warnings: ["Expiring in ≤ 3 days"],
    },
    submit_packet: {
      ticket_type: "Normal",
      caller_excavator: {
        company: "Demo Utilities LLC",
        contact_name: "Chris Li",
        phone: "214-555-0198",
        email: null,
      },
      work: {
        work_for: "Municipal Water",
        type_of_work: "Valve box repair excavation",
        is_trenchless: false,
        is_blasting: false,
        depth_inches: 24,
        duration_days: 1,
      },
      location: {
        county: "Dallas",
        city: "Irving",
        address: "1200 E Shady Grove Rd",
        cross_street: "N Rogers Rd",
        gps: { lat: 32.8124, lng: -96.944 },
        driving_directions: "From N Rogers Rd intersection, south shoulder 200 ft past traffic light",
        work_area_description: "Mark 30 ft radius centered on valve box on south shoulder.",
      },
      map_description: {
        geometry_type: "Polygon",
        confidence: 0.84,
        site_marked_white: true,
      },
      dates: {
        requested_at: "2025-08-27T13:00:00Z",
        earliest_lawful_start: "2025-08-29T13:00:00Z",
        expires_at: "2025-09-02T00:00:00Z",
      },
    },
    responses: [],
    audit_log: [
      { ts: "2025-08-27T13:00:00Z", actor: "api", from: null, to: "Draft", note: "ticket created" },
      {
        ts: "2025-08-27T14:30:00Z",
        actor: "user:pm",
        from: "ValidPendingConfirm",
        to: "Ready",
        note: "confirmed by project manager",
      },
      {
        ts: "2025-08-28T09:15:00Z",
        actor: "system",
        from: "ResponsesIn",
        to: "Expiring",
        note: "auto-flagged as expiring soon",
      },
    ],
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
      work_area_description: "Mark rear property line—120 ft east-west; backyard only.",
      site_marked_white: true,
      remarks: "Property owner will be present during work",
    },
    geom: {
      geometry_type: "Polygon",
      geojson: box(-97.1479, 31.5594),
      confidence: 0.83,
      assumptions: null,
      warnings: null,
    },
    submit_packet: {
      ticket_type: "Normal",
      caller_excavator: {
        company: "Demo Utilities LLC",
        contact_name: "Nina Shah",
        phone: "254-555-0166",
        email: null,
        onsite_contact_name: "Roberto Martinez",
        onsite_contact_phone: "254-555-0167",
        onsite_contact_best_time: "9:00 AM - 5:00 PM",
      },
      work: {
        work_for: "Private property",
        type_of_work: "Fence posts along rear line",
        is_trenchless: false,
        is_blasting: false,
        depth_inches: 24,
        duration_days: 1,
      },
      location: {
        county: "McLennan",
        city: "Waco",
        address: "2100 N 19th St",
        cross_street: "Jefferson Ave",
        gps: { lat: 31.5594, lng: -97.1479 },
        driving_directions: "From Jefferson Ave, north on N 19th St to second house on left",
        work_area_description: "Mark rear property line—120 ft east-west; backyard only.",
        remarks: "Property owner will be present during work",
      },
      map_description: {
        geometry_type: "Polygon",
        confidence: 0.83,
        site_marked_white: true,
      },
      dates: {
        requested_at: "2025-08-18T12:00:00Z",
        earliest_lawful_start: "2025-08-20T12:00:00Z",
        expires_at: "2025-08-30T00:00:00Z",
      },
    },
    responses: [],
    audit_log: [],
  },
}

function convertToApiFormat(mockTicket: TicketListItem) {
  return {
    id: mockTicket.id,
    workOrderReference: mockTicket.work_order_ref,
    city: mockTicket.city,
    county: mockTicket.county,
    status: mockTicket.status,
    earliestStart: mockTicket.dates.earliest_lawful_start,
    expires: mockTicket.dates.expires_at,
    gapCount: mockTicket.gap_count,
    ticketType: "Normal" as const,
    caller: {
      name: "Demo User",
      company: "Demo Utilities LLC",
      phone: "555-0123",
      email: "demo@example.com",
    },
    excavator: {
      name: "Demo User",
      company: "Demo Utilities LLC",
      phone: "555-0123",
      email: "demo@example.com",
    },
    work: {
      type: "Utility work",
      description: "Standard utility work",
      explosives: false,
      boring: false,
      workingFor: "Demo Company",
    },
    location: {
      address: "Demo Address",
      nearestIntersection: "Demo Intersection",
      subdivision: "Demo Subdivision",
      lotBlock: "Demo Lot",
      directions: "Demo directions",
    },
    geometry: null,
    gpsCoordinates: [],
    dates: {
      created: "2025-08-31T12:00:00Z",
      earliestStart: mockTicket.dates.earliest_lawful_start,
      expires: mockTicket.dates.expires_at,
      lastModified: "2025-08-31T12:00:00Z",
    },
    auditHistory: [],
    positiveResponses: [],
  }
}

function convertDetailToApiFormat(mockDetail: TicketDetail) {
  return {
    id: mockDetail.id,
    workOrderReference: `WO-${mockDetail.id.slice(-6)}`,
    city: mockDetail.site.city,
    county: mockDetail.site.county,
    status: mockDetail.status,
    earliestStart: mockDetail.dates.earliest_lawful_start,
    expires: mockDetail.dates.expires_at,
    gapCount: 0,
    ticketType: mockDetail.ticket_type_hint,
    caller: {
      name: mockDetail.excavator.contact_name,
      company: mockDetail.excavator.company,
      phone: mockDetail.excavator.phone,
      email: mockDetail.excavator.email || "demo@example.com",
    },
    excavator: {
      name: mockDetail.excavator.contact_name,
      company: mockDetail.excavator.company,
      phone: mockDetail.excavator.phone,
      email: mockDetail.excavator.email || "demo@example.com",
    },
    work: {
      type: mockDetail.work.type_of_work,
      description: mockDetail.work.type_of_work,
      explosives: mockDetail.work.is_blasting,
      boring: mockDetail.work.is_trenchless,
      workingFor: mockDetail.work.work_for || "Demo Company",
    },
    location: {
      address: mockDetail.site.address || "Demo Address",
      nearestIntersection: mockDetail.site.cross_street || "Demo Intersection",
      subdivision: mockDetail.site.subdivision || "Demo Subdivision",
      lotBlock: mockDetail.site.lot_block || "Demo Lot",
      directions: mockDetail.site.driving_directions || mockDetail.site.work_area_description,
    },
    geometry: mockDetail.geom.geojson,
    gpsCoordinates:
      mockDetail.site.gps.lat && mockDetail.site.gps.lng
        ? [
            {
              latitude: mockDetail.site.gps.lat,
              longitude: mockDetail.site.gps.lng,
              radius: 25,
            },
          ]
        : [],
    dates: {
      created: mockDetail.requested_at,
      earliestStart: mockDetail.dates.earliest_lawful_start,
      expires: mockDetail.dates.expires_at,
      lastModified: mockDetail.requested_at,
    },
    auditHistory: mockDetail.audit_log.map((log) => ({
      timestamp: log.ts,
      action: `Status changed to ${log.to}`,
      user: log.actor,
      details: log.note || "",
    })),
    positiveResponses: mockDetail.responses.map((response) => ({
      utility: response.utility,
      responseDate: new Date().toISOString(),
      contact: "Demo Contact",
      phone: "555-0123",
      notes: response.notes || response.status,
    })),
    submit_packet: mockDetail.submit_packet || {},
  }
}

export function getMockTicketList(params: {
  statuses?: string[]
  city?: string
  county?: string
  q?: string
  sort?: string
  dir?: string
  limit?: number
  offset?: number
}): TicketListResponse {
  let filteredTickets = MOCK_TICKETS.map(convertToApiFormat)

  // Apply filters
  if (params.statuses && params.statuses.length > 0) {
    filteredTickets = filteredTickets.filter((ticket) => params.statuses!.includes(ticket.status))
  }

  if (params.city) {
    filteredTickets = filteredTickets.filter((ticket) => ticket.city.toLowerCase().includes(params.city!.toLowerCase()))
  }

  if (params.county) {
    filteredTickets = filteredTickets.filter((ticket) =>
      ticket.county.toLowerCase().includes(params.county!.toLowerCase()),
    )
  }

  if (params.q) {
    const query = params.q.toLowerCase()
    filteredTickets = filteredTickets.filter(
      (ticket) =>
        ticket.id.toLowerCase().includes(query) ||
        ticket.workOrderReference?.toLowerCase().includes(query) ||
        ticket.city.toLowerCase().includes(query) ||
        ticket.county.toLowerCase().includes(query) ||
        ticket.work.description.toLowerCase().includes(query),
    )
  }

  if (params.sort) {
    filteredTickets.sort((a, b) => {
      let aValue: any, bValue: any

      switch (params.sort) {
        case "earliest_start":
          aValue = a.dates.earliestStart
          bValue = b.dates.earliestStart
          break
        case "expires":
          aValue = a.dates.expires
          bValue = b.dates.expires
          break
        case "status":
          aValue = a.status
          bValue = b.status
          break
        default:
          return 0
      }

      if (aValue === null && bValue === null) return 0
      if (aValue === null) return params.dir === "asc" ? 1 : -1
      if (bValue === null) return params.dir === "asc" ? -1 : 1

      if (params.sort === "status") {
        return params.dir === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
      }

      const dateA = new Date(aValue).getTime()
      const dateB = new Date(bValue).getTime()
      return params.dir === "asc" ? dateA - dateB : dateB - dateA
    })
  }

  // Apply pagination
  const limit = params.limit || 10
  const offset = params.offset || 0
  const paginatedTickets = filteredTickets.slice(offset, offset + limit)

  return {
    tickets: paginatedTickets,
    total: filteredTickets.length,
    limit,
    offset,
  }
}

export function getMockTicketDetail(id: string): TicketDetailResponse | null {
  const mockDetail = MOCK_TICKET_BY_ID[id]
  if (!mockDetail) return null

  const ticket = convertDetailToApiFormat(mockDetail)
  return { ticket }
}
