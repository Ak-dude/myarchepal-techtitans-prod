import { Home, Compass, Plus, Heart, Newspaper, Package, PlusSquare, Calendar, Store, Box, Menu, Users, User, Settings, Lock, Info, Mail, LogOut, ChevronRight, BookOpen, MessageSquare, Star, Building2, Shield, ClipboardList, Upload, Moon, Sun, Trash2 } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useState } from "react";
import { CreateSiteModal } from "@/components/CreateSiteModal";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useArchaeologist } from "@/hooks/use-archaeologist";
import { useUser } from "@/hooks/use-user";

// Explore items (shown in Explore submenu)
const exploreItems = [
  { icon: Compass, label: "Sites", description: "Browse archaeological sites", path: "/site-lists" },
  { icon: BookOpen, label: "Diary", description: "Write in your digital diary", path: "/digital-diary" },
  { icon: Package, label: "Artifacts", description: "Explore discovered artifacts", path: "/artifacts" },
  { icon: Newspaper, label: "Articles", description: "Read research articles", path: "/articles" },
  { icon: Calendar, label: "Events", description: "Upcoming events", path: "/events" },
];

// Create items (for archaeologists)
const createItems = [
  { icon: PlusSquare, label: "Create Site", description: "Add a new archaeological site", path: "/new-site" },
  { icon: Package, label: "Create Artifact", description: "Add a new artifact to the catalog", path: "/create-artifact" },
  { icon: Newspaper, label: "Create Article", description: "Write a new article", path: "/create-article" },
  { icon: Calendar, label: "Create Event", description: "Add a new event", path: "/create-event" },
  { icon: BookOpen, label: "Diary", description: "Write in your digital diary", path: "/digital-diary" },
];

// Gift Shop items
const giftShopItems = [
  { icon: Store, label: "Merchandise", description: "Browse and purchase items", path: "/gift-shop" },
  { icon: Box, label: "3D Artifacts", description: "Explore 3D artifact models", path: "/artifacts?type=3d" },
];

