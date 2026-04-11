import { useState, useEffect } from "react";
import { Copy, Loader2, MapPin, Navigation, Map } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";

interface TransportOption {
  vehicle_type: "BIKE" | "CAR" | "VAN";
  distance_km: number;
  fare: number;
  currency: string;
}

interface TransportSelectorProps {
  onSelect: (option: TransportOption | null, pickup: string, drop: string) => void;
  eventVenue: string;
}

export default function TransportSelector({ onSelect, eventVenue }: TransportSelectorProps) {
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState(eventVenue);
  const [options, setOptions] = useState<TransportOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<"BIKE" | "CAR" | "VAN" | null>(null);

  const [useCurrentLocation, setUseCurrentLocation] = useState(false);

  // Auto-fetch if both addresses are filled
  useEffect(() => {
    if (pickup.trim().length > 5 && drop.trim().length > 5) {
      const delay = setTimeout(() => {
        fetchQuotes();
      }, 800);
      return () => clearTimeout(delay);
    } else {
      setOptions([]);
      setSelectedType(null);
      onSelect(null, pickup, drop);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup, drop]);

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      const res = await api.post("/transport/quote/all", {
        pickup_address: pickup,
        drop_address: drop,
        vehicle_type: "CAR", // needed for schema but 'all' ignores it
      });
      setOptions(res.data);
      // Auto-select if one was already chosen, else leave null
      if (selectedType) {
        const match = res.data.find((o: TransportOption) => o.vehicle_type === selectedType);
        if (match) onSelect(match, pickup, drop);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Could not calculate distance. Please check addresses.");
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (option: TransportOption) => {
    setSelectedType(option.vehicle_type);
    onSelect(option, pickup, drop);
  };

  const handleClear = () => {
    setPickup("");
    setOptions([]);
    setSelectedType(null);
    onSelect(null, "", drop);
    setUseCurrentLocation(false);
  };

  const handleGetCurrentLocation = () => {
    if ("geolocation" in navigator) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          try {
             // Basic reverse geocoding via free api (or just passing lat,lng)
             // Google maps distance matrix accepts lat,lng strings: "lat,lng"
             setPickup(`${lat},${lng}`);
             setUseCurrentLocation(true);
             toast.success("Location locked!");
          } finally {
            setLoading(false);
          }
        },
        (error) => {
          console.error(error);
          toast.error("Could not get location. Please type it manually.");
          setLoading(false);
        }
      );
    } else {
      toast.error("Geolocation not supported.");
    }
  };


  return (
    <div className="glass-card rounded-2xl p-5 border border-white/5 bg-white/5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Navigation className="w-5 h-5 text-brand-400" />
        <h3 className="font-heading font-bold text-lg text-white">Add Pickup & Drop (Optional)</h3>
      </div>

      <div className="space-y-3 relative">
        <div className="relative">
          <div className="absolute left-3 top-3.5 flex flex-col items-center gap-1">
             <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
             <div className="w-0.5 h-6 bg-white/10"></div>
             <div className="w-2.5 h-2.5 rounded-sm bg-rose-400"></div>
          </div>

          <div className="pl-8 space-y-3">
             <div className="relative">
               <input
                  type="text"
                  placeholder="Enter Pickup Location"
                  className="input-glass w-full text-sm py-3"
                  value={pickup}
                  onChange={(e) => {
                    setPickup(e.target.value);
                    setUseCurrentLocation(false);
                  }}
               />
               <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-brand-400 transition-colors"
                  title="Use current location"
               >
                 <MapPin className="w-5 h-5" />
               </button>
             </div>

             <input
                type="text"
                placeholder="Enter Drop Location"
                className="input-glass w-full text-sm py-3"
                value={drop}
                onChange={(e) => setDrop(e.target.value)}
             />
          </div>
        </div>

        {useCurrentLocation && (
          <p className="text-xs text-brand-400 pl-8">Using current GPS coordinates</p>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-4">
           <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
        </div>
      )}

      {options.length > 0 && !loading && (
        <div className="pt-2 animate-fade-in space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
             <span>Distance: {options[0].distance_km} km</span>
             <button onClick={handleClear} className="hover:text-white transition-colors">Clear</button>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
             {options.map((opt) => (
                <button
                  key={opt.vehicle_type}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                    selectedType === opt.vehicle_type
                      ? "bg-brand-500/20 border-brand-500 text-white"
                      : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <Map className="w-5 h-5 mb-1" />
                  <span className="text-xs font-semibold">{opt.vehicle_type}</span>
                  <span className="text-sm font-bold text-white">₹{opt.fare}</span>
                </button>
             ))}
          </div>
        </div>
      )}
    </div>
  );
}
