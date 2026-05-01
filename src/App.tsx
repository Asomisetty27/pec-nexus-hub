import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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
import Unsubscribe from "./pages/Unsubscribe";
import ApplyLanding from "./pages/apply/ApplyLanding";
import ApplyForm from "./pages/apply/ApplyForm";
import ApplyConfirmation from "./pages/apply/ApplyConfirmation";
import Dashboard from "./pages/app/Dashboard";
import Projects from "./pages/app/Projects";
import ProjectDetail from "./pages/app/ProjectDetail";
import Messages from "./pages/app/Messages";
import Events from "./pages/app/Events";
import Members from "./pages/app/Members";
import CrmLayout from "./components/crm/CrmLayout";
import CrmDashboard from "./pages/app/crm/CrmDashboard";
import CrmPipeline from "./pages/app/crm/CrmPipeline";
import CrmMyCompanies from "./pages/app/crm/CrmMyCompanies";
import CrmTable from "./pages/app/crm/CrmTable";
import CrmContacts from "./pages/app/crm/CrmContacts";
import CrmQualified from "./pages/app/crm/CrmQualified";
import CrmAnalytics from "./pages/app/crm/CrmAnalytics";
import CrmLegacy from "./pages/app/crm/CrmLegacy";
import CompanyDetail from "./pages/app/crm/CompanyDetail";
import Competitions from "./pages/app/Competitions";
import Academy from "./pages/app/Academy";
import Training from "./pages/app/Training";
import Docs from "./pages/app/Docs";
import Admin from "./pages/app/Admin";
import Announcements from "./pages/app/Announcements";
import Settings from "./pages/app/Settings";
import CohortHub from "./pages/app/CohortHub";
import LabManual from "./pages/app/LabManual";
import MockProject from "./pages/app/MockProject";
import Scheduling from "./pages/app/Scheduling";
import LeadWorkspace from "./pages/app/LeadWorkspace";
import CommandCenter from "./pages/app/CommandCenter";
import PurposeTrack from "./pages/app/PurposeTrack";
import Opportunities from "./pages/app/Opportunities";
import ReviewQueue from "./pages/app/ReviewQueue";
import AdvisorPortal from "./pages/app/AdvisorPortal";
import AskNexus from "./pages/app/AskNexus";
import Grind from "./pages/app/Grind";
import GrindAdmin from "./pages/app/GrindAdmin";
import SkillDashboard from "./pages/app/SkillDashboard";
import RecruitmentLayout from "./pages/app/recruitment/RecruitmentLayout";
import RecruitmentOverviewPage from "./pages/app/recruitment/RecruitmentOverviewPage";
import RecruitmentInbox from "./pages/app/recruitment/RecruitmentInbox";
import RecruitmentPipeline from "./pages/app/recruitment/RecruitmentPipeline";
import ApplicantDetail from "./pages/app/recruitment/ApplicantDetail";

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
              <Route path="/apply" element={<ApplyLanding />} />
              <Route path="/apply/form" element={<ApplyForm />} />
              <Route path="/apply/confirmation" element={<ApplyConfirmation />} />
              <Route path="/login" element={<Login />} />
              <Route path="/invite/:token" element={<Login />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />
            </Route>
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="purpose" element={<PurposeTrack />} />
              <Route path="opportunities" element={<Opportunities />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/:id" element={<ProjectDetail />} />
              <Route path="messages" element={<Messages />} />
              <Route path="events" element={<Events />} />
              <Route path="members" element={<Members />} />
              <Route path="crm" element={<CrmLayout />}>
                <Route index element={<Navigate to="/app/crm/dashboard" replace />} />
                <Route path="dashboard" element={<CrmDashboard />} />
                <Route path="pipeline" element={<CrmPipeline />} />
                <Route path="my" element={<CrmMyCompanies />} />
                <Route path="table" element={<CrmTable />} />
                <Route path="contacts" element={<CrmContacts />} />
                <Route path="qualified" element={<CrmQualified />} />
                <Route path="analytics" element={<CrmAnalytics />} />
                <Route path="legacy" element={<CrmLegacy />} />
                <Route path="c/:id" element={<CompanyDetail />} />
              </Route>
              <Route path="competitions" element={<Competitions />} />
              <Route path="training" element={<Training />} />
              <Route path="academy" element={<Navigate to="/app/training?tab=learn" replace />} />
              <Route path="docs" element={<Docs />} />
              <Route path="admin" element={<Admin />} />
              <Route path="announcements" element={<Announcements />} />
              <Route path="settings" element={<Settings />} />
              <Route path="cohort" element={<CohortHub />} />
              <Route path="lab/:id" element={<LabManual />} />
              <Route path="mock-project/:id" element={<MockProject />} />
              <Route path="scheduling" element={<Scheduling />} />
              <Route path="lead" element={<LeadWorkspace />} />
              {/* Review queue is now part of Lead Workspace. Keep deep links working. */}
              <Route path="review" element={<Navigate to="/app/lead" replace />} />
              <Route path="review/:id" element={<ReviewQueue />} />
              {/* Canonical: Ops Dashboard is folded into Command Center. */}
              <Route path="ops" element={<Navigate to="/app/command" replace />} />
              {/* Canonical: Permissions / Invites / Analytics live in Admin tabs now. */}
              <Route path="permissions" element={<Navigate to="/app/admin?tab=identity" replace />} />
              <Route path="invites" element={<Navigate to="/app/admin?tab=invites" replace />} />
              <Route path="analytics" element={<Navigate to="/app/admin?tab=analytics" replace />} />
              <Route path="command" element={<CommandCenter />} />
              <Route path="advisor" element={<AdvisorPortal />} />
              <Route path="ask" element={<AskNexus />} />
              <Route path="grind" element={<Grind />} />
              <Route path="grind/admin" element={<GrindAdmin />} />
              <Route path="skills" element={<SkillDashboard />} />
              <Route path="recruitment" element={<RecruitmentLayout />}>
                <Route index element={<RecruitmentOverviewPage />} />
                <Route path="inbox" element={<RecruitmentInbox />} />
                <Route path="pipeline" element={<RecruitmentPipeline />} />
                <Route path="c/:id" element={<ApplicantDetail />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
