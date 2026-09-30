"use client";

import { useState, useTransition, useCallback, useId } from "react";
import {
  Button,
  Badge,
  Input,
  Dropdown,
  CursorClickIcon,
  GlobeIcon,
  UsersIcon,
  FireIcon,
  ArrowRightIcon,
  CopyIcon,
  CheckIcon,
  TrashIcon,
  EyeIcon,
  ClockIcon,
  MapPinIcon,
  LightningIcon,
  XIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  FunnelSimpleIcon,
  CalendarBlankIcon,
  Modal,
} from "@/components/ui";
import { Page, PageHeader, MetricStrip, PageTabs, TableSection, Section, StatCard, EmptyState } from "@/components/dashboard";
import { toast } from "sonner";
import type { Database } from "@/types/database";
import {
  getWebsiteVisitors,
  createTrackingScript,
  deleteTrackingScript,
  toggleTrackingScript,
  updateVisitorStatus,
  convertVisitorToLead,
  getVisitorDetails,
  type VisitorFilters,
} from "@/lib/actions/website-visitors";

type Visitor = Database["public"]["Tables"]["website_visitors"]["Row"];
type TrackingScript = Database["public"]["Tables"]["tracking_scripts"]["Row"];
type Visit = Database["public"]["Tables"]["website_visits"]["Row"];

type Stats = {
  visitorsToday: number;
  visitorsThisWeek: number;
  visitorsThisMonth: number;
  companiesIdentified: number;
  hotVisitors: number;
  convertedToLeads: number;
};

interface Props {
  initialVisitors: Visitor[];
  initialTotal: number;
  initialStats: Stats;
  initialScripts: TrackingScript[];
}

const visitorStatusOptions = [
  { label: "All Statuses", value: "all" },
  { label: "New", value: "new" },
  { label: "Returning", value: "returning" },
  { label: "Hot", value: "hot" },
  { label: "Converted", value: "converted" },
  { label: "Ignored", value: "ignored" },
];

const visitorDateRangeOptions = [
  { label: "Today", value: "today" },
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "All Time", value: "all" },
];