// Account items (for authenticated users)
const accountItems = [
  { icon: User, label: "Profile", description: "View your profile", path: "/account" },
  { icon: Lock, label: "Change Password", description: "Update your password", path: "/edit-profile" },
  { icon: Settings, label: "Settings", description: "App settings", path: "/account" },
  { icon: Trash2, label: "Deactivate Account", description: "Delete your account permanently", path: "/deactivate", destructive: true },
];

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const { isArchaeologist } = useArchaeologist();
  const { isSuperAdmin, isAdmin, isMember, can } = useUser();
  const { theme, toggleTheme } = useTheme();
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [isGiftShopSheetOpen, setIsGiftShopSheetOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<'explore' | 'account' | null>(null);
  const [createSiteModalOpen, setCreateSiteModalOpen] = useState(false);

  const handleCreateClick = () => {
    setIsCreateSheetOpen(true);
  };

  const handleContentOptionClick = (path: string) => {
    setIsCreateSheetOpen(false);
    if (path === '/new-site') {
      setCreateSiteModalOpen(true);
    } else {
      navigate(path);
    }
  };

  const handleGiftShopOptionClick = (path: string) => {
    setIsGiftShopSheetOpen(false);
    navigate(path);
  };

  const handleMenuItemClick = (path: string) => {
    setIsMenuOpen(false);
    setActiveSubmenu(null);
    navigate(path);
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsMenuOpen(false);
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Check if current path matches explore items
  const isExploreActive = exploreItems.some(item => location.pathname === item.path);

  // Gift Shop active check
  const isGiftShopActive =
    location.pathname === "/gift-shop" ||
    (location.pathname === "/artifacts" && location.search === "?type=3d");

  return (
    <>
      {/* Bottom Navigation Bar - Hidden on desktop (lg+) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border shadow-lg z-50 safe-bottom">
        {/* Footer Info Strip */}
        <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground px-2 pt-1.5 pb-0.5">
          <span>&copy; {new Date().getFullYear()} ArchePal</span>
          <span>|</span>
          <Link
            to="/feedback-results"
            className="hover:text-primary transition-colors flex items-center gap-0.5"
          >
            <Star className="w-3 h-3" />
            Testimonials
          </Link>
          <span>|</span>
          <span className="font-medium">Tech Titans&trade;</span>
        </div>
        <div className="flex items-center justify-around max-w-lg mx-auto px-2 py-2 relative">

          {/* Home */}
          <button
            onClick={() => navigate("/")}
            className={`flex flex-col items-center gap-0.5 p-3 min-w-[4rem] rounded-xl transition-all duration-200 active:scale-95 ${
              location.pathname === "/"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Home className="w-6 h-6" />
            <span className="text-micro font-medium leading-snug font-sans tracking-wide">Home</span>
          </button>

          {/* Explore */}
          <button
            onClick={() => {
              setActiveSubmenu('explore');
              setIsMenuOpen(true);
            }}
            className={`flex flex-col items-center gap-0.5 p-3 min-w-[4rem] rounded-xl transition-all duration-200 active:scale-95 ${
              isExploreActive
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Compass className="w-6 h-6" />
            <span className="text-micro font-medium leading-snug font-sans tracking-wide">Explore</span>
          </button>

          {/* Center Create Button - For archaeologists and users who can create content */}
          {isAuthenticated && (isArchaeologist || can('content:create')) ? (
            <button
              onClick={handleCreateClick}
              className="flex items-center justify-center w-14 h-14 -mt-7 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 active:scale-95 transition-all duration-200 ring-4 ring-background"
              aria-label="Create new content"
            >
              <Plus className="w-7 h-7" />
            </button>
          ) : (
            // Placeholder for non-eligible users to maintain spacing
            <div className="w-14 h-14 -mt-7" />
          )}

          {/* Gift Shop — Tab 4 */}
          <button
            onClick={() => setIsGiftShopSheetOpen(true)}
            className={`flex flex-col items-center gap-0.5 p-3 min-w-[4rem] rounded-xl transition-all duration-200 active:scale-95 ${
              isGiftShopActive
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Store className="w-6 h-6" />
            <span className="text-micro font-medium leading-snug font-sans tracking-wide">Gift Shop</span>
          </button>

          {/* Account / More Menu */}
          <button
            onClick={() => {
              setActiveSubmenu('account');
              setIsMenuOpen(true);
            }}
            className={`flex flex-col items-center gap-0.5 p-3 min-w-[4rem] rounded-xl transition-all duration-200 active:scale-95 ${
              location.pathname === "/account"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {isAuthenticated ? <User className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            <span className="text-micro font-medium leading-snug font-sans tracking-wide">
              {isAuthenticated ? "Account" : "More"}
            </span>
          </button>
        </div>
      </nav>

      {/* Menu Sheet (Explore or Account) */}
      <Sheet open={isMenuOpen} onOpenChange={(open) => {
        setIsMenuOpen(open);
        if (!open) setActiveSubmenu(null);
      }}>
        <SheetContent side="bottom" className="max-w-lg mx-auto rounded-t-3xl safe-bottom">
          <SheetHeader className="text-left">
            <SheetTitle className="text-h3 font-heading font-bold leading-tight">
              {activeSubmenu === 'explore' ? 'Explore' : isAuthenticated ? 'Account' : 'Menu'}
            </SheetTitle>
            <SheetDescription className="text-body-sm font-sans text-muted-foreground leading-normal">
              {activeSubmenu === 'explore'
                ? 'Discover archaeological content'
                : isAuthenticated
                  ? 'Manage your account settings'
                  : 'Navigate to more sections'
              }
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-1 pb-4">
            {activeSubmenu === 'explore' ? (
              // Explore submenu
              exploreItems.map((item) => (
                <Button
                  key={item.path}
                  variant="ghost"
                  className="w-full h-auto py-3 px-4 flex items-center gap-4 hover:bg-muted/80 active:scale-[0.98] rounded-xl transition-all justify-start"
                  onClick={() => handleMenuItemClick(item.path)}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    location.pathname === item.path ? "bg-primary/20" : "bg-muted"
                  }`}>
                    <item.icon className={`w-5 h-5 ${
                      location.pathname === item.path ? "text-primary" : "text-muted-foreground"
                    }`} />
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-body font-semibold text-foreground font-sans leading-snug">{item.label}</div>
                    <div className="text-caption text-muted-foreground font-sans leading-snug">{item.description}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Button>
              ))
            ) : isAuthenticated ? (
              // Account submenu
              <>
                {/* My Assignments + Upload Form — users with assignment view but not org manage */}
                {can('assignments:view-own') && !can('org:manage') && (
                  <>
                    <Button
                      variant="ghost"
                      className="w-full h-auto py-3 px-4 flex items-center gap-4 hover:bg-muted/80 active:scale-[0.98] rounded-xl transition-all justify-start"
                      onClick={() => handleMenuItemClick('/my-assignments')}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        location.pathname.startsWith('/my-assignments') || location.pathname.startsWith('/form/')
                          ? 'bg-primary/20'
                          : 'bg-muted'
                      }`}>
                        <ClipboardList className={`w-5 h-5 ${
                          location.pathname.startsWith('/my-assignments') || location.pathname.startsWith('/form/')
                            ? 'text-primary'
                            : 'text-muted-foreground'
                        }`} />
                      </div>
                      <div className="text-left flex-1">
                        <div className="text-body font-semibold text-foreground font-sans leading-snug">My Assignments</div>
                        <div className="text-caption text-muted-foreground font-sans leading-snug">View and fill assigned forms</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full h-auto py-3 px-4 flex items-center gap-4 hover:bg-muted/80 active:scale-[0.98] rounded-xl transition-all justify-start"
                      onClick={() => handleMenuItemClick('/upload-filled-form')}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        location.pathname.startsWith('/upload-filled-form') ? 'bg-primary/20' : 'bg-muted'
                      }`}>
                        <Upload className={`w-5 h-5 ${
                          location.pathname.startsWith('/upload-filled-form') ? 'text-primary' : 'text-muted-foreground'
                        }`} />
                      </div>
                      <div className="text-left flex-1">
                        <div className="text-body font-semibold text-foreground font-sans leading-snug">Upload Paper Form</div>
                        <div className="text-caption text-muted-foreground font-sans leading-snug">Scan or upload a filled form</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <div className="border-t border-border my-2" />
                  </>
                )}
                {/* Admin section */}
                {isAuthenticated && can('org:manage') && (
                  <>
                    <Button
                      variant="ghost"
                      className="w-full h-auto py-3 px-4 flex items-center gap-4 hover:bg-muted/80 active:scale-[0.98] rounded-xl transition-all justify-start"
                      onClick={() => handleMenuItemClick('/upload-filled-form')}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        location.pathname.startsWith('/upload-filled-form') ? 'bg-primary/20' : 'bg-muted'
                      }`}>
                        <Upload className={`w-5 h-5 ${
                          location.pathname.startsWith('/upload-filled-form') ? 'text-primary' : 'text-muted-foreground'
                        }`} />
                      </div>
                      <div className="text-left flex-1">
                        <div className="text-body font-semibold text-foreground font-sans leading-snug">Upload Paper Form</div>
                        <div className="text-caption text-muted-foreground font-sans leading-snug">Scan or upload a filled form</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full h-auto py-3 px-4 flex items-center gap-4 hover:bg-muted/80 active:scale-[0.98] rounded-xl transition-all justify-start"
                      onClick={() => handleMenuItemClick("/org-dashboard")}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        location.pathname === "/org-dashboard" ? "bg-primary/20" : "bg-muted"
                      }`}>
                        <Building2 className={`w-5 h-5 ${
                          location.pathname === "/org-dashboard" ? "text-primary" : "text-muted-foreground"
                        }`} />
                      </div>
                      <div className="text-left flex-1">
                        <div className="text-body font-semibold text-foreground font-sans leading-snug">Organization</div>
                        <div className="text-caption text-muted-foreground font-sans leading-snug">Manage your organization</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    {can('admin:panel') && (
                      <Button
                        variant="ghost"
                        className="w-full h-auto py-3 px-4 flex items-center gap-4 hover:bg-muted/80 active:scale-[0.98] rounded-xl transition-all justify-start"
                        onClick={() => handleMenuItemClick("/admin")}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          location.pathname === "/admin" ? "bg-primary/20" : "bg-muted"
                        }`}>
                          <Shield className={`w-5 h-5 ${
                            location.pathname === "/admin" ? "text-primary" : "text-muted-foreground"
                          }`} />
                        </div>
                        <div className="text-left flex-1">
                          <div className="text-body font-semibold text-foreground font-sans leading-snug">Super Admin</div>
                          <div className="text-caption text-muted-foreground font-sans leading-snug">Global admin dashboard</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    )}
                    <div className="border-t border-border my-2" />
                  </>
                )}
                {accountItems.map((item) => (
                  <Button
                    key={item.label}
                    variant="ghost"
                    className={`w-full h-auto py-3 px-4 flex items-center gap-4 hover:bg-muted/80 active:scale-[0.98] rounded-xl transition-all justify-start ${
                      item.destructive ? "hover:bg-destructive/10" : ""
                    }`}
                    onClick={() => handleMenuItemClick(item.path)}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.destructive
                        ? "bg-destructive/10"
                        : location.pathname === item.path && item.label === "Profile"
                          ? "bg-primary/20"
                          : "bg-muted"
                    }`}>
                      <item.icon className={`w-5 h-5 ${
                        item.destructive
                          ? "text-destructive"
                          : location.pathname === item.path && item.label === "Profile"
                            ? "text-primary"
                            : "text-muted-foreground"
                      }`} />
                    </div>
                    <div className="text-left flex-1">
                      <div className={`text-body font-semibold font-sans leading-snug ${
                        item.destructive ? "text-destructive" : "text-foreground"
                      }`}>{item.label}</div>
                      <div className="text-caption text-muted-foreground font-sans leading-snug">{item.description}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Button>
                ))}
                {/* Dark Mode Toggle */}
                <Button
                  variant="ghost"
                  className="w-full h-auto py-3 px-4 flex items-center gap-4 hover:bg-muted/80 active:scale-[0.98] rounded-xl transition-all justify-start"
                  onClick={toggleTheme}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-muted">
                    {theme === 'dark' ? <Sun className="w-5 h-5 text-muted-foreground" /> : <Moon className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-body font-semibold text-foreground font-sans leading-snug">{theme === 'dark' ? "Light Mode" : "Dark Mode"}</div>
                    <div className="text-caption text-muted-foreground font-sans leading-snug">Switch appearance</div>
                  </div>
                </Button>
                {/* Logout Button */}
                <Button
                  variant="ghost"
                  className="w-full h-auto py-3 px-4 flex items-center gap-4 hover:bg-destructive/10 active:scale-[0.98] rounded-xl transition-all justify-start mt-4 border-t border-border pt-4"
                  onClick={handleLogout}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-destructive/10">
                    <LogOut className="w-5 h-5 text-destructive" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-body font-semibold text-destructive font-sans leading-snug">Logout</div>
                    <div className="text-caption text-muted-foreground font-sans leading-snug">Sign out of your account</div>
                  </div>
                </Button>
              </>
            ) : (
              // Non-authenticated menu
              <>
                <Button
                  variant="ghost"
                  className="w-full h-auto py-3 px-4 flex items-center gap-4 hover:bg-muted/80 active:scale-[0.98] rounded-xl transition-all justify-start"
                  onClick={() => handleMenuItemClick("/about-us")}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-muted">
                    <Info className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-body font-semibold text-foreground font-sans leading-snug">About Us</div>
                    <div className="text-caption text-muted-foreground font-sans leading-snug">Learn about ArchePal</div>
                  </div>
                </Button>
                <Button
                  variant="ghost"
                  className="w-full h-auto py-3 px-4 flex items-center gap-4 hover:bg-muted/80 active:scale-[0.98] rounded-xl transition-all justify-start"
                  onClick={() => handleMenuItemClick("/contact")}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-muted">
                    <Mail className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-body font-semibold text-foreground font-sans leading-snug">Contact Us</div>
                    <div className="text-caption text-muted-foreground font-sans leading-snug">Get in touch with us</div>
                  </div>
                </Button>
                <Button
                  variant="ghost"
                  className="w-full h-auto py-3 px-4 flex items-center gap-4 hover:bg-muted/80 active:scale-[0.98] rounded-xl transition-all justify-start"
                  onClick={toggleTheme}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-muted">
                    {theme === 'dark' ? <Sun className="w-5 h-5 text-muted-foreground" /> : <Moon className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-body font-semibold text-foreground font-sans leading-snug">{theme === 'dark' ? "Light Mode" : "Dark Mode"}</div>
                    <div className="text-caption text-muted-foreground font-sans leading-snug">Switch appearance</div>
                  </div>
                </Button>
                <div className="pt-4 mt-4 border-t border-border space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full h-auto py-3 px-4 flex items-center gap-4 hover:bg-muted/80 active:scale-[0.98] rounded-xl transition-all justify-start"
                    onClick={toggleTheme}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-muted">
                      {theme === 'dark'
                        ? <Sun className="w-5 h-5 text-muted-foreground" />
                        : <Moon className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    <div className="text-left flex-1">
                      <div className="text-body font-semibold text-foreground font-sans leading-snug">
                        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                      </div>
                    </div>
                  </Button>
                  <Button
                    className="w-full h-11"
                    onClick={() => handleMenuItemClick("/authentication/sign-in")}
                  >
                    Sign In
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-10"
                    onClick={() => handleMenuItemClick("/authentication/sign-up")}
                  >
                    Create Account
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Create Content Sheet */}
      <Sheet open={isCreateSheetOpen} onOpenChange={setIsCreateSheetOpen}>
        <SheetContent side="bottom" className="max-w-lg mx-auto rounded-t-3xl safe-bottom">
          <SheetHeader className="text-left">
            <SheetTitle className="text-h3 font-heading font-bold leading-tight">Create</SheetTitle>
            <SheetDescription className="text-body-sm font-sans text-muted-foreground leading-normal">
              Choose what you'd like to create
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-1 pb-4">
            {createItems.map((item) => (
              <Button
                key={item.path}
                variant="ghost"
                className="w-full h-auto py-3 px-4 flex items-center gap-4 hover:bg-muted/80 active:scale-[0.98] rounded-xl transition-all justify-start"
                onClick={() => handleContentOptionClick(item.path)}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left flex-1">
                  <div className="text-body font-semibold text-foreground font-sans leading-snug">{item.label}</div>
                  <div className="text-caption text-muted-foreground font-sans leading-snug">{item.description}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Create Site Modal */}
      <CreateSiteModal open={createSiteModalOpen} onOpenChange={setCreateSiteModalOpen} />

      {/* Gift Shop Sheet */}
      <Sheet open={isGiftShopSheetOpen} onOpenChange={setIsGiftShopSheetOpen}>
        <SheetContent side="bottom" className="max-w-lg mx-auto rounded-t-3xl safe-bottom">
          <SheetHeader className="text-left">
            <SheetTitle className="text-h3 font-heading font-bold leading-tight">Gift Shop</SheetTitle>
            <SheetDescription className="text-body-sm font-sans text-muted-foreground leading-normal">
              Support archaeology through donations and gifts
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-1 pb-4">
            {giftShopItems.map((item) => (
              <Button
                key={item.path}
                variant="ghost"
                className="w-full h-auto py-3 px-4 flex items-center gap-4 hover:bg-muted/80 active:scale-[0.98] rounded-xl transition-all justify-start"
                onClick={() => handleGiftShopOptionClick(item.path)}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  location.pathname === item.path ? "bg-primary/20" : "bg-primary/10"
                }`}>
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left flex-1">
                  <div className="text-body font-semibold text-foreground font-sans leading-snug">{item.label}</div>
                  <div className="text-caption text-muted-foreground font-sans leading-snug">{item.description}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
