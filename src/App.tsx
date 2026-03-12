import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Services from "./pages/Services";
import Sponsors from "./pages/Sponsors";
import Intake from "./pages/Intake";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/app/Dashboard";
import Projects from "./pages/app/Projects";
import ProjectDetail from "./pages/app/ProjectDetail";
import Messages from "./pages/app/Messages";
import Events from "./pages/app/Events";
import Members from "./pages/app/Members";
import CRM from "./pages/app/CRM";
import Competitions from "./pages/app/Competitions";
import Academy from "./pages/app/Academy";
import Docs from "./pages/app/Docs";
import Admin from "./pages/app/Admin";
import Analytics from "./pages/app/Analytics";
import Announcements from "./pages/app/Announcements";
import Settings from "./pages/app/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/services" element={<Services />} />
              <Route path="/sponsors" element={<Sponsors />} />
              <Route path="/intake" element={<Intake />} />
              <Route path="/login" element={<Login />} />
            </Route>
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/:id" element={<ProjectDetail />} />
              <Route path="messages" element={<Messages />} />
              <Route path="events" element={<Events />} />
              <Route path="members" element={<Members />} />
              <Route path="crm" element={<CRM />} />
              <Route path="competitions" element={<Competitions />} />
              <Route path="academy" element={<Academy />} />
              <Route path="docs" element={<Docs />} />
              <Route path="admin" element={<Admin />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="announcements" element={<Announcements />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
