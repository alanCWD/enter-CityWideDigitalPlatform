import { Store, MapPin, Phone, Globe, MessageCircle, Star } from "lucide-react";

export interface NapData {
  business_name: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  category: string | null;
  rating: number | null;
}

export function NapDetails({ nap }: { nap: NapData }) {
  const fields = [
    { icon: Store, label: "Business Name", value: nap.business_name },
    { icon: MapPin, label: "Address", value: nap.address },
    { icon: Phone, label: "Phone", value: nap.phone },
    { icon: Globe, label: "Website", value: nap.website },
    { icon: MessageCircle, label: "Category", value: nap.category },
    { icon: Star, label: "Rating", value: nap.rating ? `${nap.rating} stars` : null },
  ];

  return (
    <div className="space-y-2.5">
      {fields.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="flex items-start gap-3 py-2 border-b border-white/5 last:border-b-0"
        >
          <Icon className="w-3.5 h-3.5 text-[#0078D7] mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-[10px] font-bold text-[rgba(238,241,250,0.4)] uppercase tracking-wide">
              {label}
            </div>
            <div className="text-xs text-[#EEF1FA] mt-0.5">
              {value || (
                <span className="text-[rgba(238,241,250,0.3)]">Not available</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