export function WebsiteVisitorsClient({ initialVisitors, initialTotal, initialStats, initialScripts }: Props) {
  const [visitors, setVisitors] = useState(initialVisitors);
  const [total, setTotal] = useState(initialTotal);
  const [stats] = useState(initialStats);
  const [scripts, setScripts] = useState(initialScripts);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"visitors" | "scripts">("visitors");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState<"today" | "7d" | "30d" | "all">("30d");
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [visitorVisits, setVisitorVisits] = useState<Visit[]>([]);
  const [showSetup, setShowSetup] = useState(false);
  const setupTitleId = useId();
  const [newDomain, setNewDomain] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchVisitors = useCallback((filters: VisitorFilters) => {
    startTransition(async () => {
      try {
        const result = await getWebsiteVisitors(filters);
        setVisitors(result.visitors);
        setTotal(result.total);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load visitors");
      }
    });
  }, []);

  const handleSearch = (val: string) => {
    setSearch(val);
    fetchVisitors({ search: val, status: statusFilter, dateRange });
  };

  const handleStatusFilter = (val: string) => {
    setStatusFilter(val);
    fetchVisitors({ search, status: val, dateRange });
  };

  const handleDateRange = (val: "today" | "7d" | "30d" | "all") => {
    setDateRange(val);
    fetchVisitors({ search, status: statusFilter, dateRange: val });
  };

  const handleAddScript = async () => {
    if (!newDomain.trim()) return;
    try {
      const script = await createTrackingScript(newDomain.trim());
      setScripts((prev) => [script, ...prev]);
      setNewDomain("");
      toast.success("Tracking script created!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  const handleDeleteScript = async (id: string) => {
    try {
      await deleteTrackingScript(id);
      setScripts((prev) => prev.filter((s) => s.id !== id));
      toast.success("Script deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  const handleToggleScript = async (id: string, active: boolean) => {
    try {
      await toggleTrackingScript(id, active);
      setScripts((prev) => prev.map((s) => (s.id === id ? { ...s, is_active: active } : s)));
      toast.success(active ? "Script activated" : "Script paused");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  const copyScript = (scriptKey: string) => {
    const snippet = `<!-- Pulse CRM Tracking Pixel -->
<script>
!function(d,k,s){
  var e='${appUrl}/api/tracking',
      sid=sessionStorage.getItem('_pv_sid')||((Math.random()*1e16).toString(36));
  sessionStorage.setItem('_pv_sid',sid);
  var t0=Date.now(),maxScroll=0,sent=false;

  function track(extra){
    var data={script_key:k,session_id:sid,page_url:location.href,page_title:d.title,referrer:d.referrer};
    if(extra)for(var p in extra)data[p]=extra[p];
    try{navigator.sendBeacon?navigator.sendBeacon(e,JSON.stringify(data)):
    fetch(e,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),keepalive:true})}catch(x){}
  }

  // Initial pageview
  track();

  // Track time on page + scroll depth on exit
  window.addEventListener('scroll',function(){
    var h=d.documentElement,b=d.body,
        st=h.scrollTop||b.scrollTop,sh=h.scrollHeight||b.scrollHeight,
        ch=h.clientHeight||window.innerHeight,
        pct=Math.round(st/(sh-ch)*100);
    if(pct>maxScroll)maxScroll=pct;
  });

  window.addEventListener('beforeunload',function(){
    if(!sent){sent=true;track({duration:Math.round((Date.now()-t0)/1000),scroll_depth:maxScroll})}
  });

  // SPA support: track client-side navigation
  var push=history.pushState;
  history.pushState=function(){push.apply(history,arguments);setTimeout(function(){track()},100)};
  window.addEventListener('popstate',function(){setTimeout(function(){track()},100)});

  // GTM dataLayer integration
  window.dataLayer=window.dataLayer||[];
  window.dataLayer.push({'event':'pulse_crm_loaded','pulse_script_key':k});
}(document,'${scriptKey}');
</script>
<!-- End Pulse CRM Tracking Pixel -->`;
    navigator.clipboard.writeText(snippet);
    setCopiedKey(scriptKey);
    setTimeout(() => setCopiedKey(null), 2000);
    toast.success("Tracking script copied to clipboard!");
  };

  const handleViewVisitor = async (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    try {
      const { visits } = await getVisitorDetails(visitor.id);
      setVisitorVisits(visits);
    } catch {
      setVisitorVisits([]);
    }
  };

  const handleConvert = async (visitorId: string) => {
    try {
      await convertVisitorToLead(visitorId);
      setVisitors((prev) => prev.map((v) => (v.id === visitorId ? { ...v, status: "converted" as const } : v)));
      setSelectedVisitor(null);
      toast.success("Visitor converted to lead!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  const handleIgnore = async (visitorId: string) => {
    try {
      await updateVisitorStatus(visitorId, "ignored");
      setVisitors((prev) => prev.map((v) => (v.id === visitorId ? { ...v, status: "ignored" as const } : v)));
      toast.success("Visitor ignored");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  const statusVariant = (status: string): "info" | "primary" | "error" | "success" | "neutral" => {
    switch (status) {
      case "new": return "info";
      case "returning": return "primary";
      case "hot": return "error";
      case "converted": return "success";
      case "ignored": return "neutral";
      default: return "neutral";
    }
  };

  const hasScripts = scripts.length > 0;

  return (
    <Page>
      <PageHeader title="Website Visitors" icon={<CursorClickIcon size={18} />}>
        <Button variant="outline" size="sm" onClick={() => setShowSetup(true)} leftIcon={<GlobeIcon size={16} />}>
          Setup Tracking
        </Button>
      </PageHeader>

      {/* Stats Row */}
      <MetricStrip>
        <StatCard label="Today" value={stats.visitorsToday} icon={<CursorClickIcon size={20} className="text-fg" />} />
        <StatCard label="This Week" value={stats.visitorsThisWeek} icon={<ChartBarIcon size={20} className="text-fg" />} />
        <StatCard label="This Month" value={stats.visitorsThisMonth} icon={<UsersIcon size={20} className="text-fg" />} />
        <StatCard label="Companies" value={stats.companiesIdentified} icon={<GlobeIcon size={20} className="text-fg" />} />
        <StatCard label="Hot Visitors" value={stats.hotVisitors} icon={<FireIcon size={20} className="text-fg" />} />
        <StatCard label="Converted" value={stats.convertedToLeads} icon={<LightningIcon size={20} className="text-fg" />} />
      </MetricStrip>

      {/* Tabs */}
      <PageTabs
        tabs={[
          { id: "visitors", label: `Visitors (${total})` },
          { id: "scripts", label: `Tracking Scripts (${scripts.length})` },
        ]}
        value={activeTab}
        onChange={setActiveTab}
        className="max-sm:overflow-x-auto max-sm:overflow-y-hidden"
      />

      {activeTab === "visitors" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 px-8 py-2 max-sm:px-4">
            <Input
              leftIcon={<MagnifyingGlassIcon size={18} />}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search visitors..."
              className="w-full sm:w-60"
            />
            <Dropdown
              options={visitorStatusOptions}
              value={statusFilter}
              onChange={handleStatusFilter}
              icon={<FunnelSimpleIcon size={18} />}
              size="sm"
            />
            <Dropdown
              options={visitorDateRangeOptions}
              value={dateRange}
              onChange={(val) => handleDateRange(val as "today" | "7d" | "30d" | "all")}
              icon={<CalendarBlankIcon size={18} />}
              size="sm"
            />
          </div>

          {/* Visitors Table */}
          {visitors.length === 0 ? (
            <div className="border-t border-divider">
              <EmptyState
                icon={<CursorClickIcon size={32} />}
                title={hasScripts ? "No visitors yet" : "Set up tracking first"}
                description={hasScripts ? "Visitors will appear here once your tracking script starts collecting data." : "Add a tracking script to your website to start identifying visitors."}
                actions={!hasScripts ? [{ label: "Setup Tracking", onClick: () => setShowSetup(true) }] : undefined}
              />
            </div>
          ) : (
            <>
              <TableSection>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left">
                        <th className="text-[13px] font-medium text-fg-secondary">Visitor</th>
                        <th className="text-[13px] font-medium text-fg-secondary">Location</th>
                        <th className="text-[13px] font-medium text-fg-secondary">Pages</th>
                        <th className="text-[13px] font-medium text-fg-secondary">Visits</th>
                        <th className="text-[13px] font-medium text-fg-secondary">Duration</th>
                        <th className="text-[13px] font-medium text-fg-secondary">Last Seen</th>
                        <th className="text-[13px] font-medium text-fg-secondary">Status</th>
                        <th className="text-right text-[13px] font-medium text-fg-secondary">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visitors.map((v) => (
                        <tr key={v.id} className="hover:bg-subtle transition-colors">
                          <td className="py-2 text-[14px] text-fg">
                            <div className="flex items-start gap-2">
                              <GlobeIcon size={16} className="mt-0.5 shrink-0 text-fg-muted" />
                              <div>
                                <div className="text-[14px] font-medium text-fg">
                                  {v.company_name || v.ip_address || "Unknown"}
                                </div>
                                {v.company_domain && (
                                  <div className="text-[13px] text-fg-secondary">{v.company_domain}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2 text-[14px] text-fg-secondary">
                            {[v.city, v.country_code].filter(Boolean).join(", ") || "—"}
                          </td>
                          <td className="py-2 text-[14px] text-fg-secondary">{v.page_count}</td>
                          <td className="py-2 text-[14px] text-fg-secondary">{v.visit_count}</td>
                          <td className="py-2 text-[14px] text-fg-secondary">
                            {v.total_duration > 0 ? `${Math.round(v.total_duration / 60)}m` : "—"}
                          </td>
                          <td className="py-2 text-[14px] text-fg-secondary">
                            {new Date(v.last_seen).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="py-2 text-[14px] text-fg">
                            <Badge variant={statusVariant(v.status)}>{v.status}</Badge>
                          </td>
                          <td className="py-2 text-[14px] text-fg">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleViewVisitor(v)}
                                className="p-1.5 rounded-md hover:bg-muted text-fg-secondary hover:text-fg transition-colors"
                                title="View details"
                              >
                                <EyeIcon size={16} />
                              </button>
                              {v.status !== "converted" && v.status !== "ignored" && (
                                <button
                                  onClick={() => handleConvert(v.id)}
                                  className="p-1.5 rounded-md hover:bg-success-surface text-fg-secondary hover:text-success transition-colors"
                                  title="Convert to lead"
                                >
                                  <ArrowRightIcon size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TableSection>
              {total > 50 && (
                <div className="flex h-12 items-center px-8 max-sm:px-4 text-[13px] text-fg-muted">
                  Showing {visitors.length} of {total} visitors
                </div>
              )}
            </>
          )}
        </>
      )}

      {activeTab === "scripts" && (
        <div>
          {/* Add Script Form */}
          <div className="flex gap-3 px-8 py-4 max-sm:px-4">
            <Input
              placeholder="Enter your domain (e.g., example.com)"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddScript()}
              leftIcon={<GlobeIcon size={18} />}
              className="flex-1"
            />
            <Button size="sm" onClick={handleAddScript} leftIcon={<PlusIcon size={16} />}>
              Add Domain
            </Button>
          </div>

          {scripts.length === 0 ? (
            <div className="border-t border-divider">
              <EmptyState
                icon={<GlobeIcon size={32} />}
                title="No tracking scripts"
                description="Add a domain to generate a tracking script you can install on your website."
              />
            </div>
          ) : (
            <div className="border-t border-divider">
              {scripts.map((script) => (
                <Section
                  key={script.id}
                  title={
                    <>
                      <span className={`w-2.5 h-2.5 rounded-full ${script.is_active ? "bg-success" : "bg-active"}`} />
                      {script.domain}
                      <Badge variant={script.is_active ? "success" : "neutral"}>{script.is_active ? "Active" : "Paused"}</Badge>
                    </>
                  }
                  description={`Created ${new Date(script.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
                  actions={
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleScript(script.id, !script.is_active)}
                      >
                        {script.is_active ? "Pause" : "Activate"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteScript(script.id)}
                        className="text-fg-muted hover:text-danger"
                      >
                        <TrashIcon size={16} />
                      </Button>
                    </>
                  }
                >
                  {/* Script Snippet */}
                  <div className="relative">
                    <pre suppressHydrationWarning className="p-3 rounded bg-subtle border border-line text-xs text-fg-secondary overflow-x-auto">
{`<script>
(function(){var s='${appUrl}/api/tracking';
var k='${script.script_key}';
var sid=sessionStorage.getItem('_pv_sid')||((Math.random()*1e16).toString(36));
sessionStorage.setItem('_pv_sid',sid);
var d={script_key:k,session_id:sid,page_url:location.href,
page_title:document.title,referrer:document.referrer};
fetch(s,{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify(d),keepalive:true});
})();
</script>`}
                    </pre>
                    <button
                      onClick={() => copyScript(script.script_key)}
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-surface border border-line hover:bg-muted transition-colors"
                      title="Copy script"
                    >
                      {copiedKey === script.script_key ? (
                        <CheckIcon size={14} className="text-success" />
                      ) : (
                        <CopyIcon size={14} className="text-fg-secondary" />
                      )}
                    </button>
                  </div>
                </Section>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Visitor Detail Drawer */}
      {selectedVisitor && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedVisitor(null)} />
          <div className="relative w-full max-w-lg bg-surface border-l border-line overflow-y-auto">
            <div className="sticky top-0 z-10 bg-surface border-b border-line px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-fg">Visitor Details</h3>
              <button
                onClick={() => setSelectedVisitor(null)}
                className="p-1.5 rounded-md hover:bg-muted text-fg-secondary"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Visitor Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                    <GlobeIcon size={24} className="text-fg-secondary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-fg">
                      {selectedVisitor.company_name || selectedVisitor.ip_address || "Unknown Visitor"}
                    </h4>
                    {selectedVisitor.company_domain && (
                      <p className="text-sm text-fg-secondary">{selectedVisitor.company_domain}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded bg-subtle">
                    <div className="text-xs text-fg-secondary mb-1">Status</div>
                    <Badge variant={statusVariant(selectedVisitor.status)}>{selectedVisitor.status}</Badge>
                  </div>
                  <div className="p-3 rounded bg-subtle">
                    <div className="text-xs text-fg-secondary mb-1">Visits</div>
                    <div className="font-semibold text-fg">{selectedVisitor.visit_count}</div>
                  </div>
                  <div className="p-3 rounded bg-subtle">
                    <div className="text-xs text-fg-secondary mb-1">Pages Viewed</div>
                    <div className="font-semibold text-fg">{selectedVisitor.page_count}</div>
                  </div>
                  <div className="p-3 rounded bg-subtle">
                    <div className="text-xs text-fg-secondary mb-1">Total Duration</div>
                    <div className="font-semibold text-fg">
                      {selectedVisitor.total_duration > 0 ? `${Math.round(selectedVisitor.total_duration / 60)}m` : "—"}
                    </div>
                  </div>
                </div>

                {(selectedVisitor.city || selectedVisitor.country) && (
                  <div className="flex items-center gap-2 text-sm text-fg-secondary">
                    <MapPinIcon size={16} />
                    {[selectedVisitor.city, selectedVisitor.region, selectedVisitor.country].filter(Boolean).join(", ")}
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-fg-secondary">
                  <ClockIcon size={16} />
                  First seen: {new Date(selectedVisitor.first_seen).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
              </div>

              {/* Actions */}
              {selectedVisitor.status !== "converted" && selectedVisitor.status !== "ignored" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleConvert(selectedVisitor.id)} className="flex-1">
                    <ArrowRightIcon size={16} className="mr-2" />
                    Convert to Lead
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleIgnore(selectedVisitor.id)}>
                    Ignore
                  </Button>
                </div>
              )}

              {/* Page History */}
              <div>
                <h4 className="text-sm font-semibold text-fg mb-3">Page History</h4>
                {visitorVisits.length === 0 ? (
                  <p className="text-sm text-fg-secondary">No page visits recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {visitorVisits.map((visit) => (
                      <div
                        key={visit.id}
                        className="p-3 rounded border border-row"
                      >
                        <div className="text-sm font-medium text-fg truncate">
                          {visit.page_title || visit.page_url}
                        </div>
                        <div className="text-xs text-fg-secondary truncate mt-0.5">{visit.page_url}</div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-fg-muted">
                          <span>{new Date(visit.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          {visit.duration && visit.duration > 0 && <span>{Math.round(visit.duration / 60)}m on page</span>}
                          {visit.referrer && <span className="truncate max-w-[150px]">from {visit.referrer}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Setup Modal */}
      <Modal open={showSetup} onClose={() => setShowSetup(false)} className="max-w-md rounded-lg">
        <div role="dialog" aria-modal="true" aria-labelledby={setupTitleId} className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 id={setupTitleId} className="text-lg font-semibold text-fg">Setup Website Tracking</h3>
            <button
              onClick={() => setShowSetup(false)}
              aria-label="Close"
              className="p-1.5 rounded-md hover:bg-muted text-fg-secondary"
            >
              <XIcon size={18} />
            </button>
          </div>

          <p className="text-sm text-fg-secondary mb-4">
            Add your domain, then copy the tracking script and paste it before the closing {'</body>'} tag on your website.
          </p>

          <div className="flex gap-2 mb-4">
            <Input
              placeholder="yourdomain.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddScript()}
              leftIcon={<GlobeIcon size={18} />}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={async () => {
                await handleAddScript();
                setShowSetup(false);
                setActiveTab("scripts");
              }}
            >
              Create
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-fg-secondary">
              <CheckIcon size={16} className="text-success" />
              Automatic visitor identification
            </div>
            <div className="flex items-center gap-2 text-sm text-fg-secondary">
              <CheckIcon size={16} className="text-success" />
              Page tracking & session recording
            </div>
            <div className="flex items-center gap-2 text-sm text-fg-secondary">
              <CheckIcon size={16} className="text-success" />
              Convert visitors to leads instantly
            </div>
          </div>
        </div>
      </Modal>
    </Page>
  );
}

