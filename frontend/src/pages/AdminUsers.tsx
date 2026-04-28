import { useQuery } from "@tanstack/react-query";
import { Users, Search, ChevronDown, ChevronUp, BookOpen, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiAdminUser } from "@/lib/api";
import { format } from "date-fns";
import { formatPrice } from "@/lib/utils";
import { Helmet } from "react-helmet-async";
import { Fragment, useState } from "react";

const AdminUsers = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: users, isLoading } = useQuery<ApiAdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: () => api.getAllUsers()
  });

  const filteredUsers = (() => {
    if (!users || users.length === 0) return [];
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.enrollments?.some((e: any) => e.course?.toLowerCase().includes(q)) ||
        u.progress?.some((p: any) => p.course?.toLowerCase().includes(q))
    );
  })();

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Users & Activity – LearnHub Admin</title>
      </Helmet>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6 text-secondary" />
              Users & Activity
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track all users and their enrollment and learning activity.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email or course..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="mt-6">
          {isLoading ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
              No users found.
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="w-12 px-4 py-3"></th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Enrollments</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => {
                      const isOpen = expandedIds.has(user._id);
                      return (
                        <Fragment key={user._id}>
                          <tr
                            className="border-b transition-colors hover:bg-muted/50 cursor-pointer"
                            onClick={() => toggleExpand(user._id)}
                          >
                            <td className="px-4 py-3">
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                {isOpen ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium">{user.name}</p>
                              <p className="text-muted-foreground">{user.email}</p>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {user.createdAt ? format(new Date(user.createdAt), "dd MMM yyyy") : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="secondary">{user.enrollmentsCount} courses</Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {user.progress?.length ?? 0} in progress
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="border-b bg-muted/30">
                              <td colSpan={5} className="px-4 py-4">
                                <div className="ml-12 grid gap-6 sm:grid-cols-2">
                                  <div>
                                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                                      <BookOpen className="h-4 w-4 text-secondary" /> Enrollments
                                    </h4>
                                    {user.enrollments && user.enrollments.length > 0 ? (
                                      <div className="space-y-2">
                                        {user.enrollments.map((e, i) => (
                                          <div key={i} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
                                            <span className="font-medium truncate mr-2">{e.course || "—"}</span>
                                            <span className="text-muted-foreground text-xs whitespace-nowrap">
                                              {formatPrice(e.price ?? 0)} · {e.enrolledAt ? format(new Date(e.enrolledAt), "dd MMM yyyy") : "—"}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">No enrollments yet.</p>
                                    )}
                                  </div>
                                  <div>
                                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                                      <Activity className="h-4 w-4 text-secondary" /> Progress
                                    </h4>
                                    {user.progress && user.progress.length > 0 ? (
                                      <div className="space-y-2">
                                        {user.progress.map((p, i) => (
                                          <div key={i} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
                                            <span className="font-medium truncate mr-2">{p.course || "—"}</span>
                                            <span className="text-muted-foreground text-xs whitespace-nowrap">
                                              {p.lessonsCompleted} lessons &middot;{" "}
                                              <span className={p.status === "completed" ? "text-success" : ""}>
                                                {p.status === "in_progress" ? "In Progress" : "Completed"}
                                              </span>
                                              {p.lastActivity && ` · ${format(new Date(p.lastActivity), "dd MMM")}`}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">No progress yet.</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {filteredUsers.length} of {users?.length ?? 0} users
        </p>
      </div>
    </div>
  );
};

export default AdminUsers;
