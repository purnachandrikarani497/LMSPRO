import { useQuery } from "@tanstack/react-query";
import { DollarSign, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ApiAdminEnrollment } from "@/lib/api";
import { format, startOfWeek, startOfMonth, startOfYear } from "date-fns";
import { Helmet } from "react-helmet-async";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const AdminCompletedPayments = () => {
  const { toast } = useToast();
  const [timeRange, setTimeRange] = useState<"week" | "month" | "year" | "all">("all");
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const { data: adminEnrollments, isLoading } = useQuery<ApiAdminEnrollment[]>({
    queryKey: ["admin-enrollments"],
    queryFn: () => api.getAllEnrollments()
  });

  const filteredEnrollments = (() => {
    if (!adminEnrollments || adminEnrollments.length === 0) return [];
    let list = adminEnrollments.filter((e) => !hiddenIds.has(e._id));
    if (timeRange === "all") return list;
    const now = new Date();
    const start =
      timeRange === "week" ? startOfWeek(now) :
      timeRange === "month" ? startOfMonth(now) :
      startOfYear(now);
    return list.filter((e) => new Date(e.createdAt) >= start);
  })();

  const downloadCSV = (rows: ApiAdminEnrollment[], filename: string) => {
    const header = ["Course", "Student", "Email", "Price", "EnrolledOn"].join(",");
    const data = rows.map((e) =>
      [
        (e.course?.title ?? "Deleted Course").replace(/,/g, " "),
        (e.student?.name ?? "Deleted Student").replace(/,/g, " "),
        (e.student?.email ?? "-").replace(/,/g, " "),
        String(e.course?.price ?? 0),
        format(new Date(e.createdAt), "dd MMM yyyy")
      ].join(",")
    );
    const csv = [header, ...data].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadReceipt = (enrollment: ApiAdminEnrollment) => {
    downloadCSV([enrollment], `receipt-${enrollment._id}`);
  };

  const handleRemoveFromView = (id: string) => {
    setHiddenIds((prev) => new Set(prev).add(id));
    toast({ title: "Removed", description: "Payment record removed from view" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Completed Payments – LearnHub Admin</title>
      </Helmet>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-secondary" />
              Completed Payments
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              All courses where enrollment and payment have been completed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => downloadCSV(filteredEnrollments, `payments-${timeRange}`)}
              disabled={filteredEnrollments.length === 0}
            >
              <Download className="h-4 w-4" /> Download CSV
            </Button>
          </div>
        </div>

        {isLoading && (
          <p className="mt-4 text-sm text-muted-foreground">Loading payment details...</p>
        )}
        {!isLoading && filteredEnrollments.length === 0 && (
          <p className="mt-8 text-center text-muted-foreground">No completed payments found yet.</p>
        )}

        {!isLoading && filteredEnrollments.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead className="hidden sm:table-cell">Student</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="hidden md:table-cell">Enrolled On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEnrollments.map((enrollment) => (
                  <TableRow key={enrollment._id}>
                    <TableCell className="text-sm font-medium text-card-foreground">
                      {enrollment.course?.title || "Deleted Course"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {enrollment.student?.name || "Deleted Student"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {enrollment.student?.email || "-"}
                    </TableCell>
                    <TableCell className="text-sm font-semibold">
                      ${enrollment.course?.price?.toFixed(2) ?? "0.00"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {format(new Date(enrollment.createdAt), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => downloadReceipt(enrollment)}
                        >
                          <Download className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleRemoveFromView(enrollment._id)}
                          title="Remove from view"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCompletedPayments;
