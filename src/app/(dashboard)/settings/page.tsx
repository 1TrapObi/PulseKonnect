"use client";

import * as React from "react";

import { DashboardShell } from "@/components/shared/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToastViewport, useToast } from "@/components/ui/toast";
import { NotificationSettingsCard } from "@/components/notifications/notification-settings-card";
import { LeadScraperSettingsCard } from "@/components/leads/lead-scraper-settings-card";
import { CandidateScraperSettingsCard } from "@/components/candidates/candidate-scraper-settings-card";
import { TeamSettingsCard } from "@/components/shared/team-settings-card";
import { AccountSettingsCard } from "@/components/shared/account-settings-card";
import { CheckboxGroup } from "@/components/onboarding/admin/checkbox-group";
import { ServiceAreasCheckboxes } from "@/components/onboarding/admin/service-areas-checkboxes";

const TABS = [
  { value: "organization", label: "Organization" },
  { value: "lead-scraper", label: "Lead Scraper" },
  { value: "candidate-scraper", label: "Candidate Scraper" },
  { value: "team", label: "Team" },
  { value: "account", label: "Account" },
  { value: "notifications", label: "Notifications" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const tabOptions: SelectOption[] = TABS.map((t) => ({ value: t.value, label: t.label }));

type OrganizationSettings = {
  organizationName: string;
  contactName: string;
  phone: string;
  serviceAreas: string[];
  otherServiceArea: string;
  serviceTypes: string[];
  otherServiceType: string;
  ageGroups: string[];
  insuranceTypes: string[];
  otherInsuranceType: string;
};

const serviceTypeOptions = [
  "Substance Abuse Treatment",
  "Mental Health Counseling",
  "Peer Support Services",
  "Intensive In-Home Services",
  "Crisis Intervention",
  "Family Therapy",
  "Case Management",
  "Medication Management",
  "Group Therapy",
  "Other",
];

const ageGroupOptions = [
  "Children (0-12)",
  "Adolescents (13-17)",
  "Young Adults (18-25)",
  "Adults (26-64)",
  "Seniors (65+)",
];

const insuranceOptions = [
  "Medicaid",
  "Medicare",
  "Private Insurance (Commercial)",
  "Blue Cross Blue Shield",
  "Aetna",
  "UnitedHealthcare",
  "Cigna",
  "Self-Pay / Out of Pocket",
  "Sliding Scale Fees",
  "Other",
];

function normalizeStringArray(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter(Boolean);
}

function normalizeOrgSettings(input: any): OrganizationSettings {
  const s = (input ?? {}) as any;
  return {
    organizationName: String(s.organizationName ?? ""),
    contactName: String(s.contactName ?? ""),
    phone: String(s.phone ?? ""),
    serviceAreas: normalizeStringArray(s.serviceAreas),
    otherServiceArea: String(s.otherServiceArea ?? ""),
    serviceTypes: normalizeStringArray(s.serviceTypes),
    otherServiceType: String(s.otherServiceType ?? ""),
    ageGroups: normalizeStringArray(s.ageGroups),
    insuranceTypes: normalizeStringArray(s.insuranceTypes),
    otherInsuranceType: String(s.otherInsuranceType ?? ""),
  };
}

function TabPanel({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="mt-1 text-sm text-zinc-600">{description}</div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed bg-white p-6 text-sm text-zinc-600">
          Coming next: this section will be wired to its API routes and database tables.
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = React.useState<TabValue>("organization");
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

  const { items: toasts, push, remove } = useToast();

  const [orgLoading, setOrgLoading] = React.useState(false);
  const [orgSaving, setOrgSaving] = React.useState(false);
  const [org, setOrg] = React.useState<OrganizationSettings | null>(null);
  const [orgBaseline, setOrgBaseline] = React.useState<OrganizationSettings | null>(null);
  const [otherAreaChecked, setOtherAreaChecked] = React.useState(false);

  const orgDirty = React.useMemo(() => {
    if (!org || !orgBaseline) return false;
    return JSON.stringify(org) !== JSON.stringify(orgBaseline);
  }, [org, orgBaseline]);

  React.useEffect(() => {
    setHasUnsavedChanges(orgDirty);
  }, [orgDirty]);

  async function loadOrganization() {
    setOrgLoading(true);
    try {
      const res = await fetch("/api/settings/organization");
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        push({ title: "Failed to load organization", description: json.error ?? "Request failed", variant: "danger" });
        return;
      }
      const next = normalizeOrgSettings(json.organization);
      setOrg(next);
      setOrgBaseline(next);
      setOtherAreaChecked(Boolean(next.otherServiceArea && next.otherServiceArea.trim()));
    } catch (e: any) {
      push({ title: "Failed to load organization", description: String(e?.message ?? e), variant: "danger" });
    } finally {
      setOrgLoading(false);
    }
  }

  React.useEffect(() => {
    loadOrganization();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveOrganization() {
    if (!org) return;
    setOrgSaving(true);
    try {
      const res = await fetch("/api/settings/organization", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(org),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        push({ title: "Save failed", description: json.error ?? "Request failed", variant: "danger" });
        return;
      }
      push({ title: "Organization settings saved" });
      await loadOrganization();
    } catch (e: any) {
      push({ title: "Save failed", description: String(e?.message ?? e), variant: "danger" });
    } finally {
      setOrgSaving(false);
    }
  }

  return (
    <DashboardShell title="Settings">
      <ToastViewport items={toasts} remove={remove} />

      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-500">Settings</div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Settings</h1>
        </div>
        <Button type="button" disabled={!hasUnsavedChanges}>
          Save All
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="mt-4">
        <div className="sticky top-0 z-10 -mx-4 border-b bg-zinc-50 px-4 py-3 md:-mx-6 md:px-6">
          <div className="md:hidden">
            <Select value={tab} onChange={(e) => setTab(e.target.value as TabValue)} options={tabOptions} />
          </div>

          <TabsList className="hidden w-full flex-wrap justify-start gap-1 md:inline-flex">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-4">
          <TabsContent value="organization">
            {orgLoading || !org ? (
              <div className="rounded-xl border bg-white p-5 text-sm text-zinc-600">Loading…</div>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle>Organization Settings</CardTitle>
                      <div className="mt-1 text-sm text-zinc-600">
                        Manage organization profile, contact info, service areas, and services offered.
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" disabled={!orgDirty || orgSaving} onClick={loadOrganization}>
                        Cancel
                      </Button>
                      <Button type="button" disabled={!orgDirty || orgSaving} onClick={saveOrganization}>
                        {orgSaving ? "Saving…" : "Save Changes"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-8">
                  <section className="space-y-4">
                    <div className="text-sm font-semibold text-zinc-900">Organization Profile</div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Organization Name *</div>
                        <Input
                          value={org.organizationName}
                          onChange={(e) => setOrg({ ...org, organizationName: e.target.value })}
                          maxLength={200}
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm font-medium">Primary Contact *</div>
                        <Input value={org.contactName} onChange={(e) => setOrg({ ...org, contactName: e.target.value })} />
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm font-medium">Phone *</div>
                        <Input value={org.phone} onChange={(e) => setOrg({ ...org, phone: e.target.value })} />
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm font-medium">Service Areas *</div>
                        <ServiceAreasCheckboxes
                          value={org.serviceAreas}
                          onChange={(v) => setOrg({ ...org, serviceAreas: v })}
                          otherChecked={otherAreaChecked}
                          onOtherCheckedChange={(v) => {
                            setOtherAreaChecked(v);
                            if (!v) setOrg({ ...org, otherServiceArea: "" });
                          }}
                          otherValue={org.otherServiceArea}
                          onOtherValueChange={(v) => setOrg({ ...org, otherServiceArea: v })}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="text-sm font-semibold text-zinc-900">Services Offered</div>

                    <div className="space-y-2">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">Service Types *</div>
                          <div className="text-xs text-zinc-600">Select all that apply</div>
                        </div>
                        <div className="text-xs text-zinc-500">{org.serviceTypes.length} selected</div>
                      </div>

                      <CheckboxGroup
                        options={serviceTypeOptions}
                        value={org.serviceTypes}
                        onChange={(v) => setOrg({ ...org, serviceTypes: v })}
                      />

                      {org.serviceTypes.includes("Other") ? (
                        <div className="pt-2">
                          <Input
                            value={org.otherServiceType}
                            onChange={(e) => setOrg({ ...org, otherServiceType: e.target.value })}
                            placeholder="Please specify"
                            maxLength={100}
                          />
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">Client Age Groups *</div>
                          <div className="text-xs text-zinc-600">Select all that apply</div>
                        </div>
                        <div className="text-xs text-zinc-500">{org.ageGroups.length} selected</div>
                      </div>

                      <CheckboxGroup
                        options={ageGroupOptions}
                        value={org.ageGroups}
                        onChange={(v) => setOrg({ ...org, ageGroups: v })}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">Insurance Types Accepted *</div>
                          <div className="text-xs text-zinc-600">Select all that apply</div>
                        </div>
                        <div className="text-xs text-zinc-500">{org.insuranceTypes.length} selected</div>
                      </div>

                      <CheckboxGroup
                        options={insuranceOptions}
                        value={org.insuranceTypes}
                        onChange={(v) => setOrg({ ...org, insuranceTypes: v })}
                      />

                      {org.insuranceTypes.includes("Other") ? (
                        <div className="pt-2">
                          <Input
                            value={org.otherInsuranceType}
                            onChange={(e) => setOrg({ ...org, otherInsuranceType: e.target.value })}
                            placeholder="Please specify"
                            maxLength={100}
                          />
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section className="space-y-2">
                    <div className="text-sm font-semibold text-zinc-900">Billing Information (Future)</div>
                    <div className="rounded-lg border bg-zinc-50 p-4 text-sm text-zinc-600">
                      Subscription and billing settings will be added in a future ticket.
                    </div>
                  </section>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="lead-scraper">
            <LeadScraperSettingsCard />
          </TabsContent>

          <TabsContent value="candidate-scraper">
            <CandidateScraperSettingsCard />
          </TabsContent>

          <TabsContent value="team">
            <TeamSettingsCard />
          </TabsContent>

          <TabsContent value="account">
            <AccountSettingsCard />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationSettingsCard />
          </TabsContent>
        </div>
      </Tabs>
    </DashboardShell>
  );
}
