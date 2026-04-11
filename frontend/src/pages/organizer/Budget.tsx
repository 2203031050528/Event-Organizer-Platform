import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  Target, PlusCircle, Edit3, Check, X, AlertTriangle,
  TrendingUp, BarChart2, RefreshCw, ChevronDown, ChevronUp
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BudgetCategoryItem {
  name: string;
  planned: number;
  actual: number;
  variance: number;
  pct_used: number;
  is_over: boolean;
}

interface BudgetStatus {
  event_id: string;
  total_budget: number;
  total_spent: number;
  remaining: number;
  percent_used: number;
  alert_threshold_pct: number;
  over_budget_alert: boolean;
  categories: BudgetCategoryItem[];
}

interface Budget {
  id?: string;
  total_budget: number;
  categories: { name: string; planned: number }[];
  alert_threshold: number;
}

const DEFAULT_CATEGORIES = ["Venue", "Catering", "Marketing", "AV", "Vendor", "Other"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Budget() {
  const { id: eventId } = useParams<{ id: string }>();
  const [status, setStatus] = useState<BudgetStatus | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [hasBudget, setHasBudget] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Create / Edit form state
  const [totalBudget, setTotalBudget] = useState("500000");
  const [alertThreshold, setAlertThreshold] = useState("90");
  const [categories, setCategories] = useState(
    DEFAULT_CATEGORIES.map((name) => ({ name, planned: "" as string | number }))
  );
  const [submitting, setSubmitting] = useState(false);

  const fetchBudget = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      // Try to get status (implies budget exists)
      const statusRes = await api.get(`/budget/${eventId}/status`);
      setStatus(statusRes.data);
      setHasBudget(true);

      const budgetRes = await api.get(`/budget/${eventId}`);
      setBudget(budgetRes.data);

      // Pre-populate form with existing values
      setTotalBudget(String(budgetRes.data.total_budget));
      setAlertThreshold(String(Math.round(budgetRes.data.alert_threshold * 100)));
      setCategories(
        budgetRes.data.categories.map((c: { name: string; planned: number }) => ({
          name: c.name,
          planned: String(c.planned),
        }))
      );
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setHasBudget(false);
        setStatus(null);
      } else {
        toast.error("Failed to load budget");
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { fetchBudget(); }, [fetchBudget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      total_budget: parseFloat(String(totalBudget)),
      alert_threshold: parseFloat(alertThreshold) / 100,
      categories: categories
        .filter((c) => c.name.trim())
        .map((c) => ({ name: c.name.trim(), planned: parseFloat(String(c.planned)) || 0 })),
    };
    try {
      if (hasBudget) {
        await api.put(`/budget/${eventId}`, payload);
        toast.success("Budget updated");
      } else {
        await api.post(`/budget/${eventId}`, payload);
        toast.success("Budget plan created");
      }
      setShowCreate(false);
      setEditMode(false);
      fetchBudget();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to save budget");
    } finally {
      setSubmitting(false);
    }
  };

  const updateCategoryPlanned = (idx: number, val: string) => {
    const updated = [...categories];
    updated[idx] = { ...updated[idx], planned: val };
    setCategories(updated);
  };

  const addCategoryRow = () => {
    setCategories([...categories, { name: "", planned: "" }]);
  };

  const removeCategoryRow = (idx: number) => {
    setCategories(categories.filter((_, i) => i !== idx));
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
      <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent animate-spin rounded-full" />
    </div>
  );

  const pctUsed = status?.percent_used ?? 0;
  const isAlert = status?.over_budget_alert ?? false;

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-5xl mx-auto space-y-8">

        {/* ─── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading font-black text-3xl text-white uppercase tracking-tight">Budget</h1>
            <p className="text-slate-400 text-sm mt-1">
              Plan · Track · Optimize{budget ? ` · Alert at ${Math.round(budget.alert_threshold * 100)}%` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {hasBudget && (
              <button
                onClick={fetchBudget}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            )}
            <button
              onClick={() => { setShowCreate(!showCreate); setEditMode(hasBudget); }}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-brand-500 text-white hover:bg-brand-600 transition"
              id="create-budget-btn"
            >
              {hasBudget ? <><Edit3 className="w-4 h-4" /> Edit Budget</> : <><PlusCircle className="w-4 h-4" /> Create Budget</>}
            </button>
          </div>
        </div>

        {/* ─── Alert Banner ────────────────────────────────────────────── */}
        {isAlert && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-300">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">
              ⚠ Budget alert — you have used <strong>{pctUsed}%</strong> of your budget
              (threshold: {status?.alert_threshold_pct}%). Review your expenses.
            </span>
          </div>
        )}

        {/* ─── No Budget State ─────────────────────────────────────────── */}
        {!hasBudget && !showCreate && (
          <div className="glass-card rounded-2xl p-12 border border-white/5 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
              <Target className="w-8 h-8 text-brand-400" />
            </div>
            <h2 className="text-white font-bold text-xl">No Budget Plan Yet</h2>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              Create a budget plan to track planned vs actual spending in real-time across categories.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary px-6 py-2.5 text-sm"
              id="start-budget-btn"
            >
              <PlusCircle className="w-4 h-4" /> Create Budget Plan
            </button>
          </div>
        )}

        {/* ─── Create / Edit Form ──────────────────────────────────────── */}
        {showCreate && (
          <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="w-full flex items-center justify-between p-5 text-white font-bold"
            >
              <span>{hasBudget && editMode ? "Edit Budget Plan" : "New Budget Plan"}</span>
              {showCreate ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            <form onSubmit={handleSubmit} className="p-5 pt-0 space-y-5 border-t border-white/5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Budget (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={totalBudget}
                    onChange={(e) => setTotalBudget(e.target.value)}
                    required
                    id="total-budget-input"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Alert at % used</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="10"
                      max="100"
                      value={alertThreshold}
                      onChange={(e) => setAlertThreshold(e.target.value)}
                      id="alert-threshold-input"
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-brand-500 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                  </div>
                </div>
              </div>

              {/* Category Allocations */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Category Allocations</p>
                  <button type="button" onClick={addCategoryRow} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                    <PlusCircle className="w-3.5 h-3.5" /> Add Row
                  </button>
                </div>
                {categories.map((cat, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Category name"
                      value={cat.name}
                      onChange={(e) => {
                        const updated = [...categories];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setCategories(updated);
                      }}
                      className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-brand-500"
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Planned ₹"
                      value={cat.planned}
                      onChange={(e) => updateCategoryPlanned(idx, e.target.value)}
                      className="w-32 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-brand-500"
                    />
                    <button type="button" onClick={() => removeCategoryRow(idx)} className="text-slate-600 hover:text-rose-400 transition">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  id="save-budget-btn"
                  className="px-6 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-bold hover:bg-brand-600 transition disabled:opacity-60"
                >
                  {submitting ? "Saving…" : hasBudget ? "Update Budget" : "Create Budget"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─── Budget Status Dashboard ─────────────────────────────────── */}
        {hasBudget && status && (
          <>
            {/* Overall Gauge */}
            <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-brand-400" /> Overall Utilization
                </h2>
                <span className={`text-2xl font-black ${pctUsed >= (status.alert_threshold_pct) ? "text-orange-400" : "text-emerald-400"}`}>
                  {pctUsed}%
                </span>
              </div>

              {/* Track bar */}
              <div className="space-y-2">
                <div className="h-4 rounded-full bg-white/5 overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      pctUsed >= status.alert_threshold_pct
                        ? "bg-gradient-to-r from-orange-500 to-red-500"
                        : "bg-gradient-to-r from-brand-500 to-violet-500"
                    }`}
                    style={{ width: `${Math.min(pctUsed, 100)}%` }}
                  />
                  {/* Alert threshold marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-orange-400/60"
                    style={{ left: `${status.alert_threshold_pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>₹0</span>
                  <span className="text-orange-400/70">Alert at {status.alert_threshold_pct}%</span>
                  <span>{fmt(status.total_budget)}</span>
                </div>
              </div>

              {/* Totals row */}
              <div className="grid grid-cols-3 divide-x divide-white/5">
                <Stat label="Total Budget" value={fmt(status.total_budget)} />
                <Stat label="Spent" value={fmt(status.total_spent)} />
                <Stat label="Remaining" value={fmt(status.remaining)} highlight={status.remaining < 0} />
              </div>
            </div>

            {/* Per-category breakdown */}
            {status.categories.length > 0 && (
              <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-brand-400" /> Category Breakdown
                </h2>
                <div className="space-y-1">
                  {/* Table header */}
                  <div className="grid grid-cols-5 gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1 pb-2 border-b border-white/5">
                    <span className="col-span-2">Category</span>
                    <span className="text-right">Planned</span>
                    <span className="text-right">Actual</span>
                    <span className="text-right">Variance</span>
                  </div>

                  {status.categories.map((cat) => (
                    <div key={cat.name} className="grid grid-cols-5 gap-2 items-center py-3 border-b border-white/3">
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          {cat.is_over
                            ? <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                            : <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          }
                          <div>
                            <p className="text-sm text-white font-medium">{cat.name}</p>
                            <div className="mt-1 h-1 rounded-full bg-white/5 w-24 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${cat.is_over ? "bg-orange-500" : "bg-emerald-500"}`}
                                style={{ width: `${Math.min(cat.pct_used, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <span className="text-right text-sm text-slate-400">{fmt(cat.planned)}</span>
                      <span className="text-right text-sm text-white font-medium">{fmt(cat.actual)}</span>
                      <span className={`text-right text-sm font-bold ${cat.variance >= 0 ? "text-emerald-400" : "text-orange-400"}`}>
                        {cat.variance >= 0 ? "+" : ""}{fmt(cat.variance)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center px-4 py-2">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-lg font-black ${highlight ? "text-rose-400" : "text-white"}`}>{value}</p>
    </div>
  );
}
