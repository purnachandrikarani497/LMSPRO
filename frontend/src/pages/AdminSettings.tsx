import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Globe, CreditCard, Mail, Shield, Check, X, FolderOpen, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { api, ApiSettings, ApiCategory } from "@/lib/api";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const SettingRow = ({
  icon: Icon,
  label,
  value,
  status
}: {
  icon: typeof Globe;
  label: string;
  value?: string | null;
  status?: "ok" | "warning" | null;
}) => (
  <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/15">
        <Icon className="h-5 w-5 text-secondary" />
      </div>
      <div>
        <p className="font-medium">{label}</p>
        {value && <p className="text-sm text-muted-foreground">{value}</p>}
      </div>
    </div>
    {status != null && (
      <div className="flex items-center gap-2">
        {status === "ok" ? (
          <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-1 text-xs font-medium text-success">
            <Check className="h-3 w-3" /> Configured
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
            <X className="h-3 w-3" /> Not configured
          </span>
        )}
      </div>
    )}
  </div>
);

const AdminSettings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ApiCategory | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("");

  const { data: settings, isLoading } = useQuery<ApiSettings>({
    queryKey: ["admin-settings"],
    queryFn: () => api.getSettings()
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<ApiCategory[]>({
    queryKey: ["categories"],
    queryFn: () => api.getCategories()
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; icon?: string }) => api.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Category created", description: "The category has been added." });
      setCategoryDialogOpen(false);
      setCategoryName("");
      setCategoryIcon("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create category", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; icon?: string } }) =>
      api.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Category updated", description: "The category has been saved." });
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryName("");
      setCategoryIcon("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update category", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Category deleted", description: "The category has been removed. Courses using it now show 'General'." });
      setCategoryDialogOpen(false);
      setEditingCategory(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete category", description: err.message, variant: "destructive" });
    },
  });

  const seedMutation = useMutation({
    mutationFn: () => api.seedCategories(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Default categories loaded", description: data.created?.length ? `${data.created.length} categories added.` : "All default categories already exist." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to load defaults", description: err.message, variant: "destructive" });
    },
  });

  const openAddDialog = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryIcon("");
    setCategoryDialogOpen(true);
  };

  const openEditDialog = (cat: ApiCategory) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryIcon(cat.icon || "");
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = () => {
    const name = categoryName.trim();
    if (!name) {
      toast({ title: "Name required", description: "Please enter a category name.", variant: "destructive" });
      return;
    }
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory._id, data: { name, icon: categoryIcon.trim() || undefined } });
    } else {
      createMutation.mutate({ name, icon: categoryIcon.trim() || undefined });
    }
  };

  const handleDeleteCategory = () => {
    if (!editingCategory) return;
    if (!window.confirm(`Delete "${editingCategory.name}"? Courses using this category will be set to "General".`)) return;
    deleteMutation.mutate(editingCategory._id);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Settings – LearnHub Admin</title>
      </Helmet>
      <div className="container mx-auto px-4 py-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-6 w-6 text-secondary" />
            Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage platform configuration.
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {isLoading ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
              Loading settings...
            </div>
          ) : (
            <>
              <section>
                <h2 className="mb-4 text-lg font-semibold">General</h2>
                <div className="space-y-3">
                  <SettingRow
                    icon={Globe}
                    label="Client URL"
                    value={settings?.clientUrl || "—"}
                  />
                </div>
              </section>

              <section>
                <h2 className="mb-4 text-lg font-semibold">Admin Account</h2>
                <div className="space-y-3">
                  <SettingRow
                    icon={Shield}
                    label="Admin email"
                    value={settings?.adminEmail || "—"}
                  />
                </div>
              </section>

              <section>
                <h2 className="mb-4 text-lg font-semibold">Integrations</h2>
                <div className="space-y-3">
                  <SettingRow
                    icon={CreditCard}
                    label="Razorpay payments"
                    status={settings?.razorpayConfigured ? "ok" : "warning"}
                  />
                  <SettingRow
                    icon={Mail}
                    label="SMTP email"
                    status={settings?.smtpConfigured ? "ok" : "warning"}
                  />
                </div>
              </section>

              <section>
                <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-secondary" />
                  Categories
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Manage course categories. These appear in course filters and on course cards.
                </p>
                {categoriesLoading ? (
                  <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
                    Loading categories...
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30">
                      <span className="text-sm font-medium">All categories</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => seedMutation.mutate()}
                          disabled={seedMutation.isPending}
                        >
                          {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Load default categories
                        </Button>
                        <Button size="sm" onClick={openAddDialog}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add category
                        </Button>
                      </div>
                    </div>
                    <div className="divide-y divide-border">
                      {categories.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                          No categories yet. Add one to get started.
                        </div>
                      ) : (
                        categories.map((cat) => (
                          <div
                            key={cat._id}
                            className="flex items-center justify-between px-4 py-3 hover:bg-muted/20"
                          >
                            <div className="flex items-center gap-2">
                              {cat.icon && <span className="text-lg">{cat.icon}</span>}
                              <span className="font-medium">{cat.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(cat)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (window.confirm(`Delete "${cat.name}"? Courses using this category will be set to "General".`)) {
                                    deleteMutation.mutate(cat._id);
                                  }
                                }}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </section>

              <Dialog open={categoryDialogOpen} onOpenChange={(open) => {
                setCategoryDialogOpen(open);
                if (!open) {
                  setEditingCategory(null);
                  setCategoryName("");
                  setCategoryIcon("");
                }
              }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingCategory ? "Edit category" : "Add category"}</DialogTitle>
                    <DialogDescription>
                      {editingCategory
                        ? "Update the category name or icon."
                        : "Create a new category for courses."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Name</label>
                      <Input
                        value={categoryName}
                        onChange={(e) => setCategoryName(e.target.value)}
                        placeholder="e.g. Development"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Icon (optional)</label>
                      <Input
                        value={categoryIcon}
                        onChange={(e) => setCategoryIcon(e.target.value)}
                        placeholder="e.g. 💻"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    {editingCategory && (
                      <Button
                        variant="destructive"
                        onClick={handleDeleteCategory}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                        Delete
                      </Button>
                    )}
                    <div className="flex-1" />
                    <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveCategory} disabled={isSaving}>
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {editingCategory ? "Save" : "Create"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <p className="text-sm text-muted-foreground">
                To change these settings, update the <code className="rounded bg-muted px-1 py-0.5">.env</code> file in the backend and restart the server.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
