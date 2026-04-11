import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMyEvents,
  getEventTickets,
  updateEvent,
  deleteEvent,
  createTicket,
  updateTicket,
  deleteTicket,
} from "../services/api";
import api from "../services/api";
import toast from "react-hot-toast";
import {
  Plus, Edit2, Trash2, ChevronDown, ChevronUp,
  Eye, Users, Tag, Calendar, MapPin, X, Save, Check,
  Loader2, Ticket, Copy,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgEvent {
  event_id: string;
  title: string;
  date: string;
  location: string;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED";
  total_bookings: number;
}

interface FullEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  start_date: string;
  end_date: string;
  city: string;
  venue: string;
  status: string;
}

interface TicketType {
  _id: string;
  title: string;
  price: number;
  quantity: number;
  sold: number;
  event_id: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PUBLISHED: { label: "Published", className: "text-emerald-400 border-emerald-500/30" },
  DRAFT: { label: "Draft", className: "text-amber-400 border-amber-500/30" },
  CANCELLED: { label: "Cancelled", className: "text-red-400 border-red-500/30" },
};

function formatDate(raw: any): string {
  if (!raw) return "—";
  const iso = typeof raw === "object" && raw.$date ? raw.$date : raw;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const inputCls = "input-glass w-full text-sm py-2.5";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MyEvents() {
  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<FullEvent | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { load(); }, []);

  const load = () => {
    setLoading(true);
    getMyEvents().then(setEvents).finally(() => setLoading(false));
  };

  const handleToggleStatus = async (ev: OrgEvent) => {
    const next = ev.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    await updateEvent(ev.event_id, { status: next });
    setEvents(prev => prev.map(e => e.event_id === ev.event_id ? { ...e, status: next } : e));
    toast.success(`Event ${next === "PUBLISHED" ? "published" : "unpublished"}`);
  };

  const handleDelete = async (ev: OrgEvent) => {
    if (!confirm(`Delete "${ev.title}"? This cannot be undone.`)) return;
    try {
      await deleteEvent(ev.event_id);
      setEvents(prev => prev.filter(e => e.event_id !== ev.event_id));
      toast.success("Event deleted");
    } catch {
      toast.error("Failed to delete event");
    }
  };

  const handleOpenEdit = async (ev: OrgEvent) => {
    setEditLoading(true);
    try {
      const res = await api.get(`/events/${ev.event_id}`);
      setEditingEvent(res.data);
    } catch {
      toast.error("Could not load event details");
    } finally {
      setEditLoading(false);
    }
  };

  const handleSaveEdit = async (updated: FullEvent) => {
    await updateEvent(updated.id, {
      title: updated.title, description: updated.description,
      category: updated.category, tags: updated.tags,
      start_date: updated.start_date, end_date: updated.end_date,
      city: updated.city, venue: updated.venue,
    });
    setEvents(prev => prev.map(e =>
      e.event_id === updated.id ? { ...e, title: updated.title, location: updated.city } : e
    ));
    setEditingEvent(null);
    toast.success("Event updated");
  };

  const handleDuplicate = (ev: OrgEvent) => {
    const duplicate: OrgEvent = {
      ...ev,
      event_id: `dup-${Date.now()}`,
      title: `Copy of ${ev.title}`,
      status: 'DRAFT',
      total_bookings: 0,
    };
    setEvents(prev => [duplicate, ...prev]);
    toast.success(`"${ev.title}" duplicated as Draft!`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-3 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
        <span className="text-sm">Loading events…</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-black text-2xl sm:text-3xl text-[var(--text-primary)]">My Events</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-0.5">{events.length} event{events.length !== 1 ? "s" : ""} created</p>
        </div>
        <button
          onClick={() => navigate("/create-event")}
          className="btn-primary px-4 py-2 text-sm"
        >
          <Plus className="w-4 h-4" /> New Event
        </button>
      </div>

      {/* Empty state */}
      {!events.length && (
        <div className="glass-card rounded-2xl text-center py-20 space-y-3">
          <Calendar className="w-12 h-12 text-[var(--text-muted)] mx-auto" />
          <p className="text-[var(--text-primary)] text-lg font-semibold">No events yet</p>
          <p className="text-[var(--text-secondary)] text-sm">Click "New Event" to create your first one.</p>
        </div>
      )}

      {/* Event Cards */}
      <div className="space-y-4">
        {events.map((ev) => (
          <EventCard
            key={ev.event_id}
            event={ev}
            isExpanded={expandedId === ev.event_id}
            onToggleExpand={() => setExpandedId(expandedId === ev.event_id ? null : ev.event_id)}
            onEdit={() => handleOpenEdit(ev)}
            onDelete={() => handleDelete(ev)}
            onToggleStatus={() => handleToggleStatus(ev)}
            onViewBookings={() => navigate(`/organizer/events/${ev.event_id}/bookings`)}
            onDuplicate={() => handleDuplicate(ev)}
            onManage={() => navigate(`/organizer/events/${ev.event_id}`)}
          />
        ))}
      </div>

      {/* Edit loading overlay */}
      {editLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.6)] backdrop-blur-sm">
          <div className="glass-card rounded-2xl px-8 py-6 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
            <span className="text-sm text-[var(--text-primary)]">Loading event…</span>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({
  event, isExpanded, onToggleExpand, onEdit, onDelete, onToggleStatus, onViewBookings, onDuplicate, onManage,
}: {
  event: OrgEvent;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onViewBookings: () => void;
  onDuplicate: () => void;
  onManage: () => void;
}) {
  const cfg = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.DRAFT;
  return (
    <div className="glass-card rounded-2xl overflow-hidden transition-all duration-200">
      <div className="p-5">
        <div className="flex flex-wrap items-start gap-3">
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${cfg.className}`}
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                {cfg.label}
              </span>
            </div>
            <h2 className="font-heading font-bold text-lg text-[var(--text-primary)] truncate">{event.title}</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-[var(--text-secondary)]">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(event.date)}</span>
              {event.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.location}</span>}
              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {event.total_bookings} booking{event.total_bookings !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Manage button — primary CTA */}
            <button
              onClick={onManage}
              id={`manage-btn-${event.event_id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white rounded-xl transition-colors"
              style={{ background: 'rgba(108,71,236,0.5)', border: '1px solid rgba(108,71,236,0.6)' }}
            >
              Manage →
            </button>
            {/* Publish/Unpublish toggle */}
            {event.status !== "CANCELLED" && (
              <button
                onClick={onToggleStatus}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${event.status === "PUBLISHED"
                  ? "text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                  : "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                  }`}
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                {event.status === "PUBLISHED" ? "Unpublish" : "Publish"}
              </button>
            )}
            <button
              onClick={onDuplicate}
              title="Duplicate Event"
              className="p-2 text-[var(--text-muted)] hover:text-amber-300 rounded-xl transition-colors"
              style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={onViewBookings}
              title="View Bookings"
              className="p-2 text-[var(--text-muted)] hover:text-brand-300 rounded-xl transition-colors"
              style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={onEdit}
              title="Edit Event"
              className="p-2 text-[var(--text-muted)] hover:text-blue-300 rounded-xl transition-colors"
              style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              title="Delete Event"
              className="p-2 text-[var(--text-muted)] hover:text-red-400 rounded-xl transition-colors"
              style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleExpand}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-300 rounded-xl border border-brand-500/30 hover:bg-brand-500/10 transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <Tag className="w-3 h-3" /> Tickets {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>

      {/* Tickets panel */}
      {isExpanded && (
        <div className="border-t px-5 py-4" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
          <TicketManager eventId={event.event_id} />
        </div>
      )}
    </div>
  );
}

// ─── Ticket Manager ───────────────────────────────────────────────────────────

const BLANK_FORM = () => ({ title: "", price: 0, quantity: 100 });

function TicketManager({ eventId }: { eventId: string }) {
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTicket, setEditingTicket] = useState<TicketType | null>(null);
  const [form, setForm] = useState(BLANK_FORM());
  const [saving, setSaving] = useState(false);

  useEffect(() => { getEventTickets(eventId).then(setTickets).finally(() => setLoading(false)); }, [eventId]);

  const openAdd = () => { setEditingTicket(null); setForm(BLANK_FORM()); setShowForm(true); };
  const openEdit = (t: TicketType) => { setEditingTicket(t); setForm({ title: t.title, price: t.price, quantity: t.quantity }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Ticket name required"); return; }
    setSaving(true);
    try {
      if (editingTicket) {
        await updateTicket(editingTicket._id, { ...form, event_id: eventId });
        setTickets(prev => prev.map(t => t._id === editingTicket._id ? { ...t, ...form } : t));
        toast.success("Ticket updated");
      } else {
        await createTicket({ ...form, event_id: eventId });
        const fresh = await getEventTickets(eventId);
        setTickets(fresh);
        toast.success("Ticket added");
      }
      setShowForm(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Failed to save ticket");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: TicketType) => {
    if (!confirm(`Delete ticket "${t.title}"?`)) return;
    await deleteTicket(t._id);
    setTickets(prev => prev.filter(x => x._id !== t._id));
    toast.success("Ticket deleted");
  };

  if (loading) return <p className="text-sm text-[var(--text-muted)] py-2">Loading tickets…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
          <Ticket className="w-3.5 h-3.5 text-brand-400" /> Ticket Types ({tickets.length})
        </h3>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-xl transition-colors"
          style={{ background: 'rgba(108,71,236,0.3)', border: '1px solid rgba(108,71,236,0.4)' }}>
          <Plus className="w-3.5 h-3.5" /> Add Ticket
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--glass-hover)', border: '1px solid var(--glass-border)' }}>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{editingTicket ? "Edit Ticket" : "New Ticket Type"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3">
              <label className="text-xs text-slate-500 mb-1 block">Ticket Name *</label>
              <input className={inputCls} placeholder="e.g. General Admission, VIP" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Price (₹)</label>
              <input type="number" min={0} className={inputCls} value={form.price}
                onChange={(e) => setForm({ ...form, price: +e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Total Quantity</label>
              <input type="number" min={1} className={inputCls} value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: +e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs text-[var(--text-muted)] rounded-xl border border-[var(--glass-border)] hover:text-[var(--text-primary)] transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white rounded-xl transition-colors disabled:opacity-50"
              style={{ background: 'rgba(108,71,236,0.4)', border: '1px solid rgba(108,71,236,0.5)' }}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {!tickets.length && !showForm && (
        <p className="text-sm text-slate-500 py-2">No ticket types yet. Click "Add Ticket" to create one.</p>
      )}

      <div className="space-y-2">
        {tickets.map((t) => {
          const pct = t.quantity > 0 ? Math.min(100, Math.round(((t.sold ?? 0) / t.quantity) * 100)) : 0;
          return (
            <div key={t._id} className="rounded-xl px-4 py-3 flex flex-wrap gap-3 items-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-semibold text-sm text-white">{t.title}</span>
                  <span className="text-xs text-brand-300 font-bold">₹{t.price.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #6c47ec, #4f46e5)' }} />
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap">{t.sold ?? 0}/{t.quantity} sold</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(t)}
                  className="p-1.5 text-slate-500 hover:text-blue-300 rounded-lg transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(t)}
                  className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Edit Event Modal ─────────────────────────────────────────────────────────

function EditEventModal({ event, onClose, onSave }: {
  event: FullEvent;
  onClose: () => void;
  onSave: (ev: FullEvent) => Promise<void>;
}) {
  const [form, setForm] = useState<FullEvent>({ ...event });
  const [saving, setSaving] = useState(false);

  const set = (key: keyof FullEvent, val: any) => setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  const toLocal = (iso: string) => {
    try { return new Date(iso).toISOString().slice(0, 16); } catch { return ""; }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--glass-border)' }}>
          <h2 className="font-heading font-bold text-[var(--text-primary)] text-lg">Edit Event</h2>
          <button onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl transition-colors"
            style={{ background: 'var(--glass-bg)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
          {/* Basic Info section */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Basic Info</p>
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Event Title</label>
              <input className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Description</label>
              <textarea className={`${inputCls} resize-none`} rows={3} value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Category</label>
                <input className={inputCls} value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Tags (comma-separated)</label>
                <input className={inputCls} value={form.tags?.join(", ") ?? ""}
                  onChange={(e) => set("tags", e.target.value.split(",").map(t => t.trim()).filter(Boolean))} />
              </div>
            </div>
          </div>

          {/* Date & Location section */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Date & Location</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Start Date & Time</label>
                <input type="datetime-local" className={inputCls} value={toLocal(form.start_date)}
                  onChange={(e) => set("start_date", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">End Date & Time</label>
                <input type="datetime-local" className={inputCls} value={toLocal(form.end_date)}
                  onChange={(e) => set("end_date", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">City</label>
                <input className={inputCls} value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Venue</label>
                <input className={inputCls} value={form.venue ?? ""} onChange={(e) => set("venue", e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-[var(--text-muted)] rounded-xl border border-[var(--glass-border)] hover:text-[var(--text-primary)] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="btn-primary px-5 py-2 text-sm disabled:opacity-60 disabled:transform-none">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
