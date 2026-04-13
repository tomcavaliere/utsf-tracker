import { NavLink, Outlet } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  LayoutDashboard,
  PlusCircle,
  BarChart3,
  CalendarDays,
  Settings,
} from "lucide-react";
import { getProfile } from "@/db";
import { daysUntilRace } from "@/utils/plan";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/log", icon: PlusCircle, label: "Log" },
  { to: "/plan", icon: CalendarDays, label: "Plan" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/settings", icon: Settings, label: "Settings" },
] as const;

export default function Layout() {
  const profile = useLiveQuery(() => getProfile());
  const days = daysUntilRace(profile?.raceDate ?? "2026-10-02");

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-brand-400">UTSF</span> Tracker
          </span>
        </div>
        <div className="text-sm text-gray-400">
          <span className="text-brand-400 font-semibold text-lg">{days}</span>{" "}
          jours avant la course
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6 max-w-5xl mx-auto w-full">
        <Outlet />
      </main>

      {/* Bottom nav (mobile-first) */}
      <nav className="bg-gray-900 border-t border-gray-800 px-2 py-2 flex justify-around">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                isActive
                  ? "text-brand-400"
                  : "text-gray-500 hover:text-gray-300"
              }`
            }
          >
            <Icon size={20} />
            <span className="text-xs">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
