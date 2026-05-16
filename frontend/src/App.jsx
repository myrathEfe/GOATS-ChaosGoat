import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import AnimatedBackground from "./components/AnimatedBackground";
import Layout from "./components/Layout";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Scenarios from "./pages/Scenarios";
import Reports from "./pages/Reports";
import AISuggestions from "./pages/AISuggestions";

function OnboardingGuard() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onboarded = sessionStorage.getItem("onboarded");
    if (!onboarded && location.pathname !== "/onboarding") {
      navigate("/onboarding", { replace: true });
    }
  }, [location.pathname, navigate]);

  return null;
}

export default function App() {
  return (
    <>
      <AnimatedBackground />
      <OnboardingGuard />
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/scenarios" element={<Layout><Scenarios /></Layout>} />
        <Route path="/reports" element={<Layout><Reports /></Layout>} />
        <Route path="/ai-suggests" element={<Layout><AISuggestions /></Layout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
