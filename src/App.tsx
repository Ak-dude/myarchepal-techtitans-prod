/**
 * Main App Component
 *
 * Sets up the application with providers and routing:
 * - QueryClientProvider: React Query for data fetching
 * - TooltipProvider: Tooltip UI component provider
 * - AuthProvider: Authentication context provider (wraps entire app)
 * - HashRouter: React Router for navigation (Capacitor compatible)
 *
 * Routes:
 * - Public routes: /, /authentication/sign-in, /authentication/sign-up
 * - Protected routes: /account, /edit-profile, etc.
 */

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { useCapacitorInit } from "@/hooks/use-capacitor";
import { AuthProvider } from "@/hooks/use-auth";
import { ChatProvider } from "@/hooks/use-chat";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SuperAdminRoute, AdminRoute } from "@/components/RoleProtectedRoute";
import Index from "./pages/Index";
import AdminDashboard from "./pages/AdminDashboard";
import OrgAdminDashboard from "./pages/OrgAdminDashboard";
import AcceptInvite from "./pages/AcceptInvite";
import NewSite from "./pages/NewSite";
import EditSite from "./pages/EditSite";
import SiteMap from "./pages/SiteMap";
import SiteLists from "./pages/SiteLists";
import SiteDetails from "./pages/SiteDetails";
import Analysis from "./pages/Analysis";
import Team from "./pages/Team";
import Explore from "./pages/Explore";
import Reports from "./pages/Reports";
import Account from "./pages/Account";
import EditProfile from "./pages/EditProfile";
import Feedback from "./pages/Feedback";
import FeedbackResults from "./pages/FeedbackResults";
import SignIn from "./pages/Authentication/sign-in";
import SignUp from "./pages/Authentication/sign-up";
import Articles from "./pages/Articles";
import ArticleDetails from "./pages/ArticleDetails";
import Blogs from "./pages/Blogs";
import CreateArticle from "./pages/CreateArticle";
import EditArticle from "./pages/EditArticle";
import Artifacts from "./pages/Artifacts";
import ArtifactDetails from "./pages/ArtifactDetails";
import CreateArtifact from "./pages/CreateArtifact";
import EditArtifact from "./pages/EditArtifact";
import Checkout from "./pages/Checkout";
import Donations from "./pages/Donations";
import ContactUs from "./pages/ContactUs";
import Events from "./pages/Events";
import EventDetails from "./pages/EventDetails";
import CreateEvent from "./pages/CreateEvent";
import GiftShop from "./pages/GiftShop";
import CheckoutMerchandise from "./pages/CheckoutMerchandise";
import CreateMerchandise from "./pages/CreateMerchandise";
import Contributors from "./pages/Contributors";
import DigitalDiary from "./pages/DigitalDiary";
import ChatArea from "./pages/ChatArea";
import AboutUs from "./pages/AboutUs";
import SiteTimeMachine from "./pages/SiteTimeMachine";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";
import TemplateList from "./pages/TemplateList";
import TemplateImportPDF from "./pages/TemplateImportPDF";
import TemplateEditor from "./pages/TemplateEditor";
import TemplateBuilder from "./pages/TemplateBuilder";
import AdminSiteAssignments from "./pages/AdminSiteAssignments";
import AssignForm from "./pages/AssignForm";
import MyAssignments from "./pages/MyAssignments";
import FormFill from "./pages/FormFill";
import SubmissionDetail from "./pages/SubmissionDetail";
import { HelpButton } from "@/components/HelpButton";

// Create React Query client instance
const queryClient = new QueryClient();

