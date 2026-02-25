import { useQuery } from "@tanstack/react-query";
import { api, ApiCertificate } from "@/lib/api";
import { format } from "date-fns";
import { Award } from "lucide-react";
import { Helmet } from "react-helmet-async";

type CertificateWithUrl = ApiCertificate & { url?: string };

const Certificates = () => {
  const { data: certificates, isLoading } = useQuery<CertificateWithUrl[]>({
    queryKey: ["certificates"],
    queryFn: () => api.getCertificates()
  });

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Certificates – LearnHub LMS</title>
        <meta
          name="description"
          content="View certificates earned from completing courses on LearnHub LMS."
        />
      </Helmet>
      <Navbar />
      <main className="container mx-auto px-4 py-10">
        <h1 className="font-heading text-3xl font-bold text-foreground">
          Certificates
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Certificates are issued when you complete a course.
        </p>

        {isLoading && (
          <p className="mt-8 text-sm text-muted-foreground">
            Loading certificates...
          </p>
        )}

        {!isLoading && (!certificates || certificates.length === 0) && (
          <p className="mt-8 text-sm text-muted-foreground">
            You do not have any certificates yet.
          </p>
        )}

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {certificates?.map((certificate) => (
            <div
              key={certificate._id}
              className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-card"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/15">
                  <Award className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-card-foreground">
                    {certificate.course.title}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Issued on{" "}
                    {format(new Date(certificate.issuedAt), "dd MMM yyyy")}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-between text-xs text-muted-foreground">
                <span>Course: {certificate.course.title}</span>
                {certificate.url && (
                  <a
                    href={certificate.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-secondary hover:underline"
                  >
                    Download
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Certificates;
