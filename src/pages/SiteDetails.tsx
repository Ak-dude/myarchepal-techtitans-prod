import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapPin, Calendar, Users, FileText, Edit, Share2, Loader2, ChevronRight, Satellite, WifiOff, Globe, Lock, UserPlus, X, Shield, ClipboardList } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { AccountButton } from "@/components/AccountButton";
import { SiteConditions } from "@/components/SiteConditions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SitesService, Site } from "@/services/sites";
import { SiteTemplatesService } from "@/services/siteTemplates";
import type { SiteTemplate } from "@/types/siteTemplates";
import { ArtifactsService, Artifact } from "@/services/artifacts";
import { UserService } from "@/services/users";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import { useArchaeologist } from "@/hooks/use-archaeologist";
import { DEFAULT_ORGANIZATION_ID, User } from "@/types/organization";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Timestamp } from "firebase/firestore";
import { useNetworkStatus } from "@/hooks/use-network";
import { OfflineCacheService } from "@/services/offline-cache";
import { parseDate } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SiteDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization, isOrgAdmin, isSuperAdmin, isMember } = useUser();
  const { isArchaeologist } = useArchaeologist();
  const { toast } = useToast();
  const { isOnline } = useNetworkStatus();

  // Check if user is in a Pro/Enterprise organization (non-default)
  const isProOrg = organization &&
    organization.id !== DEFAULT_ORGANIZATION_ID &&
    (organization.subscriptionLevel === 'Pro' || organization.subscriptionLevel === 'Enterprise');
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [siteArtifacts, setSiteArtifacts] = useState<Artifact[]>([]);
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [networkChecked, setNetworkChecked] = useState(false);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);

  const [linkedTemplate, setLinkedTemplate] = useState<SiteTemplate | null>(null);

  // Site admin management state
  const [orgMembers, setOrgMembers] = useState<User[]>([]);
  const [siteAdminUsers, setSiteAdminUsers] = useState<User[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [removingAdminId, setRemovingAdminId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");

  // Wait for network status to be determined before fetching
  useEffect(() => {
    // Small delay to allow network status to settle
    const timer = setTimeout(() => {
      setNetworkChecked(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Don't fetch until network status is determined
    if (!networkChecked) return;

    const fetchSite = async () => {
      if (!id) {
        setError("Site ID not found");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Try to get cached data first
        const { data: cachedSite } = await OfflineCacheService.getCachedSiteDetails(id);

        if (isOnline) {
          // Online: fetch fresh data
          try {
            const siteData = await SitesService.getSiteById(id);
            setSite(siteData);
            setUsingCachedData(false);
            // Cache the fresh data
            if (siteData) {
              await OfflineCacheService.cacheSiteDetails(id, siteData);
            }
          } catch (fetchError) {
            console.error("Error fetching site:", fetchError);
            // Fall back to cached data if available
            if (cachedSite) {
              setSite(cachedSite);
              setUsingCachedData(true);
            } else {
              setError("Failed to load site details");
            }
          }
        } else {
          // Offline: use cached data
          if (cachedSite) {
            setSite(cachedSite);
            setUsingCachedData(true);
          } else {
            setError("Site not available offline. Please view this site while online first to cache it.");
          }
        }
      } catch (error) {
        console.error("Error fetching site:", error);
        // Try cached data as last resort
        try {
          const { data: cachedSite } = await OfflineCacheService.getCachedSiteDetails(id);
          if (cachedSite) {
            setSite(cachedSite);
            setUsingCachedData(true);
          } else {
            setError("Failed to load site details");
          }
        } catch {
          setError("Failed to load site details");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSite();
  }, [id, isOnline, networkChecked]);

  // Fetch artifacts for this site
  useEffect(() => {
    // Don't fetch until network status is determined
    if (!networkChecked) return;

    const fetchSiteArtifacts = async () => {
      if (!id) return;

      try {
        setArtifactsLoading(true);

        // Try cached data first
        const { data: cachedArtifacts } = await OfflineCacheService.getCachedSiteArtifacts(id);

        if (isOnline) {
          try {
            const artifacts = await ArtifactsService.getArtifactsBySite(id);
            setSiteArtifacts(artifacts);
            // Cache the artifacts
            if (artifacts.length > 0) {
              await OfflineCacheService.cacheSiteArtifacts(id, artifacts);
            }
          } catch (fetchError) {
            console.error("Error fetching site artifacts:", fetchError);
            // Fall back to cached
            if (cachedArtifacts) {
              setSiteArtifacts(cachedArtifacts);
            }
          }
        } else {
          // Offline: use cached
          if (cachedArtifacts) {
            setSiteArtifacts(cachedArtifacts);
          }
        }
      } catch (error) {
        console.error("Error fetching site artifacts:", error);
      } finally {
        setArtifactsLoading(false);
      }
    };

    fetchSiteArtifacts();
  }, [id, isOnline, networkChecked]);

  // Load linked template name when site is ready
  useEffect(() => {
    if (site?.linkedTemplateId) {
      SiteTemplatesService.getTemplate(site.linkedTemplateId)
        .then(setLinkedTemplate)
        .catch(console.error);
    } else {
      setLinkedTemplate(null);
    }
  }, [site?.linkedTemplateId]);

  // Fetch organization members for site admin management (org admins only)
  useEffect(() => {
    const fetchOrgMembers = async () => {
      if (!site?.organizationId || !organization || !isProOrg || !isOrgAdmin) return;

      try {
        setLoadingAdmins(true);
        // Fetch all members in the organization
        const members = await UserService.getByOrganization(site.organizationId);
        setOrgMembers(members.filter(m => m.status === 'ACTIVE'));

        // Fetch site admin user details
        const adminIds = await SitesService.getSiteAdmins(site.id!);
        const adminUsers = members.filter(m => adminIds.includes(m.uid));
        setSiteAdminUsers(adminUsers);
      } catch (error) {
        console.error("Error fetching org members:", error);
      } finally {
        setLoadingAdmins(false);
      }
    };

    fetchOrgMembers();
  }, [site?.id, site?.organizationId, organization, isProOrg, isOrgAdmin]);

  const formatDate = (date: Date | Timestamp | undefined | any) => {
    const d = parseDate(date);
    if (!d) return "Unknown date";

    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  const getLocationDisplay = (site: Site) => {
    const parts = [];
    if (site.location?.address) parts.push(site.location.address);
    if (site.location?.region) parts.push(site.location.region);
    if (site.location?.country) parts.push(site.location.country);
    return parts.join(", ") || "Location not specified";
  };

  const handleShare = async () => {
    if (navigator.share && site) {
      try {
        await navigator.share({
          title: site.name,
          text: site.description,
          url: window.location.href,
        });
      } catch (error) {
        console.log("Error sharing:", error);
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: "Link copied!",
          description: "Site link has been copied to clipboard",
        });
      } catch (error) {
        toast({
          title: "Share failed",
          description: "Unable to share or copy link",
          variant: "destructive"
        });
      }
    }
  };

  // Check if current user is a site admin
  const isSiteAdmin = user && site && (
    site.createdBy === user.uid ||
    site.siteAdmins?.includes(user.uid)
  );

  // Allow editing if:
  // 1. User created the site, OR
  // 2. User is an archaeologist AND site is an active project (status: "active"), OR
  // 3. User is a site admin
  const isCreator = user && site && site.createdBy === user.uid;
  const isActiveProject = site && site.status === "active";
  const canEdit = user && isArchaeologist && site && (isCreator || isActiveProject || isSiteAdmin);

  // Can change visibility if: user is the creator and belongs to a Pro/Enterprise org
  const canChangeVisibility = isCreator && isProOrg;

  const handleVisibilityChange = async (newVisibility: 'public' | 'private') => {
    if (!site?.id || !canChangeVisibility) return;

    try {
      setUpdatingVisibility(true);
      await SitesService.updateSite(site.id, { visibility: newVisibility });
      setSite(prev => prev ? { ...prev, visibility: newVisibility } : null);
      toast({
        title: "Visibility Updated",
        description: `Site is now ${newVisibility}`,
      });
    } catch (error) {
      console.error("Error updating visibility:", error);
      toast({
        title: "Error",
        description: "Failed to update visibility. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUpdatingVisibility(false);
    }
  };

  // Handle adding a site admin
  const handleAddSiteAdmin = async () => {
    if (!site?.id || !selectedMemberId) return;

    try {
      setAddingAdmin(true);
      await SitesService.addSiteAdmin(site.id, selectedMemberId);

      // Update local state
      const newAdmin = orgMembers.find(m => m.uid === selectedMemberId);
      if (newAdmin) {
        setSiteAdminUsers(prev => [...prev, newAdmin]);
      }

      setSelectedMemberId("");
      toast({
        title: "Admin Added",
        description: "User has been added as a site admin",
      });
    } catch (error) {
      console.error("Error adding site admin:", error);
      toast({
        title: "Error",
        description: "Failed to add site admin",
        variant: "destructive"
      });
    } finally {
      setAddingAdmin(false);
    }
  };

  // Handle removing a site admin
  const handleRemoveSiteAdmin = async (userId: string) => {
    if (!site?.id) return;

    // Don't allow removing the site creator
    if (userId === site.createdBy) {
      toast({
        title: "Cannot Remove",
        description: "Site creator cannot be removed as admin",
        variant: "destructive"
      });
      return;
    }

    try {
      setRemovingAdminId(userId);
      await SitesService.removeSiteAdmin(site.id, userId);

      // Update local state
      setSiteAdminUsers(prev => prev.filter(u => u.uid !== userId));

      toast({
        title: "Admin Removed",
        description: "User has been removed as site admin",
      });
    } catch (error) {
      console.error("Error removing site admin:", error);
      toast({
        title: "Error",
        description: "Failed to remove site admin",
        variant: "destructive"
      });
    } finally {
      setRemovingAdminId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading site details...</p>
        </div>
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Site not found"}</p>
          <Button onClick={() => navigate("/site-lists")} variant="outline">
            Back to Sites
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveLayout>
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-lg px-4 py-4 sm:px-6 lg:px-8 border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
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
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                className="hover:bg-muted h-10 w-10"
              >
                <Share2 className="w-4 h-4" />
              </Button>
              {canEdit && isOnline && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(`/edit-site/${site.id}`)}
                  className="hover:bg-muted h-10 w-10"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              )}
              <AccountButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <div className="p-4 sm:p-6 lg:p-8 space-y-4 lg:space-y-6">
          {/* Site Images */}
          {site.images && site.images.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="w-full flex justify-center rounded-lg bg-muted/30">
                  <img
                    src={site.images[0]}
                    alt={site.name}
                    className="max-w-full max-h-80 object-contain rounded-lg"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
                {site.images.length > 1 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto">
                    {site.images.slice(1).map((image, index) => (
                      <img
                        key={index}
                        src={image}
                        alt={`${site.name} ${index + 2}`}
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0 cursor-pointer hover:opacity-80"
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Site Conditions - Weather based on site coordinates */}
          {site.location?.latitude && site.location?.longitude && (
            <SiteConditions
              latitude={site.location.latitude}
              longitude={site.location.longitude}
            />
          )}

          {/* Site Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
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
                          parent.innerHTML = '<span class="text-4xl">🏛️</span>';
                        }
                      }}
                    />
                  ) : (
                    <span className="text-4xl">🏛️</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-foreground mb-2">
                    {site.name}
                  </h2>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{getLocationDisplay(site)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>Discovered: {formatDate(site.dateDiscovered)}</span>
                    </div>
                    {site.period && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span>{site.period}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {site.description || "No description available"}
              </p>
            </CardContent>
          </Card>

          {/* Research and Analysis */}
          {site.researchAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Research and Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {site.researchAnalysis}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Field Notes */}
          {(site as any).notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Field Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {(site as any).notes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Location Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Location Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {site.location?.address && (
                <div>
                  <span className="text-sm font-medium">Address:</span>
                  <p className="text-muted-foreground">{site.location.address}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {site.location?.region && (
                  <div>
                    <span className="text-sm font-medium">Region:</span>
                    <p className="text-muted-foreground">{site.location.region}</p>
                  </div>
                )}
                {site.location?.country && (
                  <div>
                    <span className="text-sm font-medium">Country:</span>
                    <p className="text-muted-foreground">{site.location.country}</p>
                  </div>
                )}
              </div>
              {(site.location?.latitude && site.location?.longitude) && (
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium">Coordinates:</span>
                    <p className="text-muted-foreground">
                      {site.location.latitude}, {site.location.longitude}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/site-time-machine?lat=${site.location?.latitude}&lon=${site.location?.longitude}&name=${encodeURIComponent(site.name)}&siteId=${site.id}`)}
                  >
                    <Satellite className="w-4 h-4 mr-2" />
                    View Satellite History
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Artifacts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Artifacts ({siteArtifacts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {artifactsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span className="text-muted-foreground text-sm">Loading artifacts...</span>
                </div>
              ) : siteArtifacts.length > 0 ? (
                <div className="space-y-2">
                  {siteArtifacts.map((artifact) => (
                    <div
                      key={artifact.id}
                      className="p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors cursor-pointer flex items-center justify-between"
                      onClick={() => navigate(`/artifact/${artifact.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">
                          {artifact.type === 'Coin' ? '🪙' :
                           artifact.type === 'Ceramic' ? '🏺' :
                           artifact.type === 'Weapon' ? '🗡️' :
                           artifact.type === 'Glass' ? '🍶' :
                           artifact.type === 'Personal Ornament' ? '📎' :
                           artifact.type === 'Sculpture' ? '🗿' :
                           '🏺'}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{artifact.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {artifact.material} • {artifact.condition}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No artifacts cataloged yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* Site Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Site Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Created:</span>
                <span className="text-muted-foreground text-sm">
                  {formatDate(site.createdAt)}
                </span>
              </div>
              {site.updatedAt && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Last Updated:</span>
                  <span className="text-muted-foreground text-sm">
                    {formatDate(site.updatedAt)}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Site ID:</span>
                <span className="text-muted-foreground text-sm font-mono">
                  {site.id}
                </span>
              </div>

              {/* Visibility Toggle - Only for Pro/Enterprise organizations */}
              {canChangeVisibility && isOnline && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/30">
                    <div className="space-y-0.5">
                      <Label className="text-foreground flex items-center gap-2">
                        {site.visibility === 'public' ? (
                          <Globe className="w-4 h-4 text-green-600" />
                        ) : (
                          <Lock className="w-4 h-4 text-amber-600" />
                        )}
                        Visibility
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {site.visibility === 'public'
                          ? 'Visible to all users'
                          : 'Only visible to organization members'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${site.visibility !== 'public' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        Private
                      </span>
                      <Switch
                        checked={site.visibility === 'public'}
                        onCheckedChange={(checked) => handleVisibilityChange(checked ? 'public' : 'private')}
                        disabled={updatingVisibility}
                      />
                      <span className={`text-sm ${site.visibility === 'public' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        Public
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Form Assignment — ORG_ADMIN only, Pro/Enterprise orgs */}
          {isOrgAdmin && isProOrg && site.organizationId === organization?.id && isOnline && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" />
                  Form Assignment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Linked Template</span>
                  <span className={linkedTemplate ? 'font-medium' : 'italic text-muted-foreground'}>
                    {linkedTemplate ? linkedTemplate.name : 'None'}
                  </span>
                </div>
                {site.assignedConsultantEmail && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Assigned To</span>
                    <span className="text-blue-600 dark:text-blue-400">{site.assignedConsultantEmail}</span>
                  </div>
                )}
                {site.submissionStatus && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Form Status</span>
                    <span className="capitalize">{site.submissionStatus.replace('_', ' ')}</span>
                  </div>
                )}

                {/* Fill Form — shown when THIS admin is the one assigned */}
                {site.linkedTemplateId && user && site.assignedConsultantId === user.uid &&
                  site.submissionStatus !== 'submitted' && site.submissionStatus !== 'reviewed' && (
                  <Button
                    className="w-full"
                    onClick={() => navigate(`/form/${site.id}`)}
                  >
                    <ClipboardList className="w-4 h-4 mr-2" />
                    {site.submissionStatus === 'in_progress' ? 'Continue Form' : 'Fill Out Form'}
                  </Button>
                )}

                {/* Submitted state */}
                {site.assignedConsultantId === user?.uid &&
                  (site.submissionStatus === 'submitted' || site.submissionStatus === 'reviewed') && (
                  <p className="text-sm text-center text-muted-foreground py-1">
                    Form has been submitted.
                  </p>
                )}

                {site.linkedTemplateId && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => navigate(`/assign-form/${site.id}`)}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    {site.assignedConsultantId ? 'Reassign to Another Member' : 'Assign to a Team Member'}
                  </Button>
                )}
                {!site.linkedTemplateId && (
                  <p className="text-xs text-muted-foreground">
                    Link a template to this site from the{' '}
                    <button
                      className="underline"
                      onClick={() => navigate(`/edit-site/${site.id}`)}
                    >
                      edit page
                    </button>{' '}
                    to enable form assignment.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Fill Form CTA — MEMBER assigned to this site */}
          {isMember && !isOrgAdmin && user && site.assignedConsultantId === user.uid && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" />
                  Assigned Form
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {linkedTemplate && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Template</span>
                    <span className="font-medium">{linkedTemplate.name}</span>
                  </div>
                )}
                {site.submissionStatus && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className={
                      site.submissionStatus === 'submitted' || site.submissionStatus === 'reviewed'
                        ? 'text-green-600 dark:text-green-400 font-medium capitalize'
                        : site.submissionStatus === 'in_progress'
                        ? 'text-blue-600 dark:text-blue-400 font-medium capitalize'
                        : 'text-muted-foreground capitalize'
                    }>
                      {site.submissionStatus.replace('_', ' ')}
                    </span>
                  </div>
                )}
                {site.submissionStatus !== 'submitted' && site.submissionStatus !== 'reviewed' ? (
                  <Button
                    className="w-full"
                    onClick={() => navigate(`/form/${site.id}`)}
                  >
                    <ClipboardList className="w-4 h-4 mr-2" />
                    {site.submissionStatus === 'in_progress' ? 'Continue Form' : 'Fill Form'}
                  </Button>
                ) : (
                  <p className="text-sm text-center text-muted-foreground py-1">
                    This form has been submitted.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Site Admin Management - Only for Org Admins of Pro/Enterprise orgs */}
          {isOrgAdmin && isProOrg && site.organizationId === organization?.id && isOnline && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Site Administrators
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Site admins can edit this site and its artifacts. The site creator is always an admin.
                </p>

                {/* Current Site Admins */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Current Admins</Label>
                  {loadingAdmins ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading admins...</span>
                    </div>
                  ) : siteAdminUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      Only the site creator is an admin
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {siteAdminUsers.map((adminUser) => (
                        <div
                          key={adminUser.uid}
                          className="flex items-center justify-between p-2 bg-muted rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={adminUser.photoURL} />
                              <AvatarFallback>
                                {adminUser.displayName?.[0] || adminUser.email[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">
                                {adminUser.displayName || adminUser.email}
                              </p>
                              {adminUser.uid === site.createdBy && (
                                <span className="text-xs text-muted-foreground">Creator</span>
                              )}
                            </div>
                          </div>
                          {adminUser.uid !== site.createdBy && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveSiteAdmin(adminUser.uid)}
                              disabled={removingAdminId === adminUser.uid}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              {removingAdminId === adminUser.uid ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add New Admin */}
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Add Site Admin</Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedMemberId}
                      onValueChange={setSelectedMemberId}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a team member" />
                      </SelectTrigger>
                      <SelectContent>
                        {orgMembers
                          .filter(m =>
                            m.uid !== site.createdBy &&
                            !siteAdminUsers.some(a => a.uid === m.uid)
                          )
                          .map((member) => (
                            <SelectItem key={member.uid} value={member.uid}>
                              <div className="flex items-center gap-2">
                                <span>{member.displayName || member.email}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({member.role})
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleAddSiteAdmin}
                      disabled={!selectedMemberId || addingAdmin}
                      size="sm"
                    >
                      {addingAdmin ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ResponsiveLayout>
  );
};

export default SiteDetails;