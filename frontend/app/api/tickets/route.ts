import { type NextRequest, NextResponse } from "next/server"
import { getMockTicketList } from "@/lib/mock-data"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const statuses = searchParams.getAll("status")
    const city = searchParams.get("city")
    const county = searchParams.get("county")
    const q = searchParams.get("q")
    const page = searchParams.get("page") ? Number.parseInt(searchParams.get("page")!) : 1
    const pageSize = searchParams.get("pageSize") ? Number.parseInt(searchParams.get("pageSize")!) : 25
    const sort = searchParams.get("sort") || "earliest_start"
    const dir = searchParams.get("dir") || "asc"

    // Convert page-based to offset-based for internal use
    const limit = pageSize
    const offset = (page - 1) * pageSize

    const data = getMockTicketList({
      statuses: statuses.length > 0 ? statuses : undefined,
      city: city || undefined,
      county: county || undefined,
      q: q || undefined,
      sort,
      dir,
      limit,
      offset,
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching tickets:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
