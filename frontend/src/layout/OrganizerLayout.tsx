import { type ReactNode, useState } from "react";
import {
  LayoutDashboard, Users, Calendar, UserCircle2, Ticket, ArrowLeft, Menu, X, Zap
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

type Props = {
  children: ReactNode;
  activeSection: string;
  onSelectSection: (section: string) => void;
};

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "events", label: "My Events", icon: Calendar },
  { key: "attendees", label: "Attendees", icon: Users },
  { key: "profile", label: "My Profile", icon: UserCircle2 },
];

const OrganizerLayout = ({ children, activeSection, onSelectSection }: Props) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleSectionClick = (key: string) => {
    onSelectSection(key);
    setOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
          style={{ backdropFilter: 'blur(4px)' }}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-30 flex flex-col transform ${open ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0 transition-transform duration-300`}
        style={{
          width: '260px',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--glass-border)',
        }}
      >
        {/* Brand header */}
        <div className="px-5 py-5 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl overflow-hidden border border-white/10">
                <img src={logo} alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <p className="text-[var(--text-primary)] font-heading font-bold text-sm">Swasthya Chetna</p>
                <p className="text-[var(--text-secondary)] text-xs">Organizer</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="md:hidden w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
          {/* ── Dashboard ── */}
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest px-3 pb-2 pt-1">
            Dashboard
          </p>
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleSectionClick(key)}
              className={`sidebar-item w-full text-left ${activeSection === key ? "active" : ""}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          ))}

          {/* ── Ticketing ── */}
          <div className="h-px my-2" style={{ background: 'var(--glass-border)' }} />
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest px-3 pb-2 pt-1">
            Ticketing
          </p>
          {[
            { key: 'tickets', label: 'Ticket Types', emoji: '🎟️' },
            { key: 'discounts', label: 'Discount Codes', emoji: '🏷️' },
            { key: 'addons', label: 'Add-ons / Merch', emoji: '📦' },
          ].map(({ key, label, emoji }) => (
            <button
              key={key}
              onClick={() => handleSectionClick(key)}
              className={`sidebar-item w-full text-left ${activeSection === key ? "active" : ""}`}
            >
              <span className="text-sm leading-none flex-shrink-0 w-4 text-center">{emoji}</span>
              {label}
            </button>
          ))}

          {/* ── Event Tools ── */}
          <div className="h-px my-2" style={{ background: 'var(--glass-border)' }} />
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest px-3 pb-2 pt-1">
            Event Tools
          </p>
          {[
            { key: 'email-blast', label: 'Email Blast', emoji: '📧' },
            { key: 'agenda', label: 'Agenda & Schedule', emoji: '📅' },
            { key: 'survey', label: 'Feedback Survey', emoji: '📝' },
            { key: 'certificates', label: 'Certificates', emoji: '🏅' },
          ].map(({ key, label, emoji }) => (
            <button
              key={key}
              onClick={() => handleSectionClick(key)}
              className={`sidebar-item w-full text-left ${activeSection === key ? "active" : ""}`}
            >
              <span className="text-sm leading-none flex-shrink-0 w-4 text-center">{emoji}</span>
              {label}
            </button>
          ))}

          {/* ── Quick Links ── */}
          <div className="h-px my-2" style={{ background: 'var(--glass-border)' }} />
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest px-3 pb-2 pt-1">
            Quick Links
          </p>
          <button
            onClick={() => handleSectionClick('vendors')}
            className={`sidebar-item w-full text-left ${activeSection === 'vendors' ? 'active' : ''}`}
          >
            <span className="text-sm leading-none flex-shrink-0 w-4 text-center">🤝</span>
            Hire Vendors
          </button>
          <button
            onClick={() => { navigate("/my-bookings"); setOpen(false); }}
            className="sidebar-item w-full text-left"
          >
            <Ticket className="w-4 h-4 flex-shrink-0" />
            My Bookings
          </button>
        </nav>

        {/* Create Event CTA */}
        <div className="p-3 border-t flex-shrink-0" style={{ borderColor: 'var(--glass-border)' }}>
          <button
            onClick={() => navigate("/create-event")}
            className="btn-primary w-full justify-center text-sm py-2.5"
          >
            <Zap className="w-4 h-4" />
            Create Event
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div
          className="md:hidden flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--glass-border)', height: 'var(--navbar-height)' }}
        >
          <button
            onClick={() => setOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-hover)] transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-heading font-bold text-[var(--text-primary)] text-sm">Organizer Dashboard</span>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default OrganizerLayout;
