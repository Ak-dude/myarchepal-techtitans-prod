import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Calendar, Users, FileText, Search, Loader2, Plus, Star, WifiOff, Trash2 } from "lucide-react";
import { CreateSiteModal } from "@/components/CreateSiteModal";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { AccountButton } from "@/components/AccountButton";
import { SiteConditions } from "@/components/SiteConditions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSites } from "@/hooks/use-sites";
import { Site, SitesService } from "@/services/sites";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import { useArchaeologist } from "@/hooks/use-archaeologist";
import { DEFAULT_ORGANIZATION_ID } from "@/types/organization";
import { ArchaeologistService } from "@/services/archaeologists";
import { useToast } from "@/components/ui/use-toast";
import { Timestamp } from "firebase/firestore";
import { useNetworkStatus } from "@/hooks/use-network";
import { OfflineCacheService } from "@/services/offline-cache";
import { parseDate } from "@/lib/utils";

const SiteLists = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization, isAdmin } = useUser();
  const { isArchaeologist } = useArchaeologist();
  const { toast } = useToast();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { isOnline } = useNetworkStatus();
  const { sites, loading, error, fetchSites } = useSites();

  // Check if user is in a Pro/Enterprise organization (non-default)
  const isProOrg = organization &&
    organization.id !== DEFAULT_ORGANIZATION_ID &&
    (organization.subscriptionLevel === 'Pro' || organization.subscriptionLevel === 'Enterprise');
  const [searchQuery, setSearchQuery] = useState("");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [settingActiveProject, setSettingActiveProject] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [cachedSites, setCachedSites] = useState<Site[]>([]);

  // Load cached data on mount and when offline
  useEffect(() => {
    const loadCachedData = async () => {
      const { data: cached } = await OfflineCacheService.getCachedSitesList();
      if (cached) {
        setCachedSites(cached);
      }
    };
    loadCachedData();
  }, []);

  // Cache sites when loaded online
  useEffect(() => {
    if (sites.length > 0 && isOnline) {
      OfflineCacheService.cacheSitesList(sites);
      setUsingCachedData(false);
    }
  }, [sites, isOnline]);

  // Use cached data when offline and no fresh data
  useEffect(() => {
    if (!isOnline && sites.length === 0 && cachedSites.length > 0) {
      setUsingCachedData(true);
    } else if (isOnline && sites.length > 0) {
      setUsingCachedData(false);
    }
  }, [isOnline, sites, cachedSites]);

  // Determine which sites to display (memoized — avoids new reference on every render)
  const displaySites = useMemo(() => {
    const baseSites = (usingCachedData ? cachedSites : sites).filter(site => !site.deletedAt);
    if (user) {
      return isProOrg
        ? baseSites.filter(site => site.organizationId === organization?.id)
        : baseSites.filter(site => site.createdBy === user.uid);
    }
    return baseSites.filter(site =>
      site.visibility === 'public' &&
      site.organizationId &&
      site.organizationId !== DEFAULT_ORGANIZATION_ID
    );
  }, [usingCachedData, cachedSites, sites, user, isProOrg, organization?.id]);

  // Fetch active project ID for archaeologist
  useEffect(() => {
    const fetchActiveProject = async () => {
      if (user && isArchaeologist) {
        try {
          const activeId = await ArchaeologistService.getActiveProjectId(user.uid);
          setActiveProjectId(activeId);
        } catch (error) {
          console.error("Error fetching active project:", error);
        }
      }
    };

    fetchActiveProject();
  }, [user, isArchaeologist]);

  const filteredSites = useMemo(() => {
    if (!searchQuery.trim()) return displaySites;
    const query = searchQuery.toLowerCase();
    return displaySites.filter(site =>
      site.name.toLowerCase().includes(query) ||
      site.location?.address?.toLowerCase().includes(query) ||
      site.location?.country?.toLowerCase().includes(query) ||
      site.location?.region?.toLowerCase().includes(query) ||
      site.description?.toLowerCase().includes(query)
    );
  }, [searchQuery, displaySites]);

  const formatDate = (date: Date | Timestamp | undefined | any) => {
    const d = parseDate(date);
    if (!d) return "Unknown date";

    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  const getLocationDisplay = (site: Site) => {
    const parts = [];
    if (site.location?.address) parts.push(site.location.address);
    if (site.location?.region) parts.push(site.location.region);
    if (site.location?.country) parts.push(site.location.country);
    return parts.join(", ") || "Location not specified";
  };

  const handleSiteClick = (siteId: string) => {
    navigate(`/site/${siteId}`);
  };

  const handleToggleActiveProject = async (e: React.MouseEvent, siteId: string) => {
    e.stopPropagation(); // Prevent navigation when clicking the star

    if (!user || !isArchaeologist) {
      toast({
        title: "Access denied",
        description: "Only archaeologists can mark active projects",
        variant: "destructive"
      });
      return;
    }

    try {
      setSettingActiveProject(true);

      // If this site is already active, unmark it; otherwise, mark it as active
      const newActiveProjectId = activeProjectId === siteId ? null : siteId;

      await ArchaeologistService.setActiveProject(user.uid, newActiveProjectId);
      setActiveProjectId(newActiveProjectId);

      toast({
        title: newActiveProjectId ? "Active project set" : "Active project removed",
        description: newActiveProjectId
          ? "This site is now your active project"
          : "This site is no longer your active project"
      });
    } catch (error) {
      console.error("Error setting active project:", error);
      toast({
        title: "Error",
        description: "Failed to update active project",
        variant: "destructive"
      });
    } finally {
      setSettingActiveProject(false);
    }
  };

  const handleDeleteSite = async (siteId: string) => {
    setDeletingId(siteId);
    try {
      await SitesService.deleteSite(siteId);
      toast({ title: "Site deleted", description: "The site has been archived and removed from the list." });
      fetchSites();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to delete the site. Please try again.", variant: "destructive" });
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  // Show loading only if we don't have cached data
  if (loading && cachedSites.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading sites...</p>
        </div>
      </div>
    );
  }

  // Show error only if we don't have cached data to fall back on
  if (error && cachedSites.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <WifiOff className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-red-500 mb-2">{error}</p>
          <p className="text-muted-foreground text-sm mb-4">No cached data available</p>
          <Button onClick={fetchSites} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveLayout>
      <header className="bg-card/95 backdrop-blur-lg px-4 py-4 sm:px-6 lg:px-8 border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <PageHeader showLogo={false} />
            <div className="flex items-center gap-2">
              {/* Offline indicator */}
              {!isOnline && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium">
                  <WifiOff className="w-3 h-3" />
                  <span>Offline</span>
                </div>
              )}
              {usingCachedData && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium">
                  <span>Cached</span>
                </div>
              )}
              {user && isOnline && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setCreateModalOpen(true)}
                  className="hidden lg:flex gap-1.5 text-sm h-9 px-4 shadow-sm hover:shadow-md transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Create Site
                </Button>
              )}
              <CreateSiteModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
              <AccountButton />
            </div>
          </div>

          <div className="relative mb-3 sm:mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search sites..."
              className="pl-10 h-11 lg:h-12 bg-muted/50 border-0 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
            <Card className="p-2.5 sm:p-3 lg:p-4 border-border/50 text-center bg-gradient-to-br from-primary/5 to-primary/10 hover:shadow-md transition-shadow">
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-primary">{displaySites.length}</p>
              <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground font-medium">Total Sites</p>
            </Card>
            <Card className="p-2.5 sm:p-3 lg:p-4 border-border/50 text-center bg-gradient-to-br from-green-500/5 to-green-500/10 hover:shadow-md transition-shadow">
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">
                {displaySites.filter(s => s.status === 'active').length}
              </p>
              <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground font-medium">Active</p>
            </Card>
            <Card className="p-2.5 sm:p-3 lg:p-4 border-border/50 text-center bg-gradient-to-br from-orange-500/5 to-orange-500/10 hover:shadow-md transition-shadow">
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-orange-600">
                {displaySites.filter(s => s.artifacts?.length).reduce((sum, s) => sum + (s.artifacts?.length || 0), 0)}
              </p>
              <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground font-medium">Artifacts</p>
            </Card>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto">
          <div className="p-3 sm:p-4 lg:p-6 space-y-3 lg:space-y-4">
            {filteredSites.length === 0 ? (
              <Card className="p-8 sm:p-12 text-center border-border/50 animate-fade-in">
                <div className="text-4xl mb-3">🏛️</div>
                <p className="text-muted-foreground text-sm sm:text-base">
                  {searchQuery ? "No sites found matching your search." : "No sites available. Create your first site!"}
                </p>
              </Card>
            ) : (
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 500px), 1fr))' }}>
                {filteredSites.map((site, index) => {
                  const isActiveProject = activeProjectId === site.id;
                  return (
                    <Card
                      key={site.id}
                      className={`p-3 sm:p-4 border-border/50 hover:shadow-lg active:scale-[0.99] lg:active:scale-100 transition-all duration-200 cursor-pointer animate-slide-up group ${
                        isActiveProject ? 'ring-2 ring-primary/50 bg-primary/5' : ''
                      }`}
                      style={{ animationDelay: `${index * 50}ms` }}
                      onClick={() => handleSiteClick(site.id)}
                    >
                      <div className="flex gap-3">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-muted rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
                          {site.images && site.images.length > 0 ? (
                            <img
                              src={site.images[0]}
                              alt={site.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.onerror = null;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = '<span class="text-2xl sm:text-3xl">🏛️</span>';
                                }
                              }}
                            />
                          ) : (
                            <span className="text-2xl sm:text-3xl">🏛️</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1.5 sm:mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm sm:text-base lg:text-lg text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                                {site.name}
                              </h3>
                              {isActiveProject && (
                                <Badge variant="outline" className="mt-1 bg-primary/10 text-primary border-primary/20 text-[10px] sm:text-xs">
                                  Active Project
                                </Badge>
                              )}
                              {site.submissionStatus && (
                                <Badge
                                  variant="outline"
                                  className={`mt-1 text-[10px] sm:text-xs ${
                                    site.submissionStatus === 'submitted' || site.submissionStatus === 'reviewed'
                                      ? 'bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400'
                                      : site.submissionStatus === 'in_progress'
                                      ? 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400'
                                      : 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400'
                                  }`}
                                >
                                  {site.submissionStatus === 'assigned' && 'Form Pending'}
                                  {site.submissionStatus === 'in_progress' && 'In Progress'}
                                  {site.submissionStatus === 'submitted' && 'Submitted'}
                                  {site.submissionStatus === 'reviewed' && 'Reviewed'}
                                </Badge>
                              )}
                            </div>
                            {isArchaeologist && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 lg:h-10 lg:w-10 shrink-0 rounded-full hover:bg-yellow-500/10"
                                onClick={(e) => handleToggleActiveProject(e, site.id!)}
                                disabled={settingActiveProject}
                              >
                                <Star
                                  className={`w-4 h-4 lg:w-5 lg:h-5 transition-colors ${
                                    isActiveProject
                                      ? 'fill-yellow-500 text-yellow-500'
                                      : 'text-muted-foreground hover:text-yellow-500'
                                  }`}
                                />
                              </Button>
                            )}
                            {isAdmin && site.organizationId === organization?.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 lg:h-10 lg:w-10 shrink-0 rounded-full hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(site.id!); }}
                                disabled={deletingId === site.id}
                              >
                                {deletingId === site.id
                                  ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                  : <Trash2 className="w-4 h-4 text-destructive" />
                                }
                              </Button>
                            )}
                          </div>

                          <div className="space-y-0.5 sm:space-y-1 mb-2 sm:mb-3">
                            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs lg:text-sm text-muted-foreground">
                              <MapPin className="w-3 h-3 lg:w-4 lg:h-4 flex-shrink-0" />
                              <span className="truncate">{getLocationDisplay(site)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs lg:text-sm text-muted-foreground">
                              <Calendar className="w-3 h-3 lg:w-4 lg:h-4 flex-shrink-0" />
                              <span>{formatDate(site.updatedAt || site.createdAt)}</span>
                            </div>
                          </div>

                          <p className="text-[11px] sm:text-xs lg:text-sm text-muted-foreground line-clamp-2 mb-2 sm:mb-3">
                            {site.description || "No description available"}
                          </p>

                          <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-border/50">
                            <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs lg:text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <FileText className="w-3 h-3 lg:w-4 lg:h-4" />
                                <span>{site.artifacts?.length || 0} artifacts</span>
                              </div>
                              {site.period && (
                                <div className="flex items-center gap-1">
                                  <Users className="w-3 h-3 lg:w-4 lg:h-4" />
                                  <span>{site.period}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Site Conditions - Only for Active Project */}
                      {isActiveProject && user && isArchaeologist && site.location?.latitude && site.location?.longitude && (
                        <div className="mt-3 pt-3 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                          <SiteConditions
                            latitude={site.location.latitude}
                            longitude={site.location.longitude}
                          />
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
      </div>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete site?</AlertDialogTitle>
            <AlertDialogDescription>
              This site will be archived and removed from the list. This action can be reversed by a Super Admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => confirmDeleteId && handleDeleteSite(confirmDeleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResponsiveLayout>
  );
};

export default SiteLists;