const App = () => {
  // Initialize Capacitor plugins (status bar, splash screen, keyboard)
  useCapacitorInit();

  return (
  // React Query provider for data fetching
  <QueryClientProvider client={queryClient}>
    {/* Tooltip provider for UI components */}
    <TooltipProvider>
      {/* Auth provider wraps entire app to provide authentication state */}
      <AuthProvider>
        {/* Chat provider for multi-room chat functionality */}
        <ChatProvider>
          {/* Toast notification components */}
          <Toaster />
          <Sonner />
          {/* React Router for navigation - HashRouter for Capacitor compatibility */}
          <HashRouter>
            <HelpButton />
            <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/site-map" element={<SiteMap />} />
            <Route path="/site-lists" element={<SiteLists />} />
            <Route path="/site/:id" element={<SiteDetails />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/team" element={<Team />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/articles" element={<Articles />} />
            <Route path="/article/:id" element={<ArticleDetails />} />
            <Route path="/blogs" element={<Blogs />} />
            <Route path="/artifacts" element={<Artifacts />} />
            <Route path="/artifact/:id" element={<ArtifactDetails />} />
            <Route path="/checkout/:id" element={<Checkout />} />
            <Route path="/donations" element={<Donations />} />
            <Route path="/gift-shop" element={<GiftShop />} />
            <Route path="/contributors" element={<Contributors />} />
            <Route path="/checkout-merchandise/:id" element={<CheckoutMerchandise />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="/events" element={<Events />} />
            <Route path="/event/:id" element={<EventDetails />} />
            <Route path="/digital-diary" element={<DigitalDiary />} />
            <Route path="/about-us" element={<AboutUs />} />
            <Route path="/site-time-machine" element={<SiteTimeMachine />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/chat" element={
              <ProtectedRoute>
                <ChatArea />
              </ProtectedRoute>
            } />

            {/* Protected creation routes - require authentication */}
            <Route path="/new-site" element={
              <ProtectedRoute>
                <NewSite />
              </ProtectedRoute>
            } />
            <Route path="/edit-site/:id" element={
              <ProtectedRoute>
                <EditSite />
              </ProtectedRoute>
            } />
            <Route path="/create-article" element={
              <ProtectedRoute>
                <CreateArticle />
              </ProtectedRoute>
            } />
            <Route path="/edit-article/:id" element={
              <ProtectedRoute>
                <EditArticle />
              </ProtectedRoute>
            } />
            <Route path="/create-artifact" element={
              <ProtectedRoute>
                <CreateArtifact />
              </ProtectedRoute>
            } />
            <Route path="/edit-artifact/:id" element={
              <ProtectedRoute>
                <EditArtifact />
              </ProtectedRoute>
            } />
            <Route path="/create-event" element={
              <ProtectedRoute>
                <CreateEvent />
              </ProtectedRoute>
            } />
            <Route path="/create-merchandise" element={
              <ProtectedRoute>
                <CreateMerchandise />
              </ProtectedRoute>
            } />

            {/* Authentication routes */}
            <Route path="/authentication/sign-in" element={<SignIn />} />
            <Route path="/authentication/sign-up" element={<SignUp />} />

            {/* Protected routes (require authentication) */}
            <Route path="/account" element={<Account />} />
            <Route path="/edit-profile" element={<EditProfile />} />
            <Route path="/feedback" element={
              <ProtectedRoute>
                <Feedback />
              </ProtectedRoute>
            } />
            <Route path="/feedback-results" element={<FeedbackResults />} />

            {/* Admin routes (require Super Admin role) */}
            <Route path="/admin" element={
              <SuperAdminRoute>
                <AdminDashboard />
              </SuperAdminRoute>
            } />

            {/* Organization Admin routes (require Org Admin or Super Admin role) */}
            <Route path="/org-dashboard" element={
              <AdminRoute>
                <OrgAdminDashboard />
              </AdminRoute>
            } />

            {/* Template management routes */}
            <Route path="/templates" element={
              <AdminRoute>
                <TemplateList />
              </AdminRoute>
            } />
            <Route path="/templates/new/pdf" element={
              <AdminRoute>
                <TemplateImportPDF />
              </AdminRoute>
            } />
            <Route path="/templates/:templateId/edit" element={
              <AdminRoute>
                <TemplateEditor />
              </AdminRoute>
            } />
            <Route path="/templates/new/blank" element={
              <AdminRoute>
                <TemplateBuilder />
              </AdminRoute>
            } />

            {/* Phase 4 — Consultant routes */}
            <Route path="/my-assignments" element={
              <ProtectedRoute>
                <MyAssignments />
              </ProtectedRoute>
            } />
            <Route path="/form/:siteId" element={
              <ProtectedRoute>
                <FormFill />
              </ProtectedRoute>
            } />
            <Route path="/submission/:siteId/:submissionId" element={
              <ProtectedRoute>
                <SubmissionDetail />
              </ProtectedRoute>
            } />

            {/* Phase 3 — Site assignment routes */}
            <Route path="/admin-assignments" element={
              <AdminRoute>
                <AdminSiteAssignments />
              </AdminRoute>
            } />
            <Route path="/assign-form/:siteId" element={
              <AdminRoute>
                <AssignForm />
              </AdminRoute>
            } />

            {/* Invitation acceptance route (public but requires valid token) */}
            <Route path="/accept-invite" element={<AcceptInvite />} />

            {/* Catch-all route for 404 pages */}
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
            </Routes>
          </HashRouter>
        </ChatProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
