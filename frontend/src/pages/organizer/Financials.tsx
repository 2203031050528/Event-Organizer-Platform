import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  DollarSign, TrendingUp, TrendingDown, PlusCircle, Trash2,
  Download, RefreshCw, Receipt, ChevronDown, ChevronUp, Upload
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

interface IncomeBreakdown {
  ticket_income: number;
  vendor_income: number;
  total_income: number;
  confirmed_bookings: number;
}

interface ExpenseCategory {
  category: string;
  amount: number;
  count: number;
}

interface ExpenseSummary {
  total_expenses: number;
  by_category: ExpenseCategory[];
}

interface BalanceSheet {
  event_id: string;
  income: IncomeBreakdown;
  expenses: ExpenseSummary;
  net_profit: number;
  is_profitable: boolean;
}

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  receipt_url?: string;
  created_at: string;
}

const EXPENSE_CATEGORIES = ["VENUE", "CATERING", "MARKETING", "VENDOR", "AV", "OTHER"];

const CATEGORY_COLORS: Record<string, string> = {
  VENUE: "from-violet-500 to-purple-600",
  CATERING: "from-orange-400 to-amber-500",
  MARKETING: "from-sky-400 to-blue-500",
  VENDOR: "from-emerald-400 to-teal-500",
  AV: "from-pink-400 to-rose-500",
  OTHER: "from-slate-400 to-slate-500",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Financials() {
  const { id: eventId } = useParams<{ id: string }>();
  const [sheet, setSheet] = useState<BalanceSheet | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterCat, setFilterCat] = useState("");

  const [form, setForm] = useState({
    category: "OTHER",
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    receipt_url: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const [sheetRes, expRes] = await Promise.all([
        api.get(`/financials/${eventId}/balance-sheet`),
        api.get(`/financials/${eventId}/expenses`),
      ]);
      setSheet(sheetRes.data);
      setExpenses(expRes.data);
    } catch {
      toast.error("Failed to load financial data");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.amount) return;
    setSubmitting(true);
    try {
      await api.post(`/financials/${eventId}/expenses`, {
        category: form.category,
        description: form.description,
        amount: parseFloat(form.amount),
        date: new Date(form.date).toISOString(),
        receipt_url: form.receipt_url || null,
      });
      toast.success("Expense added");
      setForm({ category: "OTHER", description: "", amount: "", date: new Date().toISOString().split("T")[0], receipt_url: "" });
      setShowForm(false);
      fetchAll();
    } catch {
      toast.error("Failed to add expense");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (expenseId: string) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await api.delete(`/financials/${eventId}/expenses/${expenseId}`);
      toast.success("Expense deleted");
      fetchAll();
    } catch {
      toast.error("Failed to delete expense");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/financials/${eventId}/export?format=csv`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `financials_${eventId?.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  const filteredExpenses = filterCat
    ? expenses.filter((e) => e.category === filterCat)
    : expenses;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
      <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent animate-spin rounded-full" />
    </div>
  );

  const net = sheet?.net_profit ?? 0;
  const totalIncome = sheet?.income.total_income ?? 0;
  const totalExpenses = sheet?.expenses.total_expenses ?? 0;

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ─── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading font-black text-3xl text-white uppercase tracking-tight">Financials</h1>
            <p className="text-slate-400 text-sm mt-1">Balance sheet · Income vs expenses</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchAll}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-brand-500 text-white hover:bg-brand-600 transition disabled:opacity-60"
            >
              <Download className="w-4 h-4" /> {exporting ? "Exporting…" : "Export CSV"}
            </button>
          </div>
        </div>

        {/* ─── KPI Cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPICard
            label="Total Income"
            value={fmt(totalIncome)}
            sub={`${sheet?.income.confirmed_bookings ?? 0} confirmed bookings`}
            icon={<TrendingUp className="w-5 h-5" />}
            color="from-emerald-500/20 to-teal-500/10"
            iconColor="text-emerald-400"
          />
          <KPICard
            label="Total Expenses"
            value={fmt(totalExpenses)}
            sub={`${sheet?.expenses.by_category.length ?? 0} categories`}
            icon={<Receipt className="w-5 h-5" />}
            color="from-rose-500/20 to-pink-500/10"
            iconColor="text-rose-400"
          />
          <KPICard
            label="Net Profit"
            value={fmt(net)}
            sub={net >= 0 ? "In the green ✓" : "Over budget ✗"}
            icon={net >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            color={net >= 0 ? "from-brand-500/20 to-violet-500/10" : "from-orange-500/20 to-red-500/10"}
            iconColor={net >= 0 ? "text-brand-400" : "text-orange-400"}
          />
        </div>

        {/* ─── Income Breakdown ───────────────────────────────────────── */}
        <div className="glass-card rounded-2xl p-6 border border-white/5">
          <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" /> Income Breakdown
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <IncomeRow label="Ticket & Addon Sales" amount={sheet?.income.ticket_income ?? 0} fmt={fmt} />
            <IncomeRow label="Vendor Bookings" amount={sheet?.income.vendor_income ?? 0} fmt={fmt} />
          </div>
        </div>

        {/* ─── Expense Categories ──────────────────────────────────────── */}
        {(sheet?.expenses.by_category.length ?? 0) > 0 && (
          <div className="glass-card rounded-2xl p-6 border border-white/5">
            <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-rose-400" /> Expense Breakdown
            </h2>
            <div className="space-y-3">
              {sheet!.expenses.by_category.map((cat) => {
                const pct = totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0;
                const gradient = CATEGORY_COLORS[cat.category] ?? CATEGORY_COLORS.OTHER;
                return (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-300 font-medium">{cat.category}</span>
                      <span className="text-white font-bold">{fmt(cat.amount)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Add Expense Form ────────────────────────────────────────── */}
        <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full flex items-center justify-between p-5 text-white font-bold hover:bg-white/3 transition"
          >
            <span className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-brand-400" /> Add Expense
            </span>
            {showForm ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showForm && (
            <form onSubmit={handleAddExpense} className="p-5 pt-0 space-y-4 border-t border-white/5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-brand-500"
                    id="expense-category"
                  >
                    {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                    id="expense-amount"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Venue rental for main hall"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    required
                    id="expense-description"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                    id="expense-date"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Receipt URL (optional)</label>
                  <input
                    type="url"
                    placeholder="https://…"
                    value={form.receipt_url}
                    onChange={(e) => setForm({ ...form, receipt_url: e.target.value })}
                    id="expense-receipt"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  id="submit-expense-btn"
                  className="px-6 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-bold hover:bg-brand-600 transition disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Save Expense"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ─── Expenses List ───────────────────────────────────────────── */}
        <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-white font-bold text-lg">All Expenses</h2>
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              id="expense-filter"
              className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm focus:outline-none"
            >
              <option value="">All Categories</option>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No expenses recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredExpenses.map((exp) => (
                <div key={exp.id} className="py-3 flex items-start justify-between gap-3 group">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 bg-gradient-to-br ${CATEGORY_COLORS[exp.category] ?? CATEGORY_COLORS.OTHER}`} />
                    <div>
                      <p className="text-sm text-white font-medium">{exp.description}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {exp.category} · {new Date(exp.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-white font-bold text-sm">{fmt(exp.amount)}</span>
                    {exp.receipt_url && (
                      <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer" title="View receipt">
                        <Upload className="w-3.5 h-3.5 text-slate-500 hover:text-brand-400 rotate-180 transition" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(exp.id)}
                      className="opacity-0 group-hover:opacity-100 transition text-slate-600 hover:text-rose-400"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPICard({ label, value, sub, icon, color, iconColor }: {
  label: string; value: string; sub: string; icon: React.ReactNode; color: string; iconColor: string;
}) {
  return (
    <div className={`glass-card rounded-2xl p-5 border border-white/5 bg-gradient-to-br ${color}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-white/5 ${iconColor}`}>
        {icon}
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</p>
      <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}

function IncomeRow({ label, amount, fmt }: { label: string; amount: number; fmt: (n: number) => string }) {
  return (
    <div className="p-4 rounded-xl bg-white/3 border border-white/5">
      <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">{label}</p>
      <p className="text-xl font-black text-white">{fmt(amount)}</p>
    </div>
  );
}
