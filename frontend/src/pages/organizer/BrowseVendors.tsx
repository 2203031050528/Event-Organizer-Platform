import { useState, useEffect } from 'react';
import { Star, MapPin, PackageOpen, SlidersHorizontal, Loader2, Navigation, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function BrowseVendors() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');

  // Booking Modal State
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [bookData, setBookData] = useState({ event_id: '', date: '', duration_hours: '', quantity: '', notes: '' });
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    fetchVendors();
    fetchMyEvents();
  }, [category]);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (category) qs.append('category', category);
      if (city) qs.append('city', city);
      const res = await api.get(`/vendors/?${qs.toString()}`);
      setVendors(res.data);
    } catch {
      toast.error("Failed to load vendors");
    } finally {
      setLoading(false);
    }
  };

  const fetchMyEvents = async () => {
    try {
      const evRes = await api.get('/organizers/me/events');
      setMyEvents(evRes.data.slice(0, 50)); 
    } catch {
      // ignore silently
    }
  };

  const handleBookService = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingLoading(true);
    try {
      const payload: any = {
        service_id: selectedService._id,
        event_id: bookData.event_id,
        date: bookData.date,
        notes: bookData.notes
      };
      if (selectedService.price_type === 'PER_HOUR') payload.duration_hours = Number(bookData.duration_hours);
      if (selectedService.price_type === 'PER_UNIT') payload.quantity = Number(bookData.quantity);

      await api.post(`/vendors/${selectedVendor._id}/book`, payload);
      toast.success("Booking request sent to vendor!");
      setSelectedService(null);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Booking failed");
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-heading font-black text-white mb-2">Vendor Marketplace</h1>
          <p className="text-slate-400">Find and book verified partners for your upcoming events.</p>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
           <div className="relative flex-1 sm:w-48">
              <select className="input-glass w-full py-2.5 pl-10 text-sm appearance-none" value={category} onChange={e=>setCategory(e.target.value)}>
                 <option value="">All Categories</option>
                 <option value="CATERING">Catering</option>
                 <option value="DECORATION">Decoration</option>
                 <option value="TRANSPORT">Transport & Fleet</option>
                 <option value="AV">Audio/Visual</option>
                 <option value="SECURITY">Security</option>
              </select>
              <SlidersHorizontal className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
           </div>
           <div className="relative flex-1 sm:w-48">
              <input type="text" placeholder="City" className="input-glass w-full py-2.5 pl-10 text-sm" value={city} onChange={e=>setCity(e.target.value)} onBlur={fetchVendors} onKeyDown={e=> e.key === 'Enter' && fetchVendors()}/>
              <Navigation className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
           </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-brand-400 animate-spin" /></div>
      ) : vendors.length === 0 ? (
        <div className="glass-card p-12 text-center">
           <PackageOpen className="w-12 h-12 text-slate-500 mx-auto mb-3" />
           <p className="text-slate-400 text-lg">No vendors found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
           {vendors.map(vendor => (
              <div key={vendor._id} className="glass-card p-6 flex flex-col h-full border border-white/5 hover:border-brand-500/30 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-bold text-white">{vendor.business_name}</h3>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">
                      <span className="text-brand-300">{vendor.category}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {vendor.city}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1 bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-lg font-bold">
                       <Star className="w-4 h-4 fill-amber-400" /> {vendor.avg_rating > 0 ? vendor.avg_rating.toFixed(1) : 'New'}
                    </div>
                    {vendor.total_reviews > 0 && <span className="text-[10px] text-slate-500 mt-1">{vendor.total_reviews} reviews</span>}
                  </div>
                </div>

                <p className="text-sm text-slate-300 line-clamp-2 mb-6">{vendor.description}</p>

                <div className="mt-auto space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase">Available Services</h4>
                  {vendor.services && vendor.services.length > 0 ? (
                    <div className="grid gap-2">
                       {vendor.services.map((svc: any) => (
                         <div key={svc._id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                            <div>
                              <p className="text-sm font-semibold text-white">{svc.name}</p>
                              <p className="text-[10px] text-brand-300 uppercase">{svc.price_type.replace('_',' ')}</p>
                            </div>
                            <div className="flex items-center gap-4">
                               <p className="text-base font-black text-white">₹{svc.base_price}</p>
                               <button 
                                 onClick={() => { setSelectedService(svc); setSelectedVendor(vendor); }} 
                                 className="px-4 py-1.5 bg-brand-500/20 text-brand-300 hover:bg-brand-500 hover:text-white rounded-lg text-xs font-bold transition-colors"
                               >
                                 Book
                               </button>
                            </div>
                         </div>
                       ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No exact services listed yet. Contact directly.</p>
                  )}
                </div>
              </div>
           ))}
        </div>
      )}

      {selectedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
           <div className="max-w-md w-full glass-card rounded-2xl p-6 border border-white/10 animate-fade-in shadow-2xl relative">
              <h2 className="text-xl font-bold text-white mb-1">Book {selectedService.name}</h2>
              <p className="text-sm text-slate-400 mb-6">From {selectedVendor.business_name} • ₹{selectedService.base_price} {selectedService.price_type}</p>
              
              <form onSubmit={handleBookService} className="space-y-4">
                 <div>
                   <label className="block text-xs font-semibold text-slate-400 mb-1">Select Event to apply service to</label>
                   <select required className="input-glass w-full text-sm" value={bookData.event_id} onChange={e=>setBookData({...bookData, event_id:e.target.value})}>
                     <option value="">-- Choose an Event --</option>
                     {myEvents.map(ev => {
                       const identifier = ev.event_id || ev._id || ev.id;
                       return <option key={identifier} value={identifier}>{ev.title}</option>;
                     })}
                   </select>
                 </div>

                 <div>
                   <label className="block text-xs font-semibold text-slate-400 mb-1">Date Needed</label>
                   <input type="datetime-local" required className="input-glass w-full text-sm" value={bookData.date} onChange={e=>setBookData({...bookData, date:e.target.value})} />
                 </div>

                 {selectedService.price_type === 'PER_HOUR' && (
                   <div>
                     <label className="block text-xs font-semibold text-slate-400 mb-1">Required Hours</label>
                     <input type="number" min="1" required className="input-glass w-full text-sm" value={bookData.duration_hours} onChange={e=>setBookData({...bookData, duration_hours:e.target.value})} />
                   </div>
                 )}

                 {selectedService.price_type === 'PER_UNIT' && (
                   <div>
                     <label className="block text-xs font-semibold text-slate-400 mb-1">Quantity Needed</label>
                     <input type="number" min="1" required className="input-glass w-full text-sm" value={bookData.quantity} onChange={e=>setBookData({...bookData, quantity:e.target.value})} />
                   </div>
                 )}

                 <div>
                   <label className="block text-xs font-semibold text-slate-400 mb-1">Special Instructions (Optional)</label>
                   <textarea className="input-glass w-full text-sm" rows={2} value={bookData.notes} onChange={e=>setBookData({...bookData, notes:e.target.value})} placeholder="Dietary restrictions, color preferences, etc."/>
                 </div>

                 <div className="flex gap-3 pt-4 border-t border-white/10">
                   <button type="button" onClick={()=>setSelectedService(null)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-sm transition">Cancel</button>
                   <button type="submit" disabled={bookingLoading} className="flex-1 btn-primary py-3 flex justify-center text-sm">
                      {bookingLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Request"}
                   </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
