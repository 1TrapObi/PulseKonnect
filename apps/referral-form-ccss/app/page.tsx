"use client";

import { useMemo, useState } from "react";

const ORGANIZATION_SLUG = "ccss";

type Urgency = "low" | "medium" | "high" | "urgent";
type Insurance = "" | "medicaid" | "medicare" | "private" | "self_pay" | "sliding_scale";

type FormData = {
  name: string;
  email: string;
  phone: string;
  serviceNeeded: string;
  urgency: Urgency;
  location: string;
  insuranceType: Insurance;
  medicaidNumber: string;
  referralAgency: string;
  referralContactName: string;
  referralContactEmail: string;
  notes: string;
};

export default function Home() {
  const apiBase =
    process.env.NEXT_PUBLIC_PULSEKONNECT_API_URL?.trim() || "https://dev.pulsekonnect.com";

  const apiHostLabel = useMemo(() => {
    try {
      return new URL(apiBase).host;
    } catch {
      return apiBase;
    }
  }, [apiBase]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    serviceNeeded: "",
    urgency: "medium",
    location: "",
    insuranceType: "",
    medicaidNumber: "",
    referralAgency: "",
    referralContactName: "",
    referralContactEmail: "",
    notes: "",
  });

  const missingRequired = useMemo(() => {
    const missing: string[] = [];
    if (!formData.name.trim()) missing.push("Full Name");
    if (!formData.phone.trim()) missing.push("Phone Number");
    if (!formData.location.trim()) missing.push("Location/City");
    if (!formData.serviceNeeded.trim()) missing.push("Service Type Needed");
    return missing;
  }, [formData]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (missingRequired.length) {
      setError(`Please complete: ${missingRequired.join(", ")}.`);
      return;
    }

    if (formData.insuranceType === "medicaid" && !formData.medicaidNumber.trim()) {
      setError("Please enter a Medicaid number (or change insurance type). ");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/api/referrals/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationSlug: ORGANIZATION_SLUG,
          ...formData,
        }),
      });

      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setError(String(data?.error ?? "Failed to submit referral"));
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setFormData({
          name: "",
          email: "",
          phone: "",
          serviceNeeded: "",
          urgency: "medium",
          location: "",
          insuranceType: "",
          medicaidNumber: "",
          referralAgency: "",
          referralContactName: "",
          referralContactEmail: "",
          notes: "",
        });
      }, 3000);
    } catch (err: any) {
      setError(err?.message ?? "An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-100 px-4 py-12">
        <div className="mx-auto max-w-xl">
          <div className="rounded-2xl bg-white p-8 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                ✓
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">Referral submitted</h1>
                <p className="mt-1 text-slate-600">
                  Thank you. The CCSS team has been notified and will follow up shortly.
                </p>
              </div>
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-slate-600">
            This page will reset automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-100 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Carolina Community Support Services
          </h1>
          <p className="mt-2 text-base text-slate-600">Referral Submission Form</p>
        </header>

        <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          <h2 className="text-xl font-semibold text-slate-900">Submit a Client Referral</h2>
          <p className="mt-1 text-sm text-slate-600">
            Fields marked with <span className="font-semibold">*</span> are required.
          </p>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6 space-y-8">
            <section className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-sm font-semibold text-slate-900">Client Information</h3>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-900">Full Name *</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    placeholder="John Doe"
                    autoComplete="name"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-900">Phone Number *</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={formData.phone}
                    onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="(919) 555-0123"
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-900">Email Address</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  placeholder="john.doe@email.com"
                  autoComplete="email"
                  inputMode="email"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-900">Location/City *</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={formData.location}
                  onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
                  placeholder="Durham, NC"
                  autoComplete="address-level2"
                />
              </label>
            </section>

            <section className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-sm font-semibold text-slate-900">Service Needs</h3>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-900">Service Type Needed *</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={formData.serviceNeeded}
                  onChange={(e) => setFormData((p) => ({ ...p, serviceNeeded: e.target.value }))}
                >
                  <option value="">Select service type</option>
                  <option value="mental_health">Mental Health Counseling</option>
                  <option value="substance_abuse">Substance Abuse Treatment</option>
                  <option value="crisis_intervention">Crisis Intervention</option>
                  <option value="intensive_in_home">Intensive In-Home Services</option>
                  <option value="peer_support">Peer Support Services</option>
                  <option value="family_therapy">Family Therapy</option>
                  <option value="case_management">Case Management</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-900">Urgency Level *</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={formData.urgency}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      urgency: e.target.value as Urgency,
                    }))
                  }
                >
                  <option value="low">Low - Within 2 weeks</option>
                  <option value="medium">Medium - Within 1 week</option>
                  <option value="high">High - Within 2-3 days</option>
                  <option value="urgent">Urgent - Immediate</option>
                </select>
              </label>
            </section>

            <section className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-sm font-semibold text-slate-900">Insurance & Coverage</h3>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-900">Insurance Type</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={formData.insuranceType}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      insuranceType: e.target.value as Insurance,
                      medicaidNumber: e.target.value === "medicaid" ? p.medicaidNumber : "",
                    }))
                  }
                >
                  <option value="">Select insurance type</option>
                  <option value="medicaid">Medicaid</option>
                  <option value="medicare">Medicare</option>
                  <option value="private">Private Insurance</option>
                  <option value="self_pay">Self-Pay</option>
                  <option value="sliding_scale">Sliding Scale</option>
                </select>
              </label>

              {formData.insuranceType === "medicaid" ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-900">Medicaid Number *</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={formData.medicaidNumber}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        medicaidNumber: e.target.value,
                      }))
                    }
                    placeholder="Enter Medicaid ID"
                    autoComplete="off"
                  />
                </label>
              ) : null}
            </section>

            <section className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-sm font-semibold text-slate-900">Referral Source</h3>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-900">Your Agency/Organization</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={formData.referralAgency}
                  onChange={(e) => setFormData((p) => ({ ...p, referralAgency: e.target.value }))}
                  placeholder="Carolina Outreach"
                  autoComplete="organization"
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-900">Your Name</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={formData.referralContactName}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, referralContactName: e.target.value }))
                    }
                    placeholder="Jane Smith"
                    autoComplete="name"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-900">Your Email</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={formData.referralContactEmail}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, referralContactEmail: e.target.value }))
                    }
                    placeholder="jane@agency.com"
                    autoComplete="email"
                    inputMode="email"
                  />
                </label>
              </div>
            </section>

            <section className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-sm font-semibold text-slate-900">Additional Notes</h3>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-900">Notes</span>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={formData.notes}
                  onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Any additional information about the client or their needs..."
                  rows={4}
                />
              </label>
            </section>

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Submitting Referral..." : "Submit Referral"}
              </button>

              <p className="text-center text-xs text-slate-500">
                Submitting to <span className="font-medium">{apiHostLabel}</span>
              </p>
            </div>
          </form>
        </div>

        <footer className="mt-8 text-center text-sm text-slate-600">
          <p>Questions? Contact Carolina Community Support Services.</p>
        </footer>
      </div>
    </div>
  );
}
