import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import {
  FileText, MapPin, Ticket, Image, ChevronRight, ChevronLeft,
  Loader2, Upload, Check, Video, Zap,
} from "lucide-react";
import toast from "react-hot-toast";

/* ═══════════════════ TYPES ═══════════════════ */

type EventStatus = "DRAFT" | "PUBLISHED";
type EventType = "ONLINE" | "OFFLINE" | "HYBRID";

interface CreateEventPayload {
  organizer_id: string;
  title: string;
  short_description: string;
  description: string;
  category: string;
  tags: string[];
  type: EventType;
  city: string;
  venue: string;
  online_link?: string;
  start_date: string;
  end_date: string;
  banner_url: string;
  status: EventStatus;
  // Demo Video
  demo_video_url?: string;
  demo_video_type?: string;
  demo_thumbnail_url?: string;
  // Pre-launch discount
  pre_launch_discount_pct?: number | null;
  pre_launch_ends_at?: string;
}

interface CreateTicketPayload {
  event_id: string;
  title: string;
  price: number;
  quantity: number;
}

const createEvent = (payload: CreateEventPayload) =>
  api.post<{ event_id: string }>("/events/", payload);

const createTicket = (payload: CreateTicketPayload) =>
  api.post("/tickets/", payload);

/* ═══════════════════ STEP CONFIG ═══════════════════ */

const STEPS = [
  { label: "Basics", icon: FileText, color: "rgba(108,71,236,0.2)", border: "rgba(108,71,236,0.3)", text: "#c4b5fd" },
  { label: "Location", icon: MapPin, color: "rgba(59,130,246,0.2)", border: "rgba(59,130,246,0.3)", text: "#93c5fd" },
  { label: "Tickets", icon: Ticket, color: "rgba(16,185,129,0.2)", border: "rgba(16,185,129,0.3)", text: "#6ee7b7" },
  { label: "Banner", icon: Image, color: "rgba(245,158,11,0.2)", border: "rgba(245,158,11,0.3)", text: "#fcd34d" },
  { label: "Video", icon: Video, color: "rgba(236,72,153,0.2)", border: "rgba(236,72,153,0.3)", text: "#f9a8d4" },
];

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */

