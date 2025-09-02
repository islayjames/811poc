import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Clock } from "lucide-react"

export function TicketsTableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[120px]">ID</TableHead>
          <TableHead className="w-[120px]">WO Ref</TableHead>
          <TableHead className="w-[120px]">City</TableHead>
          <TableHead className="w-[120px]">County</TableHead>
          <TableHead className="w-[140px]">Status</TableHead>
          <TableHead className="w-[140px]">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Earliest Start
            </div>
          </TableHead>
          <TableHead className="w-[140px]">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Expires
            </div>
          </TableHead>
          <TableHead className="w-[80px]">Gaps</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <Skeleton className="h-4 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-6 w-24 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-5 rounded-full" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
