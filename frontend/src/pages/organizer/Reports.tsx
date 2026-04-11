import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  BarChart3, Users, IndianRupee, TrendingUp, CheckCircle,
  ShoppingBag, MessageSquare, RefreshCw, Download, Mail
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from "recharts";
import api from "../../services/api";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttendanceData {
  total_bookings: number;
  total_tickets_sold: number;
  checked_in: number;
  not_checked_in: number;
  checkin_rate: number;
  by_ticket: { ticket_name: string; tickets_sold: number; revenue: number; bookings: number }[];
  daily_trend: { date: string; bookings: number; tickets: number }[];
}

interface RevenueData {
  gross_revenue: number;
  total_discount_given: number;
  net_revenue: number;
  total_bookings: number;
  avg_order_value: number;
  refunded_amount: number;
  refund_count: number;
  total_expenses: number;
  profit: number;
  daily_revenue: { date: string; revenue: number; bookings: number }[];
}

interface VendorRow {
  vendor_id: string;
  business_name: string;
  category: string;
  total_amount: number;
  booking_count: number;
  confirmed: number;
  pending: number;
  rejected: number;
  avg_rating: number;
}

interface VendorData {
  total_vendor_spend: number;
  vendor_count: number;
  vendors: VendorRow[];
}

interface EngagementData {
  survey_responses: number;
  has_survey: boolean;
  email_blast_count: number;
  email_blasts: { subject: string; recipients: number; failed: number; sent_at: string }[];
  transport: { total: number; total_fare: number };
}

// ─── Chart Config ─────────────────────────────────────────────────────────────

