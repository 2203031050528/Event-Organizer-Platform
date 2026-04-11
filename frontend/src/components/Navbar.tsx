import { MapPin, User, Menu, X, ChevronDown, Zap, Heart, Ticket, Settings, LogOut, LayoutDashboard, Calendar } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo.png";
import ThemeToggle from "./ThemeToggle";

const POPULAR_CITIES = ["Pune", "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Ahmedabad"];

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  ADMIN: { label: "Admin", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  ORGANIZER: { label: "Organizer", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  VENDOR: { label: "Partner", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  USER: { label: "User", color: "bg-brand-500/20 text-brand-300 border-brand-500/30" },
};

function NavLink({ to, children, onClick }: { to: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-hover)] transition-all duration-150 group"
    >
      {children}
    </Link>
  );
}

export default function Navbar() {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCity = searchParams.get("city") || "City";
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Scroll detection for glass effect
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileDropdown(false);
      }
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setShowCityDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const closeMobile = () => setShowMobileMenu(false);

  const handleCitySelect = (city: string) => {
    setSearchParams((prev) => { prev.set("city", city); return prev; });
    setShowCityDropdown(false);
    setShowMobileMenu(false);
    navigate(`/?city=${city}`);
  };

  const handleLogout = () => {
    logout();
    setShowMobileMenu(false);
    navigate("/login");
  };

  const handleCreateEvent = () => {
    setShowMobileMenu(false);
    if (!user) { navigate("/login"); return; }
    if (user.role === "USER") { navigate("/apply-organizer"); return; }
    navigate("/create-event");
  };

  const roleInfo = user ? ROLE_BADGE[user.role] ?? ROLE_BADGE["USER"] : null;

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-[60] transition-all duration-300"
        style={{
          height: 'var(--navbar-height)',
          background: 'var(--glass)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: scrolled ? '1px solid var(--glass-border)' : '1px solid transparent',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-4">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl overflow-hidden border border-white/10">
              <img src={logo} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-heading font-bold text-[var(--text-primary)] text-base hidden sm:block">
              Swasthya <span className="gradient-text">Chetna</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {/* City selector */}
            <div className="relative" ref={cityRef}>
              <button
                onClick={() => setShowCityDropdown(!showCityDropdown)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-hover)] transition-all duration-150"
              >
                <MapPin className="w-4 h-4 text-brand-400" />
                <span>{selectedCity}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showCityDropdown ? "rotate-180" : ""}`} />
              </button>

              {showCityDropdown && (
                <div className="absolute left-0 top-full mt-2 w-48 rounded-2xl overflow-hidden animate-slide-down z-50"
                  style={{
                    background: 'rgba(18, 24, 39, 0.98)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                  }}>
                  <div className="p-2">
                    {POPULAR_CITIES.map((city) => (
                      <button
                        key={city}
                        onClick={() => handleCitySelect(city)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors duration-150 ${selectedCity === city
                          ? "text-brand-300 bg-brand-500/10"
                          : "text-slate-300 hover:text-white hover:bg-white/5"
                          }`}
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleCreateEvent}
              className="btn-primary px-4 py-2 text-sm"
            >
              <Zap className="w-3.5 h-3.5" />
              Create Event
            </button>

          </nav>

          {/* Desktop Right */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150 hover:bg-white/6"
                    style={{ border: '1px solid var(--glass-border)' }}
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-brand-500 to-indigo-500 text-white text-xs font-bold flex-shrink-0">
                      {user.name?.[0]?.toUpperCase() ?? "U"}
                    </div>
                    <span className="text-sm text-[var(--text-secondary)] max-w-[100px] truncate">{user.name}</span>
                    {roleInfo && (
                      <span className={`hidden lg:inline-flex text-xs px-2 py-0.5 rounded-full border ${roleInfo.color}`}>
                        {roleInfo.label}
                      </span>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${showProfileDropdown ? "rotate-180" : ""}`} />
                  </button>

                  {showProfileDropdown && (
                    <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl overflow-hidden animate-slide-down z-50"
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--glass-border)',
                        backdropFilter: 'blur(20px)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                      }}>
                      <div className="px-4 py-3 border-b border-[var(--glass-border)]">
                        <p className="text-[var(--text-primary)] font-medium text-sm truncate">{user.name}</p>
                        <p className="text-[var(--text-muted)] text-xs truncate">{user.email ?? user.role}</p>
                      </div>

                      <div className="p-2">
                        {/* USER links */}
                        {user.role === "USER" && (
                          <>
                            <NavLink to="/profile" onClick={() => setShowProfileDropdown(false)}>
                              <User className="w-4 h-4 text-slate-400" />My Profile
                            </NavLink>
                            <NavLink to="/my-bookings" onClick={() => setShowProfileDropdown(false)}>
                              <Ticket className="w-4 h-4 text-slate-400" />My Bookings
                            </NavLink>
                            <NavLink to="/wishlist" onClick={() => setShowProfileDropdown(false)}>
                              <Heart className="w-4 h-4 text-slate-400" />My Wishlist
                            </NavLink>
                          </>
                        )}

                        {/* ORGANIZER links */}
                        {user.role === "ORGANIZER" && (
                          <>
                            <NavLink to="/organizer/dashboard/profile" onClick={() => setShowProfileDropdown(false)}>
                              <User className="w-4 h-4 text-slate-400" />My Profile
                            </NavLink>
                            <NavLink to="/organizer/dashboard/overview" onClick={() => setShowProfileDropdown(false)}>
                              <LayoutDashboard className="w-4 h-4 text-slate-400" />Dashboard
                            </NavLink>
                            <NavLink to="/organizer/events" onClick={() => setShowProfileDropdown(false)}>
                              <Calendar className="w-4 h-4 text-slate-400" />My Events
                            </NavLink>
                            <NavLink to="/my-bookings" onClick={() => setShowProfileDropdown(false)}>
                              <Ticket className="w-4 h-4 text-slate-400" />My Bookings
                            </NavLink>
                            <NavLink to="/wishlist" onClick={() => setShowProfileDropdown(false)}>
                              <Heart className="w-4 h-4 text-slate-400" />My Wishlist
                            </NavLink>
                          </>
                        )}

                        {/* VENDOR links */}
                        {user.role === "VENDOR" && (
                          <>
                            <NavLink to="/vendor/dashboard" onClick={() => setShowProfileDropdown(false)}>
                              <LayoutDashboard className="w-4 h-4 text-slate-400" />Vendor Dashboard
                            </NavLink>
                          </>
                        )}

                        {/* ADMIN links */}
                        {user.role === "ADMIN" && (
                          <>
                            <NavLink to="/admin" onClick={() => setShowProfileDropdown(false)}>
                              <Settings className="w-4 h-4 text-slate-400" />Admin Panel
                            </NavLink>
                            <NavLink to="/my-bookings" onClick={() => setShowProfileDropdown(false)}>
                              <Ticket className="w-4 h-4 text-slate-400" />My Bookings
                            </NavLink>
                            <NavLink to="/wishlist" onClick={() => setShowProfileDropdown(false)}>
                              <Heart className="w-4 h-4 text-slate-400" />My Wishlist
                            </NavLink>
                          </>
                        )}

                        {/* Divider + Logout */}
                        <div className="h-px bg-white/5 my-1" />
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/8 transition-all duration-150"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <Link
                  to="/vendor/register"
                  className="hidden md:flex text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium px-2"
                >
                  Become a Vendor
                </Link>
                <Link
                  to="/login"
                  className="btn-primary text-sm px-5 py-2.5"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Spacer */}
      <div style={{ height: 'var(--navbar-height)' }} />

      {/* Mobile menu overlay */}
      {showMobileMenu && (
        <div
          className="fixed inset-0 z-[60] md:hidden animate-fade-in"
          onClick={closeMobile}
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-[60] md:hidden w-80 max-w-full transition-transform duration-300 ${showMobileMenu ? "translate-x-0" : "translate-x-full"
          }`}
        style={{
          background: 'var(--bg-primary)',
          backdropFilter: 'blur(24px)',
          borderLeft: '1px solid var(--glass-border)',
        }}
      >
        {/* Mobile header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5"
          style={{ height: 'var(--navbar-height)' }}>
          <div className="flex items-center gap-3">
            <span className="font-heading font-bold text-[var(--text-primary)]">Menu</span>
            <ThemeToggle />
          </div>
          <button
            onClick={closeMobile}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--btn-secondary-bg)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto h-[calc(100%-var(--navbar-height))]">
          <div className="p-4 space-y-1">

            {/* City selector (mobile) */}
            <div className="mb-3 px-1">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2">Browse By City</p>
              <div className="flex flex-wrap gap-2">
                {POPULAR_CITIES.slice(0, 5).map((city) => (
                  <button
                    key={city}
                    onClick={() => handleCitySelect(city)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${selectedCity === city
                      ? "text-brand-300 border-brand-500/40"
                      : "text-slate-400 border-white/10"
                      }`}
                    style={{
                      background: selectedCity === city ? "rgba(108,71,236,0.15)" : "var(--btn-secondary-bg)",
                      border: '1px solid',
                    }}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-white/5 my-3" />

            <button
              onClick={handleCreateEvent}
              className="btn-primary w-full justify-center py-2.5 text-sm"
            >
              <Zap className="w-3.5 h-3.5" />
              Create Event
            </button>


            {user ? (
              <>
                {/* User info */}
                <div className="flex items-center gap-3 px-3 py-3 mt-2 rounded-xl"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)' }}>
                  <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-brand-500 to-indigo-500 text-white font-bold text-sm">
                    {user.name?.[0]?.toUpperCase() ?? "U"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[var(--text-primary)] text-sm font-medium truncate">{user.name}</p>
                    {roleInfo && (
                      <span className={`inline-flex text-xs px-2 py-0.5 rounded-full border ${roleInfo.color}`}>
                        {roleInfo.label}
                      </span>
                    )}
                  </div>
                </div>

                <div className="h-px bg-white/5 my-2" />

                {/* Role-based links */}
                {user.role === "USER" && (
                  <>
                    <NavLink to="/profile" onClick={closeMobile}><User className="w-4 h-4 text-slate-400" />My Profile</NavLink>
                    <NavLink to="/my-bookings" onClick={closeMobile}><Ticket className="w-4 h-4 text-slate-400" />My Bookings</NavLink>
                    <NavLink to="/wishlist" onClick={closeMobile}><Heart className="w-4 h-4 text-slate-400" />My Wishlist</NavLink>
                  </>
                )}
                {user.role === "ORGANIZER" && (
                  <>
                    <NavLink to="/organizer/dashboard/profile" onClick={closeMobile}><User className="w-4 h-4 text-slate-400" />My Profile</NavLink>
                    <NavLink to="/organizer/dashboard/overview" onClick={closeMobile}><LayoutDashboard className="w-4 h-4 text-slate-400" />Dashboard</NavLink>
                    <NavLink to="/organizer/events" onClick={closeMobile}><Calendar className="w-4 h-4 text-slate-400" />My Events</NavLink>
                    <NavLink to="/my-bookings" onClick={closeMobile}><Ticket className="w-4 h-4 text-slate-400" />My Bookings</NavLink>
                    <NavLink to="/wishlist" onClick={closeMobile}><Heart className="w-4 h-4 text-slate-400" />My Wishlist</NavLink>
                  </>
                )}
                {user.role === "VENDOR" && (
                  <>
                    <NavLink to="/vendor/dashboard" onClick={closeMobile}><LayoutDashboard className="w-4 h-4 text-slate-400" />Vendor Dashboard</NavLink>
                  </>
                )}
                {user.role === "ADMIN" && (
                  <>
                    <NavLink to="/admin" onClick={closeMobile}><Settings className="w-4 h-4 text-slate-400" />Admin Panel</NavLink>
                    <NavLink to="/my-bookings" onClick={closeMobile}><Ticket className="w-4 h-4 text-slate-400" />My Bookings</NavLink>
                    <NavLink to="/wishlist" onClick={closeMobile}><Heart className="w-4 h-4 text-slate-400" />My Wishlist</NavLink>
                  </>
                )}

                <div className="h-px bg-white/5 my-2" />
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/8 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/vendor/register"
                  onClick={closeMobile}
                  className="block text-center text-sm font-medium text-brand-300 border border-brand-500/30 bg-brand-500/10 rounded-xl py-2.5 mt-4"
                >
                  Become a Vendor
                </Link>
                <Link
                  to="/login"
                  onClick={closeMobile}
                  className="btn-primary w-full justify-center mt-3"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
