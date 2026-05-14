import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { AppHeader } from "./components/AppHeader";
import Index from "./pages/Index";
import Account from "./pages/Account";
import Auth from "./pages/Auth";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import QATest from "./pages/QATest";
import QAAnalysis from "./pages/QAAnalysis";
import LogicVerification from "./pages/LogicVerification";
import StravaCallback from "./pages/StravaCallback";
import GarminCallback from "./pages/GarminCallback";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      {/* <Toaster /> */}
      {/* <Sonner /> */}
      <AuthProvider>
      <BrowserRouter>
        <AppHeader />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/account" element={<Account />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/qa-test" element={<QATest />} />
          <Route path="/qa-analysis" element={<QAAnalysis />} />
          <Route path="/logic-check" element={<LogicVerification />} />
          <Route path="/strava-callback" element={<StravaCallback />} />
          <Route path="/garmin-callback" element={<GarminCallback />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
