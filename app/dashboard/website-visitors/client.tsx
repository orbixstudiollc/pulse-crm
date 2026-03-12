"use client";

import { useState, useTransition, useCallback } from "react";
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
} from "@/components/ui";
import { PageHeader, StatCard, EmptyState } from "@/components/dashboard";
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
  const [newDomain, setNewDomain] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchVisitors = useCallback((filters: VisitorFilters) => {
    startTransition(async () => {
      try {
        const result = await getWebsiteVisitors(filters);
        setVisitors(result.visitors);
        setTotal(result.total);
      } catch (e: any) {
        toast.error(e.message);
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
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteScript = async (id: string) => {
    try {
      await deleteTrackingScript(id);
      setScripts((prev) => prev.filter((s) => s.id !== id));
      toast.success("Script deleted");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleToggleScript = async (id: string, active: boolean) => {
    try {
      await toggleTrackingScript(id, active);
      setScripts((prev) => prev.map((s) => (s.id === id ? { ...s, is_active: active } : s)));
      toast.success(active ? "Script activated" : "Script paused");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pulse-crm-rosy.vercel.app";

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
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleIgnore = async (visitorId: string) => {
    try {
      await updateVisitorStatus(visitorId, "ignored");
      setVisitors((prev) => prev.map((v) => (v.id === visitorId ? { ...v, status: "ignored" as const } : v)));
      toast.success("Visitor ignored");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const statusVariant = (status: string): "blue" | "violet" | "red" | "green" | "neutral" => {
    switch (status) {
      case "new": return "blue";
      case "returning": return "violet";
      case "hot": return "red";
      case "converted": return "green";
      case "ignored": return "neutral";
      default: return "neutral";
    }
  };

  const hasScripts = scripts.length > 0;

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 space-y-4">
      <PageHeader title="Website Visitors">
        <Button variant="outline" size="sm" onClick={() => setShowSetup(true)} leftIcon={<GlobeIcon size={16} />}>
          Setup Tracking
        </Button>
      </PageHeader>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Today" value={stats.visitorsToday} icon={<CursorClickIcon size={20} className="text-neutral-950 dark:text-neutral-50" />} />
        <StatCard label="This Week" value={stats.visitorsThisWeek} icon={<ChartBarIcon size={20} className="text-neutral-950 dark:text-neutral-50" />} />
        <StatCard label="This Month" value={stats.visitorsThisMonth} icon={<UsersIcon size={20} className="text-neutral-950 dark:text-neutral-50" />} />
        <StatCard label="Companies" value={stats.companiesIdentified} icon={<GlobeIcon size={20} className="text-neutral-950 dark:text-neutral-50" />} />
        <StatCard label="Hot Visitors" value={stats.hotVisitors} icon={<FireIcon size={20} className="text-neutral-950 dark:text-neutral-50" />} />
        <StatCard label="Converted" value={stats.convertedToLeads} icon={<LightningIcon size={20} className="text-neutral-950 dark:text-neutral-50" />} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setActiveTab("visitors")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "visitors" ? "border-neutral-900 dark:border-white text-neutral-900 dark:text-white" : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"}`}
        >
          Visitors ({total})
        </button>
        <button
          onClick={() => setActiveTab("scripts")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "scripts" ? "border-neutral-900 dark:border-white text-neutral-900 dark:text-white" : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"}`}
        >
          Tracking Scripts ({scripts.length})
        </button>
      </div>

      {activeTab === "visitors" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
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
            <EmptyState
              icon={<CursorClickIcon size={32} />}
              title={hasScripts ? "No visitors yet" : "Set up tracking first"}
              description={hasScripts ? "Visitors will appear here once your tracking script starts collecting data." : "Add a tracking script to your website to start identifying visitors."}
              actions={!hasScripts ? [{ label: "Setup Tracking", onClick: () => setShowSetup(true) }] : undefined}
            />
          ) : (
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 text-left">
                      <th className="px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">Visitor</th>
                      <th className="px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">Location</th>
                      <th className="px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">Pages</th>
                      <th className="px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">Visits</th>
                      <th className="px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">Duration</th>
                      <th className="px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">Last Seen</th>
                      <th className="px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">Status</th>
                      <th className="px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitors.map((v) => (
                      <tr key={v.id} className="border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-medium text-neutral-900 dark:text-neutral-100">
                              {v.company_name || v.ip_address || "Unknown"}
                            </div>
                            {v.company_domain && (
                              <div className="text-xs text-neutral-500">{v.company_domain}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                          {[v.city, v.country_code].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{v.page_count}</td>
                        <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{v.visit_count}</td>
                        <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                          {v.total_duration > 0 ? `${Math.round(v.total_duration / 60)}m` : "—"}
                        </td>
                        <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                          {new Date(v.last_seen).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant(v.status)}>{v.status}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleViewVisitor(v)}
                              className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                              title="View details"
                            >
                              <EyeIcon size={16} />
                            </button>
                            {v.status !== "converted" && v.status !== "ignored" && (
                              <button
                                onClick={() => handleConvert(v.id)}
                                className="p-1.5 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-500 hover:text-green-600 transition-colors"
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
              {total > 50 && (
                <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 text-sm text-neutral-500">
                  Showing {visitors.length} of {total} visitors
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === "scripts" && (
        <div className="space-y-4">
          {/* Add Script Form */}
          <div className="flex gap-3">
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
            <EmptyState
              icon={<GlobeIcon size={32} />}
              title="No tracking scripts"
              description="Add a domain to generate a tracking script you can install on your website."
            />
          ) : (
            <div className="space-y-3">
              {scripts.map((script) => (
                <div
                  key={script.id}
                  className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${script.is_active ? "bg-green-500" : "bg-neutral-300 dark:bg-neutral-600"}`} />
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">{script.domain}</span>
                      <Badge variant={script.is_active ? "green" : "neutral"}>{script.is_active ? "Active" : "Paused"}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
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
                        className="text-neutral-400 hover:text-red-500"
                      >
                        <TrashIcon size={16} />
                      </Button>
                    </div>
                  </div>

                  <div className="text-xs text-neutral-500 mb-3">
                    Created {new Date(script.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </div>

                  {/* Script Snippet */}
                  <div className="relative">
                    <pre className="p-3 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 overflow-x-auto">
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
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                      title="Copy script"
                    >
                      {copiedKey === script.script_key ? (
                        <CheckIcon size={14} className="text-green-500" />
                      ) : (
                        <CopyIcon size={14} className="text-neutral-500" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Visitor Detail Drawer */}
      {selectedVisitor && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedVisitor(null)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-neutral-950 border-l border-neutral-200 dark:border-neutral-800 overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Visitor Details</h3>
              <button
                onClick={() => setSelectedVisitor(null)}
                className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Visitor Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                    <GlobeIcon size={24} className="text-neutral-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {selectedVisitor.company_name || selectedVisitor.ip_address || "Unknown Visitor"}
                    </h4>
                    {selectedVisitor.company_domain && (
                      <p className="text-sm text-neutral-500">{selectedVisitor.company_domain}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded bg-neutral-50 dark:bg-neutral-900">
                    <div className="text-xs text-neutral-500 mb-1">Status</div>
                    <Badge variant={statusVariant(selectedVisitor.status)}>{selectedVisitor.status}</Badge>
                  </div>
                  <div className="p-3 rounded bg-neutral-50 dark:bg-neutral-900">
                    <div className="text-xs text-neutral-500 mb-1">Visits</div>
                    <div className="font-semibold text-neutral-900 dark:text-neutral-100">{selectedVisitor.visit_count}</div>
                  </div>
                  <div className="p-3 rounded bg-neutral-50 dark:bg-neutral-900">
                    <div className="text-xs text-neutral-500 mb-1">Pages Viewed</div>
                    <div className="font-semibold text-neutral-900 dark:text-neutral-100">{selectedVisitor.page_count}</div>
                  </div>
                  <div className="p-3 rounded bg-neutral-50 dark:bg-neutral-900">
                    <div className="text-xs text-neutral-500 mb-1">Total Duration</div>
                    <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {selectedVisitor.total_duration > 0 ? `${Math.round(selectedVisitor.total_duration / 60)}m` : "—"}
                    </div>
                  </div>
                </div>

                {(selectedVisitor.city || selectedVisitor.country) && (
                  <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                    <MapPinIcon size={16} />
                    {[selectedVisitor.city, selectedVisitor.region, selectedVisitor.country].filter(Boolean).join(", ")}
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
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
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Page History</h4>
                {visitorVisits.length === 0 ? (
                  <p className="text-sm text-neutral-500">No page visits recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {visitorVisits.map((visit) => (
                      <div
                        key={visit.id}
                        className="p-3 rounded border border-neutral-100 dark:border-neutral-800"
                      >
                        <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                          {visit.page_title || visit.page_url}
                        </div>
                        <div className="text-xs text-neutral-500 truncate mt-0.5">{visit.page_url}</div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral-400">
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
      {showSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowSetup(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Setup Website Tracking</h3>
              <button
                onClick={() => setShowSetup(false)}
                className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
              >
                <XIcon size={18} />
              </button>
            </div>

            <p className="text-sm text-neutral-500 mb-4">
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
              <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                <CheckIcon size={16} className="text-green-500" />
                Automatic visitor identification
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                <CheckIcon size={16} className="text-green-500" />
                Page tracking & session recording
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                <CheckIcon size={16} className="text-green-500" />
                Convert visitors to leads instantly
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

