import { Truck, RefreshCw, ShieldCheck, Headphones } from "lucide-react";

const features = [
  { icon: Truck, title: "Free shipping", desc: "On orders over 300 DH" },
  { icon: RefreshCw, title: "30-day returns", desc: "No-questions-asked" },
  { icon: ShieldCheck, title: "2-year warranty", desc: "On all devices" },
  { icon: Headphones, title: "Real support", desc: "7 days a week" },
];

export function FeatureBar() {
  return (
    <section className="border-y bg-surface">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-6 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="flex items-center gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-background">
              <f.icon size={20} className="text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold">{f.title}</p>
              <p className="text-xs text-muted">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