export default function CreateEvent() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isFree, setIsFree] = useState(true);

  const [eventData, setEventData] = useState<Omit<CreateEventPayload, "banner_url" | "status">>({
    organizer_id: user?.id || "",
    title: "",
    short_description: "",
    description: "",
    category: "",
    tags: [],
    type: "ONLINE",
    city: "",
    venue: "",
    online_link: "",
    start_date: "",
    end_date: "",
    // video
    demo_video_url: "",
    demo_video_type: "",
    demo_thumbnail_url: "",
    // pre-launch
    pre_launch_discount_pct: null,
    pre_launch_ends_at: "",
  });

  const [ticket, setTicket] = useState<Omit<CreateTicketPayload, "event_id">>({
    title: "General Admission",
    price: 0,
    quantity: 100,
  });

  /* ─── Validation ─── */
  const canGoNext = useMemo(() => {
    if (step === 1)
      return eventData.title.trim() && eventData.short_description.trim() && eventData.category;
    if (step === 2) {
      if (!eventData.start_date || !eventData.end_date) return false;
      if (new Date(eventData.end_date) <= new Date(eventData.start_date)) return false;
      if (eventData.type !== "ONLINE" && !eventData.venue.trim()) return false;
      if (eventData.type !== "OFFLINE" && !eventData.online_link?.trim()) return false;
      return !!eventData.city.trim();
    }
    if (step === 3) {
      if (!ticket.title.trim() || ticket.quantity <= 0) return false;
      if (!isFree && ticket.price <= 0) return false;
      return true;
    }
    if (step === 4) return !!image;
    if (step === 5) return true; // Video step is optional
    return true;
  }, [step, eventData, ticket, isFree, image]);

  /* ─── Image upload ─── */
  const uploadImage = async (): Promise<string> => {
    if (!image) return "";
    const fd = new FormData();
    fd.append("file", image);
    const res = await api.post<{ url: string }>("/upload", fd);
    return res.data.url;
  };

  const handleImageSelect = (file: File | null) => {
    setImage(file);
    if (file) setPreviewUrl(URL.createObjectURL(file));
    else setPreviewUrl(null);
  };

  /* ─── Submit ─── */
  const handlePublish = async () => {
    try {
      setLoading(true);
      const banner_url = await uploadImage();

      // Detect video type from URL
      let demo_video_type = eventData.demo_video_type || "";
      if (eventData.demo_video_url && !demo_video_type) {
        if (eventData.demo_video_url.includes("youtube.com") || eventData.demo_video_url.includes("youtu.be"))
          demo_video_type = "YOUTUBE";
        else if (eventData.demo_video_url.includes("vimeo.com"))
          demo_video_type = "VIMEO";
        else if (eventData.demo_video_url)
          demo_video_type = "UPLOAD";
      }

      const payload: CreateEventPayload = {
        ...eventData,
        banner_url,
        status: "PUBLISHED",
        demo_video_type: demo_video_type || undefined,
        demo_video_url: eventData.demo_video_url || undefined,
        demo_thumbnail_url: eventData.demo_thumbnail_url || undefined,
        pre_launch_discount_pct: eventData.pre_launch_discount_pct || undefined,
        pre_launch_ends_at: eventData.pre_launch_ends_at || undefined,
      };

      const eventRes = await createEvent(payload);
      await createTicket({ event_id: eventRes.data.event_id, ...ticket, price: isFree ? 0 : ticket.price });
      toast.success("Event created successfully!");
      navigate(`/event/${eventRes.data.event_id}`);
    } catch {
      toast.error("Failed to create event. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const currentStep = STEPS[step - 1];
  const StepIcon = currentStep.icon;

  /* ─── UI ─── */
  return (
    <div className="min-h-screen py-10 sm:py-16 px-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-2xl mx-auto">
        {/* Page header */}
        <div className="text-center mb-10 animate-fade-up">
          <h1 className="font-heading font-black text-3xl sm:text-4xl text-white mb-2">Create Event</h1>
          <p className="text-slate-500 text-sm">Fill in the details to publish your event on the platform</p>
        </div>

        {/* Step tracker */}
        <div className="flex items-center justify-between mb-8 animate-fade-up" style={{ animationDelay: '80ms' }}>
          {STEPS.map((s, i) => {
            const SIcon = s.icon;
            const isActive = i + 1 === step;
            const isDone = i + 1 < step;
            return (
              <div key={s.label} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300"
                    style={{
                      background: isActive ? s.color : isDone ? 'rgba(108,71,236,0.15)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${isActive ? s.border : isDone ? 'rgba(108,71,236,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    {isDone
                      ? <Check className="w-4 h-4 text-brand-400" />
                      : <SIcon className="w-4 h-4" style={{ color: isActive ? s.text : '#475569' }} />
                    }
                  </div>
                  <span className={`text-xs mt-1.5 font-medium ${isActive ? 'text-white' : isDone ? 'text-brand-400' : 'text-slate-600'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="h-px flex-1 mx-2 mb-5 transition-all" style={{
                    background: isDone ? 'rgba(108,71,236,0.5)' : 'rgba(255,255,255,0.08)'
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step card */}
        <div className="glass-card rounded-2xl overflow-hidden animate-fade-up" style={{ animationDelay: '160ms' }}>
          {/* Card header */}
          <div className="flex items-center gap-3 px-6 py-4"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: currentStep.color }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${currentStep.border}` }}>
              <StepIcon className="w-4 h-4" style={{ color: currentStep.text }} />
            </div>
            <div>
              <h2 className="font-heading font-bold text-white">
                Step {step} — {currentStep.label}
              </h2>
              <p className="text-xs text-slate-400">{step} of {STEPS.length}</p>
            </div>
          </div>

          <div className="p-6 space-y-4">

            {/* ─── STEP 1: Basics ─── */}
            {step === 1 && (
              <>
                <Field label="Event Title" required>
                  <input className="input-glass w-full text-sm py-3"
                    placeholder="e.g. Startup Pitch Night Pune"
                    value={eventData.title}
                    onChange={(e) => setEventData({ ...eventData, title: e.target.value })} />
                </Field>

                <Field label="Short Description" required hint="One-line summary shown on event cards">
                  <input className="input-glass w-full text-sm py-3"
                    placeholder="Max 120 characters"
                    value={eventData.short_description}
                    onChange={(e) => setEventData({ ...eventData, short_description: e.target.value })} />
                </Field>

                <Field label="Detailed Description">
                  <textarea className="input-glass w-full text-sm py-3 resize-none" rows={4}
                    placeholder="Describe the event, agenda, speakers, rules..."
                    value={eventData.description}
                    onChange={(e) => setEventData({ ...eventData, description: e.target.value })} />
                </Field>

                <Field label="Category" required>
                  <select className="input-glass w-full text-sm py-3"
                    value={eventData.category}
                    onChange={(e) => setEventData({ ...eventData, category: e.target.value })}>
                    <option value="" style={{ background: '#0b0f1a' }}>Select category</option>
                    {["Music", "Comedy", "Workshop", "Conference", "Sports", "Arts", "Technology", "Food"].map(c => (
                      <option key={c} value={c} style={{ background: '#0b0f1a' }}>{c}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Tags" hint="Helps improve event discoverability">
                  <input className="input-glass w-full text-sm py-3"
                    placeholder="startup, networking, tech"
                    onChange={(e) => setEventData({ ...eventData, tags: e.target.value.split(",").map(t => t.trim()) })} />
                </Field>
              </>
            )}

            {/* ─── STEP 2: Location ─── */}
            {step === 2 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Start Date & Time" required>
                    <input type="datetime-local" className="input-glass w-full text-sm py-3"
                      onChange={(e) => setEventData({ ...eventData, start_date: e.target.value })} />
                  </Field>
                  <Field label="End Date & Time" required>
                    <input type="datetime-local" className="input-glass w-full text-sm py-3"
                      onChange={(e) => setEventData({ ...eventData, end_date: e.target.value })} />
                  </Field>
                </div>

                <Field label="Event Type">
                  <div className="grid grid-cols-3 gap-2">
                    {(["ONLINE", "OFFLINE", "HYBRID"] as EventType[]).map(t => (
                      <button key={t} type="button"
                        onClick={() => setEventData({ ...eventData, type: t })}
                        className="py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{
                          background: eventData.type === t ? 'rgba(108,71,236,0.3)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${eventData.type === t ? 'rgba(108,71,236,0.5)' : 'rgba(255,255,255,0.1)'}`,
                          color: eventData.type === t ? '#c4b5fd' : '#64748b',
                        }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </Field>

                {eventData.type !== "ONLINE" && (
                  <Field label="Venue" required>
                    <input className="input-glass w-full text-sm py-3"
                      placeholder="Venue name & address"
                      value={eventData.venue}
                      onChange={(e) => setEventData({ ...eventData, venue: e.target.value })} />
                  </Field>
                )}

                {eventData.type !== "OFFLINE" && (
                  <Field label="Online Event Link" required>
                    <input className="input-glass w-full text-sm py-3"
                      placeholder="Zoom / Google Meet / YouTube link"
                      value={eventData.online_link}
                      onChange={(e) => setEventData({ ...eventData, online_link: e.target.value })} />
                  </Field>
                )}

                <Field label="City" required>
                  <input className="input-glass w-full text-sm py-3"
                    placeholder="e.g. Pune"
                    value={eventData.city}
                    onChange={(e) => setEventData({ ...eventData, city: e.target.value })} />
                </Field>
              </>
            )}

            {/* ─── STEP 3: Tickets ─── */}
            {step === 3 && (
              <>
                {/* Free / Paid toggle */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Pricing Model</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[{ label: "Free", val: true }, { label: "Paid", val: false }].map(({ label, val }) => (
                      <button key={label} type="button"
                        onClick={() => setIsFree(val)}
                        className="py-3 rounded-xl text-sm font-bold transition-all"
                        style={{
                          background: isFree === val ? 'rgba(108,71,236,0.3)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${isFree === val ? 'rgba(108,71,236,0.5)' : 'rgba(255,255,255,0.1)'}`,
                          color: isFree === val ? '#c4b5fd' : '#64748b',
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <Field label="Ticket Name" required>
                  <input className="input-glass w-full text-sm py-3"
                    value={ticket.title}
                    onChange={(e) => setTicket({ ...ticket, title: e.target.value })} />
                </Field>

                {!isFree && (
                  <Field label="Price (₹)" required>
                    <input type="number" min={1} className="input-glass w-full text-sm py-3"
                      value={ticket.price}
                      onChange={(e) => setTicket({ ...ticket, price: Number(e.target.value) })} />
                  </Field>
                )}

                <Field label="Total Quantity" required>
                  <input type="number" min={1} className="input-glass w-full text-sm py-3"
                    value={ticket.quantity}
                    onChange={(e) => setTicket({ ...ticket, quantity: Number(e.target.value) })} />
                </Field>
              </>
            )}

            {/* ─── STEP 4: Banner ─── */}
            {step === 4 && (
              <div>
                <label htmlFor="event-image"
                  className="flex flex-col items-center justify-center w-full rounded-2xl p-10 cursor-pointer text-center transition-all"
                  style={{
                    border: `2px dashed ${image ? 'rgba(108,71,236,0.5)' : 'rgba(255,255,255,0.15)'}`,
                    background: image ? 'rgba(108,71,236,0.06)' : 'rgba(255,255,255,0.03)',
                  }}>
                  <input type="file" id="event-image" hidden accept="image/*"
                    onChange={(e) => handleImageSelect(e.target.files?.[0] || null)} />

                  {!image ? (
                    <>
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                        style={{ background: 'rgba(108,71,236,0.15)', border: '1px solid rgba(108,71,236,0.25)' }}>
                        <Upload className="w-6 h-6 text-brand-400" />
                      </div>
                      <p className="text-white font-semibold mb-1">Upload Event Banner</p>
                      <p className="text-slate-500 text-sm">16:9 ratio recommended · PNG, JPG, WEBP</p>
                    </>
                  ) : (
                    <div className="w-full space-y-3">
                      <img src={previewUrl!} className="rounded-xl max-h-56 mx-auto object-cover" alt="Banner preview" />
                      <p className="text-sm text-emerald-400 font-medium flex items-center justify-center gap-1.5">
                        <Check className="w-4 h-4" /> {image.name}
                      </p>
                      <p className="text-xs text-slate-500">Click to change image</p>
                    </div>
                  )}
                </label>
              </div>
            )}

            {/* ─── STEP 5: Video & Pre-Launch Discount ─── */}
            {step === 5 && (
              <>
                <Field label="Demo Video URL" hint="YouTube, Vimeo, or direct video URL (optional)">
                  <input
                    className="input-glass w-full text-sm py-3"
                    placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                    value={eventData.demo_video_url || ""}
                    onChange={(e) => setEventData({ ...eventData, demo_video_url: e.target.value })}
                  />
                </Field>

                <Field label="Custom Thumbnail URL" hint="Override the auto-detected thumbnail (optional)">
                  <input
                    className="input-glass w-full text-sm py-3"
                    placeholder="https://cdn.example.com/thumb.jpg"
                    value={eventData.demo_thumbnail_url || ""}
                    onChange={(e) => setEventData({ ...eventData, demo_thumbnail_url: e.target.value })}
                  />
                </Field>

                <div
                  className="mt-2 p-4 rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Pre-Launch Discount (optional)</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Discount %" hint="e.g. 20 for 20% off">
                      <input
                        type="number" min={0} max={100}
                        className="input-glass w-full text-sm py-3"
                        placeholder="0"
                        value={eventData.pre_launch_discount_pct ?? ""}
                        onChange={(e) => setEventData({
                          ...eventData,
                          pre_launch_discount_pct: e.target.value ? Number(e.target.value) : null
                        })}
                      />
                    </Field>
                    <Field label="Offer Expires At" hint="Auto-apply ends when time is reached">
                      <input
                        type="datetime-local"
                        className="input-glass w-full text-sm py-3"
                        value={eventData.pre_launch_ends_at || ""}
                        onChange={(e) => setEventData({ ...eventData, pre_launch_ends_at: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between gap-3 mt-6 animate-fade-up" style={{ animationDelay: '240ms', animationFillMode: 'both' }}>
          {step > 1 ? (
            <button onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-slate-300 transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : <div />}

          {step < 5 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canGoNext}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: canGoNext ? 'linear-gradient(135deg, #6c47ec, #4f46e5)' : 'rgba(255,255,255,0.08)' }}>
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handlePublish}
              disabled={loading || !canGoNext}
              className="btn-primary px-7 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {loading ? "Publishing..." : "Publish Event"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function Field({ label, required, hint, children }: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        {label} {required && <span className="text-brand-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-600 mt-1.5">{hint}</p>}
    </div>
  );
}