const COLORS = ["#6c47ec", "#4f46e5", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

const CHART_TOOLTIP = {
  contentStyle: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--glass-border)",
    borderRadius: "12px",
    color: "var(--text-primary)",
    fontSize: 12,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Reports() {
  const { id: eventId } = useParams<{ id: string }>();
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [vendors, setVendors] = useState<VendorData | null>(null);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"attendance" | "revenue" | "vendors" | "engagement">("attendance");

  const fetchAll = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const [a, r, v, e] = await Promise.all([
        api.get(`/reports/${eventId}/attendance`),
        api.get(`/reports/${eventId}/revenue`),
        api.get(`/reports/${eventId}/vendors`),
        api.get(`/reports/${eventId}/engagement`),
      ]);
      setAttendance(a.data);
      setRevenue(r.data);
      setVendors(v.data);
      setEngagement(e.data);
    } catch {
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  const handleExportCSV = async () => {
    try {
      const res = await api.get(`/financials/${eventId}/export?format=csv`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `report_${eventId?.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch {
      toast.error("Export failed");
    }
  };

  const tabs = [
    { key: "attendance" as const, label: "Attendance", icon: <Users className="w-4 h-4" /> },
    { key: "revenue" as const, label: "Revenue", icon: <IndianRupee className="w-4 h-4" /> },
    { key: "vendors" as const, label: "Vendors", icon: <ShoppingBag className="w-4 h-4" /> },
    { key: "engagement" as const, label: "Engagement", icon: <MessageSquare className="w-4 h-4" /> },
  ];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
      <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent animate-spin rounded-full" />
    </div>
  );

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ─── Header ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading font-black text-3xl text-white uppercase tracking-tight">Event Report</h1>
            <p className="text-slate-400 text-sm mt-1">Attendance · Revenue · Vendors · Engagement</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-brand-500 text-white hover:bg-brand-600 transition">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>

        {/* ─── Tabs ──────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-white/3 rounded-2xl p-1 border border-white/5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === t.key
                  ? "bg-brand-500 text-white shadow-lg"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ─── Tab Content ───────────────────────────────────────────── */}
        {activeTab === "attendance" && attendance && <AttendanceTab data={attendance} fmt={fmt} />}
        {activeTab === "revenue" && revenue && <RevenueTab data={revenue} fmt={fmt} />}
        {activeTab === "vendors" && vendors && <VendorsTab data={vendors} fmt={fmt} />}
        {activeTab === "engagement" && engagement && <EngagementTab data={engagement} />}
      </div>
    </div>
  );
}

// ─── Attendance Tab ──────────────────────────────────────────────────────────

function AttendanceTab({ data, fmt }: { data: AttendanceData; fmt: (n: number) => string }) {
  const checkinPie = [
    { name: "Checked In", value: data.checked_in },
    { name: "Not Checked In", value: data.not_checked_in },
  ];

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPI label="Confirmed Bookings" value={String(data.total_bookings)} icon={<CheckCircle className="w-5 h-5" />} color="text-emerald-400" />
        <KPI label="Tickets Sold" value={String(data.total_tickets_sold)} icon={<Users className="w-5 h-5" />} color="text-brand-400" />
        <KPI label="Checked In" value={String(data.checked_in)} icon={<CheckCircle className="w-5 h-5" />} color="text-sky-400" />
        <KPI label="Check-in Rate" value={`${data.checkin_rate}%`} icon={<TrendingUp className="w-5 h-5" />} color="text-amber-400" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registration trend */}
        <div className="glass-card rounded-2xl p-6 border border-white/5">
          <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-400" /> Daily Registrations
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.daily_trend}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <Tooltip {...CHART_TOOLTIP} />
                <Line type="monotone" dataKey="bookings" stroke="#6c47ec" strokeWidth={2.5} dot={false} name="Bookings" />
                <Line type="monotone" dataKey="tickets" stroke="#3b82f6" strokeWidth={2} dot={false} name="Tickets" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Check-in pie */}
        <div className="glass-card rounded-2xl p-6 border border-white/5">
          <h3 className="text-white font-bold text-sm mb-4">Check-in Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={checkinPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85}>
                  {checkinPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP.contentStyle} />
                <Legend wrapperStyle={{ color: "var(--text-muted)", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Ticket breakdown table */}
      {data.by_ticket.length > 0 && (
        <div className="glass-card rounded-2xl p-6 border border-white/5">
          <h3 className="text-white font-bold text-sm mb-4">By Ticket Type</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {["Ticket", "Bookings", "Sold", "Revenue"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.by_ticket.map((t) => (
                  <tr key={t.ticket_name} className="border-b border-white/3 hover:bg-white/3 transition">
                    <td className="px-4 py-3 text-white font-medium">{t.ticket_name}</td>
                    <td className="px-4 py-3 text-slate-400">{t.bookings}</td>
                    <td className="px-4 py-3 text-slate-400">{t.tickets_sold}</td>
                    <td className="px-4 py-3 text-brand-300 font-bold">{fmt(t.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Revenue Tab ─────────────────────────────────────────────────────────────

function RevenueTab({ data, fmt }: { data: RevenueData; fmt: (n: number) => string }) {
  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPI label="Gross Revenue" value={fmt(data.gross_revenue)} icon={<IndianRupee className="w-5 h-5" />} color="text-emerald-400" />
        <KPI label="Avg Order" value={fmt(data.avg_order_value)} icon={<BarChart3 className="w-5 h-5" />} color="text-brand-400" />
        <KPI label="Discounts Given" value={fmt(data.total_discount_given)} icon={<TrendingUp className="w-5 h-5" />} color="text-amber-400" />
        <KPI label="Net Profit" value={fmt(data.profit)} icon={<IndianRupee className="w-5 h-5" />} color={data.profit >= 0 ? "text-emerald-400" : "text-rose-400"} />
      </div>

      {/* Revenue trend chart */}
      <div className="glass-card rounded-2xl p-6 border border-white/5">
        <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-400" /> Daily Revenue
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.daily_revenue}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v) => `₹${v}`} axisLine={false} tickLine={false} />
              <Tooltip {...CHART_TOOLTIP} formatter={(value: number | undefined) => [`₹${value ?? 0}`, "Revenue"]} />
              <Bar dataKey="revenue" fill="#6c47ec" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Financial summary card */}
      <div className="glass-card rounded-2xl p-6 border border-white/5">
        <h3 className="text-white font-bold text-sm mb-4">Financial Summary</h3>
        <div className="space-y-3">
          <SummaryRow label="Gross Revenue" value={fmt(data.gross_revenue)} positive />
          <SummaryRow label="Discounts Given" value={`-${fmt(data.total_discount_given)}`} />
          <SummaryRow label="Net Revenue" value={fmt(data.net_revenue)} positive />
          <div className="border-t border-white/5 pt-3" />
          <SummaryRow label="Total Expenses" value={`-${fmt(data.total_expenses)}`} />
          {data.refund_count > 0 && <SummaryRow label={`Refunds (${data.refund_count})`} value={`-${fmt(data.refunded_amount)}`} />}
          <div className="border-t border-white/5 pt-3" />
          <SummaryRow label="Net Profit" value={fmt(data.profit)} positive={data.profit >= 0} bold />
        </div>
      </div>
    </div>
  );
}

// ─── Vendors Tab ─────────────────────────────────────────────────────────────

function VendorsTab({ data, fmt }: { data: VendorData; fmt: (n: number) => string }) {
  if (data.vendor_count === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 border border-white/5 text-center">
        <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-slate-600" />
        <p className="text-white font-bold">No Vendor Bookings</p>
        <p className="text-slate-500 text-sm mt-1">Vendors hired for this event will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <KPI label="Total Vendor Spend" value={fmt(data.total_vendor_spend)} icon={<ShoppingBag className="w-5 h-5" />} color="text-brand-400" />
        <KPI label="Vendors Hired" value={String(data.vendor_count)} icon={<Users className="w-5 h-5" />} color="text-emerald-400" />
      </div>

      <div className="glass-card rounded-2xl p-6 border border-white/5">
        <h3 className="text-white font-bold text-sm mb-4">Vendor Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {["Vendor", "Category", "Amount", "Bookings", "Status", "Rating"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.vendors.map((v) => (
                <tr key={v.vendor_id} className="border-b border-white/3 hover:bg-white/3 transition">
                  <td className="px-4 py-3 text-white font-medium">{v.business_name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{v.category}</td>
                  <td className="px-4 py-3 text-brand-300 font-bold">{fmt(v.total_amount)}</td>
                  <td className="px-4 py-3 text-slate-400">{v.booking_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 text-xs">
                      {v.confirmed > 0 && <span className="text-emerald-400">{v.confirmed}✓</span>}
                      {v.pending > 0 && <span className="text-amber-400">{v.pending}⏳</span>}
                      {v.rejected > 0 && <span className="text-rose-400">{v.rejected}✗</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-amber-400 font-bold">★ {v.avg_rating.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Engagement Tab ──────────────────────────────────────────────────────────

function EngagementTab({ data }: { data: EngagementData }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPI label="Survey Responses" value={String(data.survey_responses)} icon={<MessageSquare className="w-5 h-5" />} color="text-brand-400" />
        <KPI label="Email Blasts" value={String(data.email_blast_count)} icon={<Mail className="w-5 h-5" />} color="text-sky-400" />
        <KPI label="Transport Bookings" value={String(data.transport.total)} icon={<Users className="w-5 h-5" />} color="text-emerald-400" />
        <KPI label="Transport Revenue" value={`₹${data.transport.total_fare}`} icon={<IndianRupee className="w-5 h-5" />} color="text-amber-400" />
      </div>

      {/* Email blast history */}
      {data.email_blasts.length > 0 && (
        <div className="glass-card rounded-2xl p-6 border border-white/5">
          <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
            <Mail className="w-4 h-4 text-sky-400" /> Email Blast History
          </h3>
          <div className="space-y-2">
            {data.email_blasts.map((blast, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/3 border border-white/5">
                <div>
                  <p className="text-sm text-white font-medium">{blast.subject}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {blast.recipients} recipients · {blast.failed > 0 ? `${blast.failed} failed` : "all delivered"}
                  </p>
                </div>
                <span className="text-xs text-slate-500">
                  {blast.sent_at ? new Date(blast.sent_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!data.has_survey && (
        <div className="glass-card rounded-2xl p-8 border border-white/5 text-center">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          <p className="text-slate-400 text-sm">No survey configured for this event yet.</p>
        </div>
      )}
    </div>
  );
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function KPI({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="glass-card rounded-2xl p-5 border border-white/5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-white/5 ${color}`}>
        {icon}
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}

function SummaryRow({ label, value, positive, bold }: { label: string; value: string; positive?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${bold ? "text-white font-bold" : "text-slate-400"}`}>{label}</span>
      <span className={`text-sm font-bold ${positive ? "text-emerald-400" : "text-slate-300"} ${bold ? "text-lg" : ""}`}>{value}</span>
    </div>
  );
}
