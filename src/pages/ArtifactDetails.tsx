import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapPin, Calendar, Edit, Share2, Loader2, Building2, Ruler, Star, ShoppingCart, DollarSign, Trash2, Image as ImageIcon, WifiOff, Globe, Lock, Video } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { AccountButton } from "@/components/AccountButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArtifactsService, Artifact } from "@/services/artifacts";
import { SitesService, Site } from "@/services/sites";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import { useArchaeologist } from "@/hooks/use-archaeologist";
import { DEFAULT_ORGANIZATION_ID } from "@/types/organization";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Timestamp } from "firebase/firestore";
import { useNetworkStatus } from "@/hooks/use-network";
import { OfflineCacheService } from "@/services/offline-cache";
import { parseDate } from "@/lib/utils";
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

const ArtifactDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useUser();
  const { isArchaeologist } = useArchaeologist();
  const { toast } = useToast();
  const { isOnline } = useNetworkStatus();

  // Check if user is in a Pro/Enterprise organization (non-default)
  const isProOrg = organization &&
    organization.id !== DEFAULT_ORGANIZATION_ID &&
    (organization.subscriptionLevel === 'Pro' || organization.subscriptionLevel === 'Enterprise');
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting3DImage, setDeleting3DImage] = useState(false);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [networkChecked, setNetworkChecked] = useState(false);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);

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

    const fetchArtifact = async () => {
      if (!id) {
        setError("Artifact ID not found");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Try to get cached data first
        const cachedArtifact = await OfflineCacheService.getCachedArtifactDetails(id);

        if (!isOnline) {
          // Offline: use cached data only
          if (cachedArtifact.data) {
            setArtifact(cachedArtifact.data);
            setUsingCachedData(true);

            // Try to get cached site data
            if (cachedArtifact.data.siteId) {
              const cachedSite = await OfflineCacheService.getCachedSiteDetails(cachedArtifact.data.siteId);
              if (cachedSite.data) {
                setSite(cachedSite.data);
              }
            }
          } else {
            setError("Artifact not available offline. Please view this artifact while online first to cache it.");
          }
        } else {
          // Online: fetch fresh data and cache it
          const artifactData = await ArtifactsService.getArtifactById(id);
          setArtifact(artifactData);
          setUsingCachedData(false);

          // Cache the artifact data
          if (artifactData) {
            await OfflineCacheService.cacheArtifactDetails(id, artifactData);
          }

          // Fetch site data if artifact has a siteId
          if (artifactData?.siteId) {
            try {
              const siteData = await SitesService.getSiteById(artifactData.siteId);
              setSite(siteData);

              // Cache the site data too
              if (siteData) {
                await OfflineCacheService.cacheSiteDetails(artifactData.siteId, siteData);
              }
            } catch (siteError) {
              console.error("Error fetching site data:", siteError);
              // Don't set error here, just log it - artifact details can still be shown
            }
          }
        }
      } catch (error) {
        console.error("Error fetching artifact:", error);

        // If online fetch fails, try cached data
        try {
          const cachedArtifact = await OfflineCacheService.getCachedArtifactDetails(id);
          if (cachedArtifact.data) {
            setArtifact(cachedArtifact.data);
            setUsingCachedData(true);

            if (cachedArtifact.data.siteId) {
              const cachedSite = await OfflineCacheService.getCachedSiteDetails(cachedArtifact.data.siteId);
              if (cachedSite.data) {
                setSite(cachedSite.data);
              }
            }
          } else {
            setError("Failed to load artifact details");
          }
        } catch {
          setError("Failed to load artifact details");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchArtifact();
  }, [id, isOnline, networkChecked]);

  const getSignificanceColor = (significance: string) => {
    switch (significance) {
      case "Very High": return "bg-red-500/10 text-red-600 border-red-500/20";
      case "High": return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "Medium": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "Low": return "bg-green-500/10 text-green-600 border-green-500/20";
      default: return "";
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case "Excellent": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "Good": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "Fair": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "Fragment": return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "Poor": return "bg-red-500/10 text-red-600 border-red-500/20";
      default: return "";
    }
  };

  const formatDate = (date: Date | Timestamp | undefined | any) => {
    const d = parseDate(date);
    if (!d) return "Unknown date";

    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  const handleShare = async () => {
    if (navigator.share && artifact) {
      try {
        await navigator.share({
          title: artifact.name,
          text: artifact.description,
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
          description: "Artifact link has been copied to clipboard",
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

  const handleSiteClick = () => {
    if (site?.id) {
      navigate(`/site/${site.id}`);
    } else if (artifact?.siteId) {
      navigate(`/site/${artifact.siteId}`);
    }
  };

  const handle3DImageDelete = async () => {
    if (!artifact?.id) return;

    try {
      setDeleting3DImage(true);

      // Update artifact to remove 3D model data
      await ArtifactsService.updateArtifact(artifact.id, {
        model3D: null,
        model3DFileName: null,
        model3DForSale: false,
        model3DPrice: null,
      });

      // Refresh artifact data
      const updatedArtifact = await ArtifactsService.getArtifactById(artifact.id);
      setArtifact(updatedArtifact);

      toast({
        title: "Success",
        description: "3D image has been deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting 3D image:", error);
      toast({
        title: "Error",
        description: "Failed to delete 3D image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting3DImage(false);
      setShowDeleteDialog(false);
    }
  };

  // Check if user is a site admin for the artifact's site
  const isSiteAdmin = user && site && (
    site.createdBy === user.uid ||
    site.siteAdmins?.includes(user.uid)
  );

  // Allow editing if:
  // 1. User created the artifact, OR
  // 2. User is a site admin of the site where the artifact belongs
  const isCreator = user && artifact && artifact.createdBy === user.uid;
  const canEdit = user && isArchaeologist && artifact && (isCreator || isSiteAdmin);

  // Can change visibility if: user is the creator and belongs to a Pro/Enterprise org
  const canChangeVisibility = isCreator && isProOrg;

  const handleVisibilityChange = async (newVisibility: 'public' | 'private') => {
    if (!artifact?.id || !canChangeVisibility) return;

    try {
      setUpdatingVisibility(true);
      await ArtifactsService.updateArtifact(artifact.id, { visibility: newVisibility });
      setArtifact(prev => prev ? { ...prev, visibility: newVisibility } : null);
      toast({
        title: "Visibility Updated",
        description: `Artifact is now ${newVisibility}`,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading artifact details...</p>
        </div>
      </div>
    );
  }

  if (error || !artifact) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Artifact not found"}</p>
          <Button onClick={() => navigate("/artifacts")} variant="outline">
            Back to Artifacts
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
            <div className="flex items-center gap-2">
              <PageHeader showLogo={false} />
              {!isOnline && (
                <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                  <WifiOff className="w-3 h-3 mr-1" />
                  Offline
                </Badge>
              )}
              {usingCachedData && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                  Cached
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
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
                  onClick={() => navigate(`/edit-artifact/${artifact.id}`)}
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
          {/* Artifact Images */}
          {artifact.images && artifact.images.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="w-full flex justify-center rounded-lg bg-muted/30">
                  <img
                    src={artifact.images[0]}
                    alt={artifact.name}
                    className="max-w-full max-h-80 object-contain rounded-lg"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
                {artifact.images.length > 1 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto">
                    {artifact.images.slice(1).map((image, index) => (
                      <img
                        key={index}
                        src={image}
                        alt={`${artifact.name} ${index + 2}`}
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0 cursor-pointer hover:opacity-80"
                        onClick={() => {
                          // Could add image modal here
                        }}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Artifact Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                  {artifact.images && artifact.images.length > 0 ? (
                    <img
                      src={artifact.images[0]}
                      alt={artifact.name}
                      className="w-full h-full object-cover rounded-lg"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = `<span class="text-4xl">${
                            artifact.type === 'Coin' ? '🪙' :
                            artifact.type === 'Ceramic' ? '🏺' :
                            artifact.type === 'Weapon' ? '🗡️' :
                            artifact.type === 'Glass' ? '🍶' :
                            artifact.type === 'Personal Ornament' ? '📎' :
                            artifact.type === 'Sculpture' ? '🗿' :
                            '🏺'
                          }</span>`;
                        }
                      }}
                    />
                  ) : (
                    <span className="text-4xl">
                      {artifact.type === 'Coin' ? '🪙' :
                       artifact.type === 'Ceramic' ? '🏺' :
                       artifact.type === 'Weapon' ? '🗡️' :
                       artifact.type === 'Glass' ? '🍶' :
                       artifact.type === 'Personal Ornament' ? '📎' :
                       artifact.type === 'Sculpture' ? '🗿' :
                       '🏺'}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="text-xl font-bold text-foreground">
                      {artifact.name}
                    </h2>
                    <Badge variant="outline" className={getSignificanceColor(artifact.significance)}>
                      <Star className="w-3 h-3 mr-1" />
                      <span className="capitalize">{artifact.significance}</span>
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Building2 className="w-4 h-4" />
                      <button
                        onClick={handleSiteClick}
                        className="hover:text-primary hover:underline"
                        disabled={!site}
                      >
                        {site ? site.name : (artifact.siteName || "Unknown Site")}
                      </button>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{artifact.location}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>Excavated: {formatDate(artifact.excavationDate)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Classification */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Classification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium">Type:</span>
                  <p className="text-muted-foreground">{artifact.type}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Period:</span>
                  <p className="text-muted-foreground">{artifact.period}</p>
                </div>
              </div>
              {artifact.date && (
                <div>
                  <span className="text-sm font-medium">Dating:</span>
                  <p className="text-muted-foreground">{artifact.date}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium">Material:</span>
                  <p className="text-muted-foreground">{artifact.material}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Condition:</span>
                  <Badge variant="outline" className={getConditionColor(artifact.condition)}>
                    {artifact.condition}
                  </Badge>
                </div>
              </div>
              {artifact.dimensions && (
                <div>
                  <span className="text-sm font-medium">Dimensions:</span>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Ruler className="w-3 h-3" />
                    <span>{artifact.dimensions}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3D Image Section - Show for logged in users */}
          {user && artifact.model3D && (
            <Card className={artifact.model3DForSale && artifact.model3DPrice ? "border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    3D Digital Image
                  </CardTitle>
                  {canEdit && isOnline && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/edit-artifact/${artifact.id}`)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowDeleteDialog(true)}
                        disabled={deleting3DImage}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 3D Image Preview */}
                <div className="relative">
                  <img
                    src={artifact.model3D}
                    alt={`${artifact.name} 3D Image`}
                    className="w-full h-64 object-cover rounded-lg border border-border"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  {artifact.model3DFileName && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      <span className="font-medium">File:</span> {artifact.model3DFileName}
                    </div>
                  )}
                </div>

                {/* Purchase Section - Only show if marked for sale */}
                {artifact.model3DForSale && artifact.model3DPrice && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5 text-primary" />
                        <h3 className="text-lg font-semibold">Purchase & Download</h3>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">3D Digital Image Download</p>
                          <p className="text-xs text-muted-foreground">
                            High-quality 3D image for visualization
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-lg font-bold text-primary">
                          <DollarSign className="w-5 h-5" />
                          <span>{artifact.model3DPrice.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="bg-card/50 rounded-lg p-3 space-y-2">
                        <p className="text-sm font-medium">What's included:</p>
                        <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                          <li>• Instant digital download of 3D image</li>
                          <li>• 3D print will be shipped to your address</li>
                          <li>• High-resolution file suitable for 3D visualization</li>
                          <li>• Personal use license included</li>
                        </ul>
                      </div>

                      <Button
                        className="w-full"
                        size="lg"
                        onClick={() => navigate(`/checkout/${artifact.id}`)}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Buy Now - ${artifact.model3DPrice.toFixed(2)}
                      </Button>

                      <p className="text-xs text-center text-muted-foreground">
                        Secure payment processing • Instant download after purchase
                      </p>
                    </div>
                  </>
                )}

                {/* Not for sale message */}
                {!artifact.model3DForSale && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm text-muted-foreground text-center">
                      This 3D image is currently not available for purchase
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {artifact.description || "No description available"}
              </p>
            </CardContent>
          </Card>

          {/* Videos */}
          {artifact.videos && artifact.videos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  Videos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {artifact.videos.map((url, i) => (
                  <video
                    key={i}
                    src={url}
                    controls
                    className="w-full rounded-lg border border-border max-h-96"
                  >
                    Your browser does not support video playback.
                  </video>
                ))}
              </CardContent>
            </Card>
          )}

          {/* AI Image Analysis */}
          {artifact.aiImageSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  🤖 AI Image Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {artifact.aiImageSummary}
                </p>
                <p className="text-xs text-muted-foreground mt-3 italic">
                  This analysis was automatically generated by AI when the artifact image was uploaded.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Archaeological Context */}
          {artifact.findContext && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Archaeological Context</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{artifact.findContext}</p>
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          {artifact.tags && artifact.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {artifact.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {artifact.finder && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Finder:</span>
                  <span className="text-muted-foreground text-sm">
                    {artifact.finder}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Cataloged:</span>
                <span className="text-muted-foreground text-sm">
                  {formatDate(artifact.createdAt)}
                </span>
              </div>
              {artifact.updatedAt && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Last Updated:</span>
                  <span className="text-muted-foreground text-sm">
                    {formatDate(artifact.updatedAt)}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Artifact ID:</span>
                <span className="text-muted-foreground text-sm font-mono">
                  {artifact.id}
                </span>
              </div>

              {/* Visibility Toggle - Only for Pro/Enterprise organizations */}
              {canChangeVisibility && isOnline && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/30">
                    <div className="space-y-0.5">
                      <Label className="text-foreground flex items-center gap-2">
                        {artifact.visibility === 'public' ? (
                          <Globe className="w-4 h-4 text-green-600" />
                        ) : (
                          <Lock className="w-4 h-4 text-amber-600" />
                        )}
                        Visibility
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {artifact.visibility === 'public'
                          ? 'Visible to all users'
                          : 'Only visible to organization members'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${artifact.visibility !== 'public' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        Private
                      </span>
                      <Switch
                        checked={artifact.visibility === 'public'}
                        onCheckedChange={(checked) => handleVisibilityChange(checked ? 'public' : 'private')}
                        disabled={updatingVisibility}
                      />
                      <span className={`text-sm ${artifact.visibility === 'public' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        Public
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete 3D Image</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this 3D image? This action cannot be undone.
              The image will be permanently removed from this artifact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting3DImage}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handle3DImageDelete}
              disabled={deleting3DImage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting3DImage ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResponsiveLayout>
  );
};

export default ArtifactDetails;