import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { TicketDetail, ResponseStatus } from "@/lib/types"
import { CheckCircleIcon } from "lucide-react"

interface ResponsesTableProps {
  responses: TicketDetail["responses"]
}

const getResponseStatusColor = (status: ResponseStatus): string => {
  switch (status) {
    case "Located":
      return "bg-green-100 text-green-800 border-green-200"
    case "Clear":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "InConflict":
      return "bg-red-100 text-red-800 border-red-200"
    case "Delayed":
      return "bg-amber-100 text-amber-800 border-amber-200"
    case "CannotLocate":
      return "bg-gray-100 text-gray-800 border-gray-200"
    case "LocatedToMeter":
      return "bg-purple-100 text-purple-800 border-purple-200"
    case "Cancelled":
      return "bg-slate-100 text-slate-800 border-slate-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

export function ResponsesTable({ responses }: ResponsesTableProps) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base font-semibold flex items-center space-x-2">
          <CheckCircleIcon className="h-4 w-4" />
          <span>Utility Responses</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {responses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No utility responses yet</p>
        ) : (
          <div className="max-h-[50vh] overflow-auto">
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Utility</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responses.map((response, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-sm font-medium py-2">{response.utility}</TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className={`text-xs ${getResponseStatusColor(response.status)}`}>
                          {response.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        {response.notes ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm cursor-help truncate block max-w-[120px]">{response.notes}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{response.notes}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TooltipProvider>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
