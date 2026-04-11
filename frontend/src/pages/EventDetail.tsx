import { useParams, useNavigate } from "react-router-dom";
import {
  Calendar, Clock, MapPin, Users, Tag, Info, Heart, ChevronUp, ChevronDown, CheckCircle, Share2, Link2, CheckCheck, BadgePercent, X, Loader2, Video, Zap
} from "lucide-react";
import { useEffect, useState } from "react";
import api, { bookTransport } from "../services/api";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { getMyWishlist, addToWishlist, removeFromWishlist } from "../services/api";
import VideoPlayer from "../components/VideoPlayer";
import TransportSelector from "../components/TransportSelector";

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open: () => void };
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  theme?: { color?: string };
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface Ticket {
  _id: string;
  title: string;
  price: number;
  quantity: number;
  sold: number;
}

interface Event {
  id: string;
  title: string;
  description: string;
  category: string;
  city: string;
  venue: string;
  start_date: string;
  end_date: string;
  banner_url: string;
  agenda?: {
    _id: string;
    title: string;
    startTime: string;
    endTime: string;
    speaker?: string;
    room?: string;
    description?: string;
    type: 'TALK' | 'WORKSHOP' | 'BREAK' | 'PANEL';
  }[];
  // ── Demo Video ────────────────────────────────────
  demo_video_url?: string;
  demo_video_type?: 'YOUTUBE' | 'VIMEO' | 'UPLOAD';
  demo_thumbnail_url?: string;
  // ── Pre-Launch Discount ───────────────────────────
  pre_launch_discount_pct?: number;
  pre_launch_ends_at?: string;
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<Event | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // ── Add-ons state ────────────────────────────────────────────────────────
  const [addons, setAddons] = useState<any[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});

  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; type: string; value: number; message: string } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);

  // ── Transport state ────────────────────────────────────────────────────────
  const [transportInfo, setTransportInfo] = useState<{
    option: { vehicle_type: "BIKE" | "CAR" | "VAN"; distance_km: number; fare: number; currency: string } | null;
    pickup: string;
    drop: string;
  }>({ option: null, pickup: '', drop: '' });

  const { user } = useAuth();
  const [isWishlisted, setIsWishlisted] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventRes, ticketRes, addonRes] = await Promise.all([
          api.get(`/events/${id}`),
          api.get(`/tickets/event/${id}`),
          api.get(`/events/${id}/addons`),
        ]);
        setEvent(eventRes.data);
        setTickets(ticketRes.data);
        setAddons(addonRes.data);
      } catch {
        setError("Failed to load event");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  useEffect(() => {
    if (user && event) {
      getMyWishlist()
        .then((data) => setIsWishlisted(data.some((e: any) => String(e.id) === String(event.id))))
        .catch(console.error);
    }
  }, [user, event]);

  const handleToggleWishlist = async () => {
    if (!user) { toast.error("Please login to save events"); return; }
    if (!event) return;
    const cur = isWishlisted;
    setIsWishlisted(!cur);
    try {
      if (cur) { await removeFromWishlist(event.id); toast.success("Removed from wishlist"); }
      else { await addToWishlist(event.id); toast.success("Added to wishlist"); }
    } catch {
      setIsWishlisted(cur);
      toast.error("Failed to update wishlist");
    }
  };

  const handleApplyDiscount = async () => {
    if (!discountCode.trim() || !selectedTicket || !event) return;
    setDiscountLoading(true);
    setDiscountError(null);
    setAppliedDiscount(null);
    try {
      const res = await api.post('/discounts/validate', {
        code: discountCode.trim().toUpperCase(),
        event_id: event.id,          // fixed: API returns 'id' not '_id'
        ticket_id: selectedTicket._id,
      });
      setAppliedDiscount(res.data);
      toast.success(res.data.message);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      // FastAPI 422 detail is an array of objects; extract a readable string
      const msg = Array.isArray(detail)
        ? detail.map((d: any) => d?.msg ?? String(d)).join(', ')
        : (typeof detail === 'string' ? detail : 'Invalid discount code');
      setDiscountError(msg);
    } finally {
      setDiscountLoading(false);
    }
  };

  const removeDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCode('');
    setDiscountError(null);
  };

  const handleCheckout = async () => {
    if (!selectedTicket || !user) {
      if (!user) toast.error("Please login to book tickets");
      return;
    }
    const available = selectedTicket.quantity - selectedTicket.sold;
    if (quantity < 1 || quantity > available) return;
    try {
      setProcessing(true);

      const addonPayload = Object.entries(selectedAddons)
        .filter(([_, qty]) => qty > 0)
        .map(([addon_id, qty]) => ({ addon_id, quantity: qty }));

      const bookingRes = await api.post("/bookings/", {
        event_id: String(event!.id),   // fixed: API returns 'id' not '_id'
        ticket_id: String(selectedTicket._id),
        quantity,
        addons: addonPayload,
        discount_code: appliedDiscount ? appliedDiscount.code : undefined,
      });
      const bookingId = bookingRes.data.booking_id;

      // ── Book transport if selected ──
      if (transportInfo.option) {
        try {
           await bookTransport({
             booking_id: bookingId,
             event_id: String(event!.id),
             pickup_address: transportInfo.pickup,
             drop_address: transportInfo.drop,
             vehicle_type: transportInfo.option.vehicle_type
           });
        } catch (tError) {
           console.error("Failed to book transport", tError);
           toast.error("Booking succeeded but transport failed.");
        }
      }

      if (totalPrice === 0) {
        toast.success("Payment successful! Ticket sent to your email.");
        navigate('/my-bookings');
      } else {
        const orderRes = await api.post(`/payments/create-order/${bookingId}`);
        const { order_id, key, amount } = orderRes.data;
        const options: RazorpayOptions = {
          key, amount, currency: "INR",
          name: "Event Organizer",
          // Update description for razorpay to include transport notation if requested
          description: `${event!.title}${addonPayload.length > 0 ? ' + Add-ons' : ''}${transportInfo.option ? ' + Transport' : ''}`,
          order_id,
          handler: async (response) => {
            await api.post("/payments/verify", {
              booking_id: bookingId,
              order_id: response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            toast.success("Payment successful! Ticket sent to your email.");
            navigate('/my-bookings');
          },
          theme: { color: "#6c47ec" },
        };
        new window.Razorpay(options).open();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Payment failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const updateAddonQty = (id: string, delta: number) => {
    const addon = addons.find(a => a.id === id);
    if (!addon) return;
    setSelectedAddons(prev => {
      const cur = prev[id] || 0;
      const next = Math.max(0, Math.min(cur + delta, addon.total_quantity - addon.sold_quantity));
      return { ...prev, [id]: next };
    });
  };

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    const avail = ticket.quantity - ticket.sold;
    setQuantity((q) => (q > avail ? Math.max(1, avail) : q));
  };

  const available = selectedTicket ? selectedTicket.quantity - selectedTicket.sold : 0;
  const basePrice = selectedTicket ? selectedTicket.price * quantity : 0;

  const addonsPrice = Object.entries(selectedAddons).reduce((acc, [id, qty]) => {
    const addon = addons.find(a => a.id === id);
    return acc + (addon ? addon.price * qty : 0);
  }, 0);

  const discountAmount = appliedDiscount
    ? appliedDiscount.type === 'PERCENTAGE'
      ? Math.round(basePrice * appliedDiscount.value / 100)
      : Math.min(appliedDiscount.value, basePrice)
    : 0;
  const transportPrice = transportInfo.option?.fare || 0;
  const totalPrice = Math.max(0, basePrice + addonsPrice - discountAmount) + transportPrice;

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <div className="h-64 sm:h-96 shimmer" style={{ background: 'rgba(255,255,255,0.04)' }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-8 w-2/3 rounded-xl shimmer" style={{ background: 'rgba(255,255,255,0.04)' }} />
            <div className="h-4 w-full rounded-xl shimmer" style={{ background: 'rgba(255,255,255,0.04)' }} />
            <div className="h-4 w-full rounded-xl shimmer" style={{ background: 'rgba(255,255,255,0.04)' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <p className="text-red-400">{error || "Event not found"}</p>
      </div>
    );
  }

  const date = new Date(event.start_date).toDateString();
  const time = new Date(event.start_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const totalAttending = tickets.reduce((a, b) => a + b.sold, 0);
  const isPastEvent = new Date(event.start_date) < new Date();

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Hero Banner */}
      <div className="relative h-56 sm:h-80 md:h-[480px] overflow-hidden">
        {event.banner_url ? (
          <img
            src={event.banner_url}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand-900 to-indigo-900 opacity-60" />
        )}
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />

        {/* Content */}
        <div className="absolute bottom-6 left-4 sm:bottom-10 sm:left-10 right-16 sm:right-20">
          <span className="inline-block px-3 py-1 rounded-lg text-xs font-semibold text-white mb-3"
            style={{ background: 'rgba(108,71,236,0.85)', border: '1px solid rgba(108,71,236,0.4)' }}>
            {event.category}
          </span>
          <h1 className="font-heading font-black text-2xl sm:text-4xl md:text-5xl text-white leading-tight mb-3 text-shadow-lg">
            {event.title}
          </h1>
          <div className="flex items-center gap-2 text-slate-300 text-sm">
            <Users className="w-4 h-4 text-brand-300" />
            <span>{totalAttending} attending</span>
          </div>
        </div>

        {/* Wishlist button */}
        <button
          onClick={handleToggleWishlist}
          className="absolute top-5 right-5 sm:top-8 sm:right-8 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90"
          style={{
            background: isWishlisted ? "rgba(239,68,68,0.25)" : "rgba(0,0,0,0.4)",
            border: `1px solid ${isWishlisted ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.2)"}`,
            backdropFilter: "blur(12px)",
          }}
          title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart className={`w-5 h-5 transition-all ${isWishlisted ? "fill-red-500 text-red-500" : "text-white"}`} />
        </button>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-6 lg:gap-8 px-4 sm:px-6 py-8">
        {/* Left — Event Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Meta */}
          <div className="glass-card rounded-2xl p-6 animate-fade-up" style={{ animationFillMode: 'both' }}>
            <h2 className="font-heading font-bold text-[var(--text-primary)] text-xl mb-5">Event Details</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { icon: Calendar, label: "Date", value: date },
                { icon: Clock, label: "Time", value: time },
                { icon: MapPin, label: "Venue", value: `${event.venue}, ${event.city}` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex gap-3 items-start">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(108,71,236,0.15)', border: '1px solid rgba(108,71,236,0.2)' }}>
                    <Icon className="w-4 h-4 text-brand-400" />
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-0.5">{label}</p>
                    <p className="text-[var(--text-primary)] text-sm font-medium">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="glass-card rounded-2xl p-6 animate-fade-up delay-100" style={{ animationFillMode: 'both' }}>
            <h2 className="font-heading font-bold text-[var(--text-primary)] text-xl mb-4">About This Event</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">{event.description}</p>
          </div>

          {/* ── Demo Video Section ──────────────────────────────────── */}
          {event.demo_video_url && event.demo_video_type && (
            <div className="glass-card rounded-2xl p-6 animate-fade-up delay-150" style={{ animationFillMode: 'both' }}>
              <div className="flex items-center gap-2 mb-4">
                <Video className="w-5 h-5 text-brand-400" />
                <h2 className="font-heading font-bold text-[var(--text-primary)] text-xl">Event Preview</h2>
              </div>
              <VideoPlayer
                url={event.demo_video_url}
                type={event.demo_video_type}
                thumbnail={event.demo_thumbnail_url}
                title={event.title}
              />
            </div>
          )}

          {/* ── Pre-Launch Discount Banner ──────────────────────────── */}
          {event.pre_launch_discount_pct && event.pre_launch_ends_at &&
            new Date(event.pre_launch_ends_at) > new Date() && (
            <div
              className="rounded-2xl p-4 flex items-center gap-4 animate-fade-up"
              style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.1))',
                border: '1px solid rgba(245,158,11,0.35)',
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.3)' }}
              >
                <Zap className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-amber-300 font-bold text-base">
                  🎉 Pre-Launch Offer — {event.pre_launch_discount_pct}% OFF
                </p>
                <p className="text-amber-500 text-sm">
                  Expires {new Date(event.pre_launch_ends_at).toLocaleString()} · Auto-applied at checkout
                </p>
              </div>
            </div>
          )}

          {event.agenda && event.agenda.length > 0 && (
            <div className="glass-card rounded-2xl p-6 animate-fade-up delay-150" style={{ animationFillMode: 'both' }}>
              <div className="flex items-center gap-2 mb-6">
                <Calendar className="w-5 h-5 text-brand-400" />
                <h2 className="font-heading font-bold text-[var(--text-primary)] text-xl">Event Schedule</h2>
              </div>
              <div className="space-y-0 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-px before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                {[...event.agenda]
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((item) => {
                    const typeColors: Record<string, { bg: string, text: string }> = {
                      TALK: { bg: 'rgba(108,71,236,0.15)', text: '#c4b5fd' },
                      WORKSHOP: { bg: 'rgba(59,130,246,0.15)', text: '#93c5fd' },
                      PANEL: { bg: 'rgba(245,158,11,0.15)', text: '#fcd34d' },
                      BREAK: { bg: 'rgba(16,185,129,0.12)', text: '#6ee7b7' },
                    };
                    const color = typeColors[item.type] || typeColors.TALK;

                    return (
                      <div key={item._id} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active`}>
                        {/* Icon */}
                        <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-[#0b0f1a] bg-slate-800 text-slate-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow flex-none transition-colors duration-300 group-hover:bg-brand-500 group-hover:text-white z-10 ml-0 md:ml-auto">
                          <div className="w-2 h-2 rounded-full" style={{ background: color.text }} />
                        </div>
                        {/* Card */}
                        <div className={`w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-[var(--glass-border)] bg-[var(--btn-secondary-bg)] backdrop-blur-sm transition-all duration-300 hover:bg-[var(--glass-hover)] hover:-translate-y-1 mb-6`}>
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <span className="font-heading font-bold text-[var(--text-primary)] text-base">{item.title}</span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md shrink-0" style={{ background: color.bg, color: color.text }}>
                              {item.type}
                            </span>
                          </div>
                          {item.description && <p className="text-sm text-[var(--text-secondary)] mb-3">{item.description}</p>}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-brand-400" /> {item.startTime} - {item.endTime}</span>
                            {item.speaker && <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-brand-400" /> {item.speaker}</span>}
                            {item.room && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-brand-400" /> {item.room}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Social Share */}
          <div className="glass-card rounded-2xl p-6 animate-fade-up delay-200" style={{ animationFillMode: 'both' }}>
            <div className="flex items-center gap-2 mb-4">
              <Share2 className="w-4 h-4 text-brand-400" />
              <h2 className="font-heading font-bold text-[var(--text-primary)] text-base">Share This Event</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                {
                  label: 'Twitter / X',
                  color: '#000',
                  border: 'rgba(255,255,255,0.15)',
                  emoji: '𝕏',
                  href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(event.title)}&url=${encodeURIComponent(window.location.href)}`,
                },
                {
                  label: 'WhatsApp',
                  color: 'rgba(37,211,102,0.15)',
                  border: 'rgba(37,211,102,0.3)',
                  emoji: '💬',
                  href: `https://wa.me/?text=${encodeURIComponent(event.title + ' ' + window.location.href)}`,
                },
                {
                  label: 'LinkedIn',
                  color: 'rgba(10,102,194,0.15)',
                  border: 'rgba(10,102,194,0.3)',
                  emoji: 'in',
                  href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`,
                },
              ].map(({ label, color, border, emoji, href }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
                  style={{ background: color, border: `1px solid ${border}` }}>
                  <span className="font-bold text-base leading-none">{emoji}</span>
                  {label}
                </a>
              ))}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                style={{ background: linkCopied ? 'rgba(16,185,129,0.15)' : 'var(--btn-secondary-bg)', border: `1px solid ${linkCopied ? 'rgba(16,185,129,0.3)' : 'var(--glass-border)'}`, color: linkCopied ? '#6ee7b7' : 'var(--text-muted)' }}>
                {linkCopied ? <CheckCheck className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                {linkCopied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>

        {/* Right — Booking Sidebar */}
        <div className="animate-fade-up delay-200" style={{ animationFillMode: 'both' }}>
          <div className="glass-card rounded-2xl p-5 lg:sticky lg:top-8">
            <h3 className="font-heading font-bold text-[var(--text-primary)] text-lg mb-4">Select Ticket</h3>

            <div className="space-y-2.5 mb-5">
              {tickets.length === 0 && (
                <p className="text-[var(--text-muted)] text-sm text-center py-4">No tickets available</p>
              )}
              {tickets.map((ticket) => {
                const avail = ticket.quantity - ticket.sold;
                const isSelected = selectedTicket?._id === ticket._id;
                return (
                  <div
                    key={ticket._id}
                    onClick={() => handleSelectTicket(ticket)}
                    className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border ${isSelected
                      ? "border-brand-500/50"
                      : "border-[var(--glass-border)] hover:border-brand-500/30"
                      }`}
                    style={{
                      background: isSelected
                        ? "rgba(108,71,236,0.15)"
                        : "var(--btn-secondary-bg)",
                    }}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[var(--text-primary)] font-medium text-sm flex items-center gap-2">
                        {isSelected && <CheckCircle className="w-3.5 h-3.5 text-brand-400" />}
                        {ticket.title}
                      </span>
                      <span className="text-brand-300 font-bold text-sm">₹{ticket.price}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <span>{avail} left</span>
                      {avail < 50 && avail > 0 && (
                        <span className="flex items-center gap-1 text-amber-400">
                          <Tag className="w-3 h-3" />
                          Selling fast
                        </span>
                      )}
                      {avail === 0 && (
                        <span className="text-red-400">Sold out</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quantity */}
            {selectedTicket && (
              <div className="mb-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[var(--text-primary)] text-sm font-medium">Quantity</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1 || isPastEvent}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-primary)] disabled:opacity-30 transition-colors"
                      style={{ background: 'var(--btn-secondary-bg)' }}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <span className="text-[var(--text-primary)] font-bold w-8 text-center">{quantity}</span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(available, q + 1))}
                      disabled={quantity >= available || isPastEvent}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-primary)] disabled:opacity-30 transition-colors"
                      style={{ background: 'var(--btn-secondary-bg)' }}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-[var(--text-muted)] text-xs">{available} tickets available</p>
              </div>
            )}

            {/* Add-ons Section */}
            {selectedTicket && addons.length > 0 && (
              <div className="mb-4 space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Tag className="w-3 h-3 text-brand-400" />
                  Enhance Your Experience
                </h4>
                <div className="space-y-2">
                  {addons.map((addon) => {
                    const qty = selectedAddons[addon.id] || 0;
                    const left = addon.total_quantity - addon.sold_quantity;
                    return (
                      <div key={addon.id} className="p-3 rounded-xl border border-[var(--glass-border)] bg-[var(--btn-secondary-bg)] hover:bg-[var(--glass-hover)] transition-all">
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <p className="text-[var(--text-primary)] text-sm font-medium">{addon.name}</p>
                            <p className="text-brand-300 text-xs font-semibold">₹{addon.price}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateAddonQty(addon.id, -1)}
                              disabled={qty === 0 || isPastEvent}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-primary)] disabled:opacity-30 border border-[var(--glass-border)] hover:bg-[var(--glass-hover)] transition-colors"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[var(--text-primary)] font-bold w-5 text-center text-sm">{qty}</span>
                            <button
                              onClick={() => updateAddonQty(addon.id, 1)}
                              disabled={qty >= left || isPastEvent}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-primary)] disabled:opacity-30 border border-[var(--glass-border)] hover:bg-[var(--glass-hover)] transition-colors"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {left < 10 && left > 0 && (
                          <p className="text-[10px] text-amber-500 mt-1">Only {left} left</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price summary */}
            {selectedTicket && (
              <div className="mb-4 p-4 rounded-xl" style={{ background: 'var(--btn-secondary-bg)', border: '1px solid var(--glass-border)' }}>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[var(--text-secondary)]">Tickets Subtotal</span>
                    <span className="text-[var(--text-primary)]">₹{basePrice}</span>
                  </div>
                  {addonsPrice > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[var(--text-secondary)]">Add-ons Subtotal</span>
                      <span className="text-[var(--text-primary)]">₹{addonsPrice}</span>
                    </div>
                  )}
                  {transportPrice > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[var(--text-secondary)]">Transport ({transportInfo.option?.vehicle_type})</span>
                      <span className="text-[var(--text-primary)]">₹{transportPrice}</span>
                    </div>
                  )}
                  {appliedDiscount && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-emerald-500 flex items-center gap-1">
                        <BadgePercent className="w-3.5 h-3.5" />
                        Discount ({appliedDiscount.code})
                      </span>
                      <span className="text-emerald-500">-₹{discountAmount}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-1.5 border-t border-[var(--glass-border)]">
                    <span className="text-[var(--text-secondary)] text-sm">Total Amount</span>
                    <span className="text-[var(--text-primary)] font-bold text-xl">₹{totalPrice}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Discount Code Input */}
            {selectedTicket && (
              <div className="mb-4">
                {!appliedDiscount ? (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                      Discount Code
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={discountCode}
                        onChange={e => { setDiscountCode(e.target.value.toUpperCase()); setDiscountError(null); }}
                        placeholder="Enter code…"
                        className="input-glass flex-1 text-sm py-2.5 tracking-widest"
                        onKeyDown={e => e.key === 'Enter' && handleApplyDiscount()}
                      />
                      <button
                        onClick={handleApplyDiscount}
                        disabled={!discountCode.trim() || discountLoading}
                        className="px-4 py-2.5 text-sm font-semibold text-white rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-40"
                        style={{ background: 'rgba(108,71,236,0.3)', border: '1px solid rgba(108,71,236,0.4)' }}
                      >
                        {discountLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
                        Apply
                      </button>
                    </div>
                    {discountError && (
                      <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                        <X className="w-3 h-3" />{discountError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
                    <div className="flex items-center gap-2">
                      <BadgePercent className="w-4 h-4 text-emerald-400" />
                      <div>
                        <p className="text-emerald-300 text-sm font-bold tracking-widest">{appliedDiscount.code}</p>
                        <p className="text-emerald-500 text-xs">{appliedDiscount.message}</p>
                      </div>
                    </div>
                    <button onClick={removeDiscount} className="text-slate-400 hover:text-red-400 transition-colors p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Transport Section */}
            {selectedTicket && (
              <div className="mb-6">
                 <TransportSelector
                    eventVenue={`${event.venue}, ${event.city}`}
                    onSelect={(option, pickup, drop) => setTransportInfo({ option, pickup, drop })}
                 />
              </div>
            )}

            {/* CTA */}
            <button
              disabled={!selectedTicket || processing || quantity < 1 || quantity > available || isPastEvent}
              onClick={handleCheckout}
              className="btn-primary w-full justify-center py-4 text-base disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
            >
              {processing ? (
                <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : isPastEvent ? (
                "Event has ended"
              ) : selectedTicket && quantity > 0 ? (
                `Proceed to Pay ₹${totalPrice}`
              ) : (
                "Select a Ticket"
              )}
            </button>

            {/* Info */}
            <div className="mt-4 flex items-start gap-2 text-xs text-slate-500">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-brand-400" />
              <span>Tickets will be sent to your email after successful payment.</span>
            </div>
          </div>
        </div>
      </div>
    </div >
  );
}
