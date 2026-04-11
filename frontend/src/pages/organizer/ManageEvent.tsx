import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Edit2, Globe, Clock, MapPin, LayoutDashboard,
  DollarSign, Target, Users, ShoppingBag,
} from "lucide-react";
import api from "../../services/api";

interface Event {
  title: string;
  status: string;
  start_date: string;
  city: string;
  venue: string;
}

export default function ManageEvent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get(`/events/${id}`)
      .then((res) => setEvent(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-primary" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent animate-spin rounded-full" />
    </div>
  );

  if (!event) return (
    <div className="min-h-screen bg-primary p-6 text-center text-red-500" style={{ background: 'var(--bg-primary)' }}>
      Event not found
    </div>
  );

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/organizer/events")}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Events
          </button>
          <button
            onClick={() => navigate(`/organizer/events/${id}/edit`)}
            className="btn-primary px-4 py-2 text-sm"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit Event
          </button>
        </div>

        {/* Event Hero */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden shadow-glow">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest text-brand-300 border border-brand-500/30" style={{ background: 'rgba(108,71,236,0.1)' }}>
                {event.status}
              </span>
            </div>
            <h1 className="font-heading font-black text-3xl sm:text-4xl text-white mb-6 uppercase tracking-tight">{event.title}</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-white/5">
              <Info icon={<Clock className="w-4 h-4 text-brand-400" />} label="Start Date" value={new Date(event.start_date).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })} />
              <Info icon={<MapPin className="w-4 h-4 text-brand-400" />} label="Location" value={`${event.venue}, ${event.city}`} />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ActionCard
            title="Bookings & Sales"
            desc="View all ticket purchases and attendee details"
            icon={<LayoutDashboard className="w-5 h-5" />}
            onClick={() => navigate(`/organizer/events/${id}/bookings`)}
          />
          <ActionCard
            title="Financials"
            desc="Balance sheet · Record expenses · Export CSV"
            icon={<DollarSign className="w-5 h-5" />}
            onClick={() => navigate(`/organizer/events/${id}/financials`)}
          />
          <ActionCard
            title="Budget"
            desc="Plan spending · Track actuals · Alert on threshold"
            icon={<Target className="w-5 h-5" />}
            onClick={() => navigate(`/organizer/events/${id}/budget`)}
          />
          <ActionCard
            title="Hire Vendors"
            desc="Browse and book approved vendors for this event"
            icon={<ShoppingBag className="w-5 h-5" />}
            onClick={() => navigate(`/organizer/events/${id}/vendors`)}
          />
          <ActionCard
            title="Attendees"
            desc="Check-in status, survey responses, certificates"
            icon={<Users className="w-5 h-5" />}
            onClick={() => navigate(`/organizer/dashboard/analytics`)}
          />
          <ActionCard
            title="Public Page"
            desc="See how your event appears to attendees"
            icon={<Globe className="w-5 h-5" />}
            onClick={() => navigate(`/event/${id}`)}
            variant="ghost"
          />
        </div>
      </div>
    </div>
  );
}

function Info({ icon, label, value }: { icon: JSX.Element, label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-10 h-10 rounded-xl bg-white/3 border border-white/5 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-sm text-slate-200 font-medium">{value}</p>
      </div>
    </div>
  );
}

function ActionCard({ title, desc, icon, onClick, variant = 'primary' }: any) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-5 rounded-2xl transition-all border group ${variant === 'primary'
          ? 'bg-brand-500/10 border-brand-500/20 hover:bg-brand-500/15'
          : 'bg-white/3 border-white/10 hover:bg-white/5'
        }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${variant === 'primary' ? 'bg-brand-500 text-white' : 'bg-white/5 text-slate-400'
        }`}>
        {icon}
      </div>
      <h3 className="text-white font-bold text-sm mb-1">{title}</h3>
      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
    </button>
  );
}
