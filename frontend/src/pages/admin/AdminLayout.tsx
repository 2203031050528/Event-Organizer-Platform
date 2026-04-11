import { type ReactNode, useState, useMemo } from "react";
import {
  CalendarDays, Users, UserCog, BarChart3, Menu, X, Ticket, ArrowLeft, ShieldCheck
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";

type Props = {
  children: ReactNode;
  activeSection: string;
  onSelectSection: (section: string) => void;
};

const NAV_ITEMS = [
  { key: "events", label: "Events", icon: CalendarDays },
  { key: "organizers", label: "Organizers", icon: UserCog },
  { key: "users", label: "Users", icon: Users },
  { key: "vendors", label: "Vendors", icon: ShieldCheck },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
];

const SECTION_META: Record<string, { title: string; subtitle: string }> = {
  events: { title: "Events", subtitle: "Review, publish, and manage all events." },
  organizers: { title: "Organizers", subtitle: "Verify applications and manage organizers." },
  users: { title: "Users", subtitle: "View and control user access and roles." },
  vendors: { title: "Vendors", subtitle: "Review vendor KYC submissions." },
  analytics: { title: "Analytics", subtitle: "Track performance, revenue, and engagement." },
  default: { title: "Dashboard", subtitle: "Overview of your admin tools." },
};

const AdminLayout = ({ children, activeSection, onSelectSection }: Props) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const currentSection = useMemo(
    () => SECTION_META[activeSection] || SECTION_META.default,
    [activeSection]
  );

  const handleNav = (key: string) => {
    onSelectSection(key);
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          style={{ backdropFilter: 'blur(4px)' }}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-30 flex flex-col transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0 transition-transform duration-300`}
        style={{
          width: 'var(--sidebar-width)',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Brand */}
        <div className="px-5 py-5 border-b flex items-start justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl overflow-hidden border border-white/10">
                <img src={logo} alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <p className="text-white font-heading font-bold text-sm">Swasthya Chetna</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3 h-3 text-red-400" />
                  <span className="text-red-400 text-xs font-medium">Admin Panel</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Home
            </button>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 mt-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest px-3 mb-3">
            Management
          </p>
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleNav(key)}
              className={`sidebar-item w-full text-left ${activeSection === key ? "active" : ""}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          ))}

          <div className="h-px my-3" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest px-3 mb-3">
            My Account
          </p>
          <button
            onClick={() => { navigate("/my-bookings"); setIsSidebarOpen(false); }}
            className="sidebar-item w-full text-left"
          >
            <Ticket className="w-4 h-4 flex-shrink-0" />
            My Bookings
          </button>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div
          className="md:hidden flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
          style={{ background: 'var(--bg-secondary)', borderColor: 'rgba(255,255,255,0.07)', height: 'var(--navbar-height)' }}
        >
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-heading font-bold text-white text-sm">{currentSection.title}</span>
        </div>

        {/* Desktop section header */}
        <header
          className="hidden md:flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ background: 'var(--bg-secondary)', borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <div>
            <h1 className="font-heading font-bold text-white text-xl">{currentSection.title}</h1>
            <p className="text-slate-500 text-sm mt-0.5">{currentSection.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-red-400 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <ShieldCheck className="w-3.5 h-3.5" />
            Admin
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
