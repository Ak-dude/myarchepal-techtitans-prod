import {
  Home,
  Compass,
  Package,
  Newspaper,
  Calendar,
  Store,
  Heart,
  Plus,
  PlusSquare,
  User,
  LogIn,
  ChevronDown,
  Info,
  Mail,
  Settings,
  Lock,
  LogOut,
  BookOpen,
  MessageSquare,
  Building2,
  Shield,
  FileText,
  ClipboardList,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { CreateSiteModal } from "@/components/CreateSiteModal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useArchaeologist } from "@/hooks/use-archaeologist";
import { useUser } from "@/hooks/use-user";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Explore submenu items
const exploreItems = [
  { icon: Compass, label: "Sites", path: "/site-lists" },
  { icon: Package, label: "Artifacts", path: "/artifacts" },
  { icon: Newspaper, label: "Articles", path: "/articles" },
  { icon: Calendar, label: "Events", path: "/events" },
];

// Create submenu items (for archaeologists)
const createItems = [
  { icon: PlusSquare, label: "Create Site", path: "/new-site" },
  { icon: Package, label: "Create Artifact", path: "/create-artifact" },
  { icon: Newspaper, label: "Create Article", path: "/create-article" },
  { icon: Calendar, label: "Create Event", path: "/create-event" },
  { icon: BookOpen, label: "Diary", path: "/digital-diary" },
];

// Gift Shop submenu items
const giftShopItems = [
  { icon: Heart, label: "Donate Funds", path: "/donations" },
  { icon: Store, label: "Buy Gifts", path: "/gift-shop" },
];

// Account submenu items (for authenticated users)
const accountItems = [
  { icon: User, label: "Profile", path: "/account" },
  { icon: Lock, label: "Change Password", path: "/edit-profile" },
  { icon: Settings, label: "Settings", path: "/account" },
  { icon: Info, label: "About Us", path: "/about-us" },
  { icon: Mail, label: "Contact Us", path: "/contact" },
  { icon: MessageSquare, label: "Give Feedback", path: "/feedback" },
];

export const SideNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const { isArchaeologist } = useArchaeologist();
  const { isSuperAdmin, isAdmin, isMember } = useUser();
  const [isExploreOpen, setIsExploreOpen] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isGiftShopOpen, setIsGiftShopOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [createSiteModalOpen, setCreateSiteModalOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const isExploreActive = exploreItems.some(item => isActive(item.path));
  const isGiftShopActive = giftShopItems.some(item => isActive(item.path));
  const isAccountActive = accountItems.some(item => isActive(item.path));
  const isAdminActive = isActive('/admin') || isActive('/org-dashboard') || location.pathname.startsWith('/templates') || location.pathname.startsWith('/admin-assignments') || location.pathname.startsWith('/assign-form');

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 xl:w-72 bg-card border-r border-border z-50">
      {/* Logo Section */}
      <div className="p-6 border-b border-border">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <img
            src="/archepal.png"
            alt="ArchePal Logo"
            className="w-10 h-10 xl:w-12 xl:h-12 object-contain"
          />
          <span className="text-xl xl:text-2xl font-bold text-foreground tracking-tight font-sans">
            ArchePal
          </span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {/* Home */}
        <button
          onClick={() => navigate("/")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group mb-1 ${
            isActive("/")
              ? "bg-primary/10 text-primary"
              : "text-slate-700 dark:text-slate-300 hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Home className={`w-5 h-5 transition-transform group-hover:scale-110 ${
            isActive("/") ? "text-primary" : ""
          }`} />
          <span>Home</span>
        </button>

        {/* Explore Collapsible */}
        <Collapsible open={isExploreOpen} onOpenChange={setIsExploreOpen} className="mb-1">
          <CollapsibleTrigger asChild>
            <button
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isExploreActive && !isExploreOpen
                  ? "bg-primary/10 text-primary"
                  : "text-slate-700 dark:text-slate-300 hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <span className="flex items-center gap-3">
                <Compass className={`w-5 h-5 ${isExploreActive ? "text-primary" : ""}`} />
                Explore
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isExploreOpen ? 'rotate-180' : ''}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 space-y-0.5">
            {exploreItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 pl-12 text-sm font-medium rounded-lg transition-colors ${
                  isActive(item.path)
                    ? "text-primary bg-primary/5"
                    : "text-slate-600 dark:text-slate-400 hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </CollapsibleContent>
        </Collapsible>

        {/* Create Collapsible - Only for Archaeologists */}
        {isAuthenticated && isArchaeologist && (
          <Collapsible open={isCreateOpen} onOpenChange={setIsCreateOpen} className="mb-1">
            <CollapsibleTrigger asChild>
              <button
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-slate-700 dark:text-slate-300 hover:text-foreground hover:bg-muted/50"
              >
                <span className="flex items-center gap-3">
                  <Plus className="w-5 h-5" />
                  Create
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isCreateOpen ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 space-y-0.5">
              {createItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    setIsCreateOpen(false);
                    if (item.path === '/new-site') {
                      setCreateSiteModalOpen(true);
                    } else {
                      navigate(item.path);
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 pl-12 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </CollapsibleContent>
            <CreateSiteModal open={createSiteModalOpen} onOpenChange={setCreateSiteModalOpen} />
          </Collapsible>
        )}

        {/* Admin Collapsible - Only for Admin Users */}
        {isAuthenticated && isAdmin && (
          <Collapsible open={isAdminOpen} onOpenChange={setIsAdminOpen} className="mb-1">
            <CollapsibleTrigger asChild>
              <button
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isAdminActive && !isAdminOpen
                    ? "bg-primary/10 text-primary"
                    : "text-slate-700 dark:text-slate-300 hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Shield className={`w-5 h-5 ${isAdminActive ? "text-primary" : ""}`} />
                  Admin
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isAdminOpen ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 space-y-0.5">
              {/* Org Dashboard - for all admins */}
              <button
                onClick={() => navigate('/org-dashboard')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 pl-12 text-sm font-medium rounded-lg transition-colors ${
                  isActive('/org-dashboard')
                    ? "text-primary bg-primary/5"
                    : "text-slate-600 dark:text-slate-400 hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Building2 className="w-4 h-4" />
                Organization
              </button>
              {/* Form Templates */}
              <button
                onClick={() => navigate('/templates')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 pl-12 text-sm font-medium rounded-lg transition-colors ${
                  location.pathname.startsWith('/templates')
                    ? "text-primary bg-primary/5"
                    : "text-slate-600 dark:text-slate-400 hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <FileText className="w-4 h-4" />
                Form Templates
              </button>
              {/* Site Assignments */}
              <button
                onClick={() => navigate('/admin-assignments')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 pl-12 text-sm font-medium rounded-lg transition-colors ${
                  location.pathname.startsWith('/admin-assignments') || location.pathname.startsWith('/assign-form')
                    ? "text-primary bg-primary/5"
                    : "text-slate-600 dark:text-slate-400 hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                Site Assignments
              </button>
              {/* Super Admin Dashboard - only for super admins */}
              {isSuperAdmin && (
                <button
                  onClick={() => navigate('/admin')}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 pl-12 text-sm font-medium rounded-lg transition-colors ${
                    isActive('/admin')
                      ? "text-primary bg-primary/5"
                      : "text-slate-600 dark:text-slate-400 hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Super Admin
                </button>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}


        {/* Gift Shop Collapsible */}
        <Collapsible open={isGiftShopOpen} onOpenChange={setIsGiftShopOpen} className="mb-1">
          <CollapsibleTrigger asChild>
            <button
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isGiftShopActive && !isGiftShopOpen
                  ? "bg-primary/10 text-primary"
                  : "text-slate-700 dark:text-slate-300 hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <span className="flex items-center gap-3">
                <Store className={`w-5 h-5 ${isGiftShopActive ? "text-primary" : ""}`} />
                Gift Shop
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isGiftShopOpen ? 'rotate-180' : ''}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 space-y-0.5">
            {giftShopItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 pl-12 text-sm font-medium rounded-lg transition-colors ${
                  isActive(item.path)
                    ? "text-primary bg-primary/5"
                    : "text-slate-600 dark:text-slate-400 hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </CollapsibleContent>
        </Collapsible>

        {/* My Assignments — MEMBER role only (not shown to admins) */}
        {isAuthenticated && isMember && !isAdmin && (
          <button
            onClick={() => navigate('/my-assignments')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 mb-1 ${
              location.pathname.startsWith('/my-assignments') || location.pathname.startsWith('/form/')
                ? 'bg-primary/10 text-primary'
                : 'text-slate-700 dark:text-slate-300 hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <ClipboardList className={`w-5 h-5 ${location.pathname.startsWith('/my-assignments') || location.pathname.startsWith('/form/') ? 'text-primary' : ''}`} />
            <span>My Assignments</span>
          </button>
        )}

        {/* Account Collapsible - Only for Authenticated Users */}
        {isAuthenticated && (
          <Collapsible open={isAccountOpen} onOpenChange={setIsAccountOpen} className="mt-4 pt-4 border-t border-border/50">
            <CollapsibleTrigger asChild>
              <button
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isAccountActive && !isAccountOpen
                    ? "bg-primary/10 text-primary"
                    : "text-slate-700 dark:text-slate-300 hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <span className="flex items-center gap-3">
                  <User className={`w-5 h-5 ${isAccountActive ? "text-primary" : ""}`} />
                  Account
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isAccountOpen ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 space-y-0.5">
              {accountItems.map((item) => (
                <button
                  key={item.path + item.label}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 pl-12 text-sm font-medium rounded-lg transition-colors ${
                    isActive(item.path) && item.label === "Profile"
                      ? "text-primary bg-primary/5"
                      : "text-slate-600 dark:text-slate-400 hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 pl-12 text-sm font-medium rounded-lg transition-colors text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </CollapsibleContent>
          </Collapsible>
        )}
      </nav>

      {/* Sign In Section - Only for Non-Authenticated Users */}
      {!isAuthenticated && (
        <div className="p-4 border-t border-border space-y-2">
          <Button
            variant="default"
            className="w-full justify-center gap-2 h-11"
            onClick={() => navigate("/authentication/sign-in")}
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </Button>
          <Button
            variant="outline"
            className="w-full justify-center gap-2 h-10"
            onClick={() => navigate("/authentication/sign-up")}
          >
            Create Account
          </Button>
        </div>
      )}
    </aside>
  );
};
