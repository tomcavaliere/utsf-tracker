import { Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/components/Dashboard";
import SessionLogger from "@/components/SessionLogger";
import TrainingPlan from "@/components/TrainingPlan";
import Analytics from "@/components/Analytics";
import Settings from "@/components/Settings";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="log" element={<SessionLogger />} />
        <Route path="plan" element={<TrainingPlan />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
