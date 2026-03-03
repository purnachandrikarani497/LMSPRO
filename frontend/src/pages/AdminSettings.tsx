import { useQuery } from "@tanstack/react-query";
import { Settings, Globe, CreditCard, Mail, Shield, Check, X } from "lucide-react";
import { api, ApiSettings } from "@/lib/api";
import { Helmet } from "react-helmet-async";

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
  const { data: settings, isLoading } = useQuery<ApiSettings>({
    queryKey: ["admin-settings"],
    queryFn: () => api.getSettings()
  });

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
