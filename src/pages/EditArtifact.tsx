import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Upload, Image as ImageIcon, MapPin, Calendar, Ruler, Tag, Loader2, Building2, DollarSign, Mic, MicOff, FileText, Video, X } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { AccountButton } from "@/components/AccountButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ArtifactsService, Artifact } from "@/services/artifacts";
import { SitesService, Site } from "@/services/sites";
import { AzureOpenAIService } from "@/services/azure-openai";
import { DropdownOptionsService } from "@/services/dropdown-options";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import { useArchaeologist } from "@/hooks/use-archaeologist";
import { DEFAULT_ORGANIZATION_ID } from "@/types/organization";
import { Timestamp } from "firebase/firestore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

// Default values (fallback if Firebase fetch fails)
const defaultTypes = ["Coin", "Ceramic", "Weapon", "Glass", "Personal Ornament", "Sculpture", "Other"];
const defaultPeriods = ["Imperial Roman", "Roman", "Late Roman", "Byzantine", "Medieval", "Other"];
const defaultMaterials = ["Gold", "Silver", "Bronze", "Iron", "Terracotta", "Ceramic", "Glass", "Marble", "Stone", "Bone", "Wood", "Other"];
const defaultConditions = ["Excellent", "Good", "Fair", "Fragment", "Poor", "Other"];
const defaultSignificance = ["Very High", "High", "Medium", "Low", "Other"];

const EditArtifact = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { organization } = useUser();
  const { isArchaeologist, canCreate } = useArchaeologist();

  // Check if user is in a Pro/Enterprise organization (non-default)
  const isProOrg = organization &&
    organization.id !== DEFAULT_ORGANIZATION_ID &&
    (organization.subscriptionLevel === 'Pro' || organization.subscriptionLevel === 'Enterprise');
  const [loading, setLoading] = useState(false);
  const [fetchingArtifact, setFetchingArtifact] = useState(true);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [userSites, setUserSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<File[]>([]);
  const [selected3DModel, setSelected3DModel] = useState<File | null>(null);
  const [model3DForSale, setModel3DForSale] = useState(false);
  const [model3DPrice, setModel3DPrice] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [customType, setCustomType] = useState("");
  const [customPeriod, setCustomPeriod] = useState("");
  const [customMaterial, setCustomMaterial] = useState("");
  const [customCondition, setCustomCondition] = useState("");
  const [customSignificance, setCustomSignificance] = useState("");

  // Dropdown options from Firebase
  const [types, setTypes] = useState<string[]>(defaultTypes);
  const [periods, setPeriods] = useState<string[]>(defaultPeriods);
  const [materials, setMaterials] = useState<string[]>(defaultMaterials);
  const [conditions, setConditions] = useState<string[]>(defaultConditions);
  const [significance, setSignificance] = useState<string[]>(defaultSignificance);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: "",
    type: "",
    period: "",
    date: "",
    material: "",
    dimensions: "",
    location: "",
    excavationDate: new Date().toISOString().split('T')[0],
    condition: "",
    description: "",
    findContext: "",
    significance: "",
    tags: "",
    finder: "",
    siteId: "",
    notes: "",
  });

  // Fetch artifact data
  useEffect(() => {
    const fetchArtifact = async () => {
      if (!id) {
        toast({
          title: "Error",
          description: "Artifact ID not found",
          variant: "destructive"
        });
        navigate("/artifacts");
        return;
      }

      try {
        setFetchingArtifact(true);
        const artifactData = await ArtifactsService.getArtifactById(id);

        if (!artifactData) {
          toast({
            title: "Error",
            description: "Artifact not found",
            variant: "destructive"
          });
          navigate("/artifacts");
          return;
        }

        // Check if user is the creator
        if (artifactData.createdBy !== user?.uid) {
          toast({
            title: "Unauthorized",
            description: "You can only edit artifacts you created",
            variant: "destructive"
          });
          navigate(`/artifact/${id}`);
          return;
        }

        setArtifact(artifactData);

        // Pre-populate form with artifact data
        const excavationDate = artifactData.excavationDate instanceof Timestamp
          ? artifactData.excavationDate.toDate()
          : artifactData.excavationDate;

        setFormData({
          name: artifactData.name || "",
          type: artifactData.type || "",
          period: artifactData.period || "",
          date: artifactData.date || "",
          material: artifactData.material || "",
          dimensions: artifactData.dimensions || "",
          location: artifactData.location || "",
          excavationDate: excavationDate ? new Date(excavationDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          condition: artifactData.condition || "",
          description: artifactData.description || "",
          findContext: artifactData.findContext || "",
          significance: artifactData.significance || "",
          tags: artifactData.tags?.join(', ') || "",
          finder: artifactData.finder || "",
          siteId: artifactData.siteId || "",
          notes: (artifactData as any).notes || "",
        });

        // Set existing AI summary if available
        if (artifactData.aiImageSummary) {
          setAiSummary(artifactData.aiImageSummary);
        }

        // Set existing image preview if available
        if (artifactData.images && artifactData.images.length > 0) {
          setImagePreview(artifactData.images[0]);
        }

        // Set existing 3D model sale information if available
        if (artifactData.model3DForSale !== undefined) {
          setModel3DForSale(artifactData.model3DForSale);
        }
        if (artifactData.model3DPrice) {
          setModel3DPrice(artifactData.model3DPrice.toString());
        }
      } catch (error) {
        console.error("Error fetching artifact:", error);
        toast({
          title: "Error",
          description: "Failed to load artifact",
          variant: "destructive"
        });
        navigate("/artifacts");
      } finally {
        setFetchingArtifact(false);
      }
    };

    fetchArtifact();
  }, [id, user, navigate, toast]);

  // Fetch dropdown options from Firebase
  useEffect(() => {
    const fetchDropdownOptions = async () => {
      try {
        setOptionsLoading(true);
        const options = await DropdownOptionsService.getOptions();

        // Helper function to sort alphabetically while keeping "Other" at the end
        const sortWithOtherLast = (arr: string[]) => {
          const other = arr.filter(item => item === "Other");
          const rest = arr.filter(item => item !== "Other").sort((a, b) => a.localeCompare(b));
          return [...rest, ...other];
        };

        setTypes(sortWithOtherLast(options.types));
        setPeriods(sortWithOtherLast(options.periods));
        setMaterials(sortWithOtherLast(options.materials));
        setConditions(sortWithOtherLast(options.conditions));
        setSignificance(sortWithOtherLast(options.significance));
      } catch (error) {
        console.error('Error fetching dropdown options:', error);
        // Keep default values on error
      } finally {
        setOptionsLoading(false);
      }
    };

    fetchDropdownOptions();
  }, []);

  // Fetch sites belonging to user's organization
  // For Pro/Enterprise orgs: Show organization sites where user is creator or site admin
  // For Default/Free orgs: Show only user's own sites
  useEffect(() => {
    const fetchUserSites = async () => {
      if (!user || !organization) return;

      try {
        setSitesLoading(true);
        const allSites = await SitesService.getAllSites();

        // Filter sites based on organization type
        let filteredSites: Site[];

        if (isProOrg) {
          // Pro/Enterprise: Show sites belonging to user's organization
          // Include sites where user is creator or site admin
          filteredSites = allSites.filter(site =>
            site.organizationId === organization.id &&
            (site.createdBy === user.uid || site.siteAdmins?.includes(user.uid))
          );
        } else {
          // Default/Free org: Show only sites created by the user
          filteredSites = allSites.filter(site => site.createdBy === user.uid);
        }

        setUserSites(filteredSites);
      } catch (error) {
        console.error('Error fetching user sites:', error);
        toast({
          title: "Error",
          description: "Failed to load your sites",
          variant: "destructive"
        });
      } finally {
        setSitesLoading(false);
      }
    };

    if (user && isArchaeologist && organization) {
      fetchUserSites();
    }
  }, [user, isArchaeologist, organization, isProOrg, toast]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = true;
        recognitionInstance.interimResults = true;
        recognitionInstance.lang = 'en-US';

        recognitionInstance.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          if (finalTranscript) {
            setFormData(prev => ({
              ...prev,
              notes: prev.notes + finalTranscript
            }));
          }
        };

        recognitionInstance.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsRecording(false);
          toast({
            title: "Speech Recognition Error",
            description: "Unable to recognize speech. Please try again.",
            variant: "destructive"
          });
        };

        recognitionInstance.onend = () => {
          setIsRecording(false);
        };

        setRecognition(recognitionInstance);
      }
    }
  }, [toast]);

  const toggleRecording = () => {
    if (!recognition) {
      toast({
        title: "Speech Recognition Not Available",
        description: "Your browser doesn't support speech recognition. Please use Chrome, Edge, or Safari.",
        variant: "destructive"
      });
      return;
    }

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      try {
        recognition.start();
        setIsRecording(true);
        toast({
          title: "Recording Started",
          description: "Speak now to add notes...",
        });
      } catch (error) {
        console.error('Error starting recognition:', error);
        toast({
          title: "Error",
          description: "Failed to start recording. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 5MB",
          variant: "destructive"
        });
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive"
        });
        return;
      }

      setSelectedImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Start AI analysis
      analyzeImageWithAI(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(artifact?.images?.[0] || null);
    setAiSummary(artifact?.aiImageSummary || "");
    setAnalyzingImage(false);
  };

  const handle3DModelSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (limit to 10MB for 3D images)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a 3D image smaller than 10MB",
          variant: "destructive"
        });
        return;
      }

      // Check file type (image formats)
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select a valid image file (JPG, PNG, GIF, etc.)",
          variant: "destructive"
        });
        return;
      }

      setSelected3DModel(file);
      toast({
        title: "3D Image Selected",
        description: `${file.name} is ready to upload`,
      });
    }
  };

  const remove3DModel = () => {
    setSelected3DModel(null);
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    const MAX_VIDEO_MB = 100;
    for (const file of files) {
      if (!file.type.startsWith('video/')) {
        toast({ title: "Invalid file type", description: `"${file.name}" is not a video file`, variant: "destructive" });
        continue;
      }
      if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
        toast({ title: "File too large", description: `"${file.name}" exceeds the ${MAX_VIDEO_MB} MB limit`, variant: "destructive" });
        continue;
      }
      setSelectedVideos(prev => [...prev, file]);
    }
  };

  const removeVideo = (index: number) => {
    setSelectedVideos(prev => prev.filter((_, i) => i !== index));
  };

  const analyzeImageWithAI = async (file: File) => {
    try {
      setAnalyzingImage(true);
      console.log('🤖 Starting AI analysis...');

      const summary = await AzureOpenAIService.analyzeArtifactImage(file);
      setAiSummary(summary);

      toast({
        title: "AI Analysis Complete",
        description: "Image has been analyzed and summary generated",
      });
    } catch (error) {
      console.error('AI analysis error:', error);
      toast({
        title: "AI Analysis Failed",
        description: "Could not analyze image, but you can still save the artifact",
        variant: "destructive"
      });
    } finally {
      setAnalyzingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id || !artifact) {
      toast({
        title: "Error",
        description: "Artifact not found",
        variant: "destructive"
      });
      return;
    }

    // Basic validation
    if (!formData.name) {
      toast({
        title: "Validation Error",
        description: "Please provide an artifact name",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be signed in to edit artifacts",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Find the selected site to get its name
      const selectedSite = userSites.find(site => site.id === formData.siteId);

      // Save custom values to Firebase dropdown options if provided
      if (formData.type === "Other" && customType && customType.trim()) {
        try {
          await DropdownOptionsService.addOptionValue("types", customType.trim());
          if (!types.includes(customType.trim())) {
            setTypes(prev => [...prev.filter(t => t !== "Other"), customType.trim(), "Other"]);
          }
        } catch (error) {
          console.error("Error saving custom type:", error);
        }
      }

      if (formData.period === "Other" && customPeriod && customPeriod.trim()) {
        try {
          await DropdownOptionsService.addOptionValue("periods", customPeriod.trim());
          if (!periods.includes(customPeriod.trim())) {
            setPeriods(prev => [...prev.filter(p => p !== "Other"), customPeriod.trim(), "Other"]);
          }
        } catch (error) {
          console.error("Error saving custom period:", error);
        }
      }

      if (formData.material === "Other" && customMaterial && customMaterial.trim()) {
        try {
          await DropdownOptionsService.addOptionValue("materials", customMaterial.trim());
          if (!materials.includes(customMaterial.trim())) {
            setMaterials(prev => [...prev.filter(m => m !== "Other"), customMaterial.trim(), "Other"]);
          }
        } catch (error) {
          console.error("Error saving custom material:", error);
        }
      }

      if (formData.condition === "Other" && customCondition && customCondition.trim()) {
        try {
          await DropdownOptionsService.addOptionValue("conditions", customCondition.trim());
          if (!conditions.includes(customCondition.trim())) {
            setConditions(prev => [...prev.filter(c => c !== "Other"), customCondition.trim(), "Other"]);
          }
        } catch (error) {
          console.error("Error saving custom condition:", error);
        }
      }

      if (formData.significance === "Other" && customSignificance && customSignificance.trim()) {
        try {
          await DropdownOptionsService.addOptionValue("significance", customSignificance.trim());
          if (!significance.includes(customSignificance.trim())) {
            setSignificance(prev => [...prev.filter(s => s !== "Other"), customSignificance.trim(), "Other"]);
          }
        } catch (error) {
          console.error("Error saving custom significance:", error);
        }
      }

      const updateData: any = {
        name: formData.name,
        type: formData.type === "Other" && customType ? customType.trim() : formData.type,
        period: formData.period === "Other" && customPeriod ? customPeriod.trim() : formData.period,
        date: formData.date || "",
        material: formData.material === "Other" && customMaterial ? customMaterial.trim() : formData.material,
        dimensions: formData.dimensions || "",
        location: formData.location,
        excavationDate: Timestamp.fromDate(new Date(formData.excavationDate)),
        condition: formData.condition === "Other" && customCondition ? customCondition.trim() : formData.condition,
        description: formData.description,
        findContext: formData.findContext || "",
        significance: formData.significance === "Other" && customSignificance ? customSignificance.trim() : formData.significance,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : [],
        finder: formData.finder || "",
        aiImageSummary: aiSummary || artifact.aiImageSummary || "",
        siteName: selectedSite?.name || artifact.siteName || "",
        siteId: formData.siteId,
        model3DForSale: model3DForSale,
        notes: formData.notes || "",
      };

      // Only include model3DPrice if it has a valid value
      if (model3DForSale && model3DPrice) {
        updateData.model3DPrice = parseFloat(model3DPrice);
      }

      await ArtifactsService.updateArtifact(id, updateData);

      // Upload new image if selected
      if (selectedImage) {
        try {
          const imageUrl = await ArtifactsService.uploadArtifactImage(id, selectedImage);
          // Append new image to existing images array
          const existingImages = artifact.images || [];
          await ArtifactsService.updateArtifactImages(id, [imageUrl, ...existingImages]);
        } catch (imageError) {
          console.error("Error uploading image:", imageError);
          toast({
            title: "Warning",
            description: "Artifact updated but image upload failed",
            variant: "destructive"
          });
        }
      }

      // Upload new videos if selected (appended to any existing ones)
      if (selectedVideos.length > 0) {
        try {
          const existingVideos = artifact?.videos ?? [];
          const newUrls = await Promise.all(
            selectedVideos.map(v => ArtifactsService.uploadArtifactVideo(id, v))
          );
          await ArtifactsService.updateArtifactVideos(id, [...existingVideos, ...newUrls]);
        } catch (videoError) {
          console.error("Error uploading videos:", videoError);
          toast({ title: "Warning", description: "Artifact saved but video upload failed", variant: "destructive" });
        }
      }

      // Upload 3D model if selected
      if (selected3DModel) {
        try {
          const modelUrl = await ArtifactsService.upload3DModel(id, selected3DModel);
          await ArtifactsService.updateArtifact3DModel(id, modelUrl, selected3DModel.name);
        } catch (modelError) {
          console.error("Error uploading 3D model:", modelError);
          toast({
            title: "Warning",
            description: "Artifact updated but 3D model upload failed",
            variant: "destructive"
          });
        }
      }

      toast({
        title: "Success!",
        description: "Artifact has been successfully updated",
      });

      // Navigate back to artifact details page
      setTimeout(() => {
        navigate(`/artifact/${id}`);
      }, 1500);

    } catch (error) {
      console.error("Error updating artifact:", error);
      toast({
        title: "Error",
        description: "Failed to update artifact. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetchingArtifact) {
    return (
      <ResponsiveLayout>
        <header className="bg-card/95 backdrop-blur-lg px-4 py-4 sm:px-6 lg:px-8 border-b border-border sticky top-0 z-40">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <PageHeader showLogo={false} />
            <AccountButton />
          </div>
        </header>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading artifact...</p>
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  if (!canCreate) {
    return (
      <ResponsiveLayout>
        <header className="bg-card/95 backdrop-blur-lg px-4 py-4 sm:px-6 lg:px-8 border-b border-border sticky top-0 z-40">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <PageHeader showLogo={false} />
            <AccountButton />
          </div>
        </header>
        <div className="p-4 lg:p-6">
          <Card>
            <div className="p-6 text-center">
              <p className="text-muted-foreground mb-4">
                {!user ? 'Please sign in as an archaeologist to edit artifacts.' :
                 !isArchaeologist ? 'Only verified archaeologists can edit artifacts.' :
                 'Loading...'}
              </p>
              {!user && (
                <Button
                  onClick={() => navigate('/authentication/sign-in')}
                  variant="outline"
                >
                  Sign In as Archaeologist
                </Button>
              )}
            </div>
          </Card>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <header className="bg-card/95 backdrop-blur-lg px-4 py-4 sm:px-6 lg:px-8 border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <PageHeader showLogo={false} />
          <AccountButton />
        </div>
      </header>

      <div className="p-4 lg:p-6 space-y-6 mx-auto max-w-7xl">
          <Card className="p-6 border-border">
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Artifact preview"
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
                {selectedImage && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={removeImage}
                  >
                    Remove New Image
                  </Button>
                )}
              </div>
            ) : (
              <label htmlFor="image-upload" className="cursor-pointer">
                <div className="flex items-center justify-center h-48 bg-muted rounded-lg mb-4 hover:bg-muted/80 transition-colors">
                  <div className="text-center">
                    <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Click to add artifact image</p>
                    <p className="text-xs text-muted-foreground mt-1">Max 5MB (JPG, PNG, GIF)</p>
                  </div>
                </div>
              </label>
            )}
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <label htmlFor="image-upload">
              <Button variant="outline" className="w-full" size="sm" type="button" asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  {selectedImage ? 'Change New Image' : imagePreview ? 'Add New Image' : 'Upload Image'}
                </span>
              </Button>
            </label>
          </Card>

          {/* AI Image Analysis Section */}
          {(selectedImage || aiSummary) && (
            <Card className="border-border">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Label className="text-foreground flex items-center gap-2">
                    🤖 AI Image Analysis
                    {analyzingImage && <Loader2 className="w-4 h-4 animate-spin" />}
                  </Label>
                  {aiSummary ? (
                    <div className="p-4 bg-muted/50 rounded-lg border border-border">
                      <p className="text-sm text-muted-foreground mb-2">Generated analysis:</p>
                      <p className="text-sm">{aiSummary}</p>
                    </div>
                  ) : analyzingImage ? (
                    <div className="p-4 bg-muted/30 rounded-lg border border-dashed border-border">
                      <p className="text-sm text-muted-foreground">Analyzing image with AI...</p>
                    </div>
                  ) : (
                    <div className="p-4 bg-muted/30 rounded-lg border border-dashed border-border">
                      <p className="text-sm text-muted-foreground">AI analysis will appear here after image upload</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Field Notes Section with Speech-to-Text */}
          <Card className="border-border">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="notes" className="text-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Field Notes (Speech-to-Text)
                  </Label>
                  <Button
                    type="button"
                    variant={isRecording ? "destructive" : "outline"}
                    size="sm"
                    onClick={toggleRecording}
                    className="gap-2"
                  >
                    {isRecording ? (
                      <>
                        <MicOff className="w-4 h-4" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4" />
                        Start Recording
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  id="notes"
                  placeholder="Field notes, observations, updates... (You can type or use voice recording)"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="min-h-32 border-border"
                />
                {isRecording && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                    <span>Recording in progress... Speak now</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Use the microphone button to add voice notes, or type manually. Perfect for capturing additional details.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 3D Image Upload Section */}
          <Card className="border-border">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    Additional 3D Image Upload
                  </Label>
                </div>

                {/* Display existing 3D image if available */}
                {artifact?.model3D && !selected3DModel && (
                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <ImageIcon className="w-8 h-8 text-primary" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Current 3D Image</p>
                        <p className="text-xs text-muted-foreground">
                          {artifact.model3DFileName || 'Uploaded 3D image'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {selected3DModel ? (
                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ImageIcon className="w-8 h-8 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{selected3DModel.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(selected3DModel.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={remove3DModel}
                      >
                        Remove New Image
                      </Button>
                    </div>
                  </div>
                ) : !artifact?.model3D && (
                  <label htmlFor="model-upload" className="cursor-pointer">
                    <div className="flex items-center justify-center h-32 bg-muted rounded-lg hover:bg-muted/80 transition-colors border border-dashed border-border">
                      <div className="text-center">
                        <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Click to upload additional 3D image</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Max 10MB (JPG, PNG, GIF, etc.)
                        </p>
                      </div>
                    </div>
                  </label>
                )}

                <input
                  id="model-upload"
                  type="file"
                  accept="image/*"
                  onChange={handle3DModelSelect}
                  className="hidden"
                />

                <label htmlFor="model-upload">
                  <Button
                    variant="outline"
                    className="w-full"
                    size="sm"
                    type="button"
                    asChild
                  >
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      {selected3DModel ? 'Change New 3D Image' : artifact?.model3D ? 'Replace 3D Image' : 'Upload 3D Image'}
                    </span>
                  </Button>
                </label>

                {/* 3D Image Sale Options */}
                <div className="space-y-4 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="model-for-sale" className="text-foreground">
                        Mark 3D Image for Sale
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Allow users to purchase and download the 3D digital images and also 3D prints
                      </p>
                    </div>
                    <Switch
                      id="model-for-sale"
                      checked={model3DForSale}
                      onCheckedChange={setModel3DForSale}
                      disabled={!artifact?.model3D && !selected3DModel}
                    />
                  </div>

                  {model3DForSale && (
                    <div className="space-y-2">
                      <Label htmlFor="model-price" className="text-foreground">
                        Download Price (USD)
                      </Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="model-price"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="e.g., 9.99"
                          value={model3DPrice}
                          onChange={(e) => setModel3DPrice(e.target.value)}
                          className="pl-10 border-border"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Set the price for users to download this 3D image
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Videos */}
          <Card className="border-border">
            <CardContent className="pt-6 space-y-3">
              <Label className="text-foreground flex items-center gap-2">
                <Video className="w-4 h-4" />
                Videos
              </Label>

              {/* Existing videos */}
              {artifact?.videos && artifact.videos.length > 0 && (
                <ul className="space-y-1">
                  {artifact.videos.map((url, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm bg-muted rounded px-2 py-1.5">
                      <Video className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate text-muted-foreground">Saved video {i + 1}</span>
                      <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline shrink-0">View</a>
                    </li>
                  ))}
                </ul>
              )}

              {/* Newly selected videos */}
              {selectedVideos.length > 0 && (
                <ul className="space-y-1">
                  {selectedVideos.map((v, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm bg-muted rounded px-2 py-1.5">
                      <Video className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{v.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {(v.size / (1024 * 1024)).toFixed(1)} MB
                      </span>
                      <button type="button" aria-label={`Remove ${v.name}`} onClick={() => removeVideo(i)}>
                        <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <label htmlFor="video-upload-edit">
                <Button variant="outline" className="w-full" size="sm" type="button" asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    {(artifact?.videos?.length || 0) + selectedVideos.length > 0 ? 'Add More Videos' : 'Upload Videos'}
                  </span>
                </Button>
              </label>
              <input
                id="video-upload-edit"
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                onChange={handleVideoSelect}
              />
              <p className="text-xs text-muted-foreground">
                MP4, MOV, WebM — up to 100 MB each. New videos are appended to existing ones.
              </p>
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">Artifact Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Roman Gold Aureus"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="siteId" className="text-foreground">Associated Site</Label>
              <Select
                value={formData.siteId}
                onValueChange={(value) => setFormData({ ...formData, siteId: value })}
                disabled={sitesLoading}
              >
                <SelectTrigger className="border-border">
                  <SelectValue placeholder={sitesLoading ? "Loading your sites..." : "Select a site"} />
                </SelectTrigger>
                <SelectContent>
                  {userSites.map((site) => (
                    <SelectItem key={site.id} value={site.id!}>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        <span>{site.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type" className="text-foreground">Type</Label>
                <Select
                  value={formData.type === "Other" && customType ? customType : formData.type}
                  onValueChange={(value) => {
                    if (types.includes(value)) {
                      setFormData({ ...formData, type: value });
                      if (value !== "Other") {
                        setCustomType("");
                      }
                    } else {
                      setFormData({ ...formData, type: "Other" });
                    }
                  }}
                >
                  <SelectTrigger className="border-border">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                    {customType && formData.type === "Other" && (
                      <SelectItem key="custom-type" value={customType}>
                        {customType}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {formData.type === "Other" && (
                  <Input
                    placeholder="Enter custom type..."
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    className="border-border mt-2"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="period" className="text-foreground">Period</Label>
                <Select
                  value={formData.period === "Other" && customPeriod ? customPeriod : formData.period}
                  onValueChange={(value) => {
                    if (periods.includes(value)) {
                      setFormData({ ...formData, period: value });
                      if (value !== "Other") {
                        setCustomPeriod("");
                      }
                    } else {
                      setFormData({ ...formData, period: "Other" });
                    }
                  }}
                >
                  <SelectTrigger className="border-border">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((period) => (
                      <SelectItem key={period} value={period}>
                        {period}
                      </SelectItem>
                    ))}
                    {customPeriod && formData.period === "Other" && (
                      <SelectItem key="custom-period" value={customPeriod}>
                        {customPeriod}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {formData.period === "Other" && (
                  <Input
                    placeholder="Enter custom period..."
                    value={customPeriod}
                    onChange={(e) => setCustomPeriod(e.target.value)}
                    className="border-border mt-2"
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date" className="text-foreground">Date/Era</Label>
              <Input
                id="date"
                placeholder="e.g., 117-138 CE, 2nd century CE"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="border-border"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="material" className="text-foreground">Material</Label>
                <Select
                  value={formData.material === "Other" && customMaterial ? customMaterial : formData.material}
                  onValueChange={(value) => {
                    if (materials.includes(value)) {
                      setFormData({ ...formData, material: value });
                      if (value !== "Other") {
                        setCustomMaterial("");
                      }
                    } else {
                      setFormData({ ...formData, material: "Other" });
                    }
                  }}
                >
                  <SelectTrigger className="border-border">
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((material) => (
                      <SelectItem key={material} value={material}>
                        {material}
                      </SelectItem>
                    ))}
                    {customMaterial && formData.material === "Other" && (
                      <SelectItem key="custom-material" value={customMaterial}>
                        {customMaterial}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {formData.material === "Other" && (
                  <Input
                    placeholder="Enter custom material..."
                    value={customMaterial}
                    onChange={(e) => setCustomMaterial(e.target.value)}
                    className="border-border mt-2"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="condition" className="text-foreground">Condition</Label>
                <Select
                  value={formData.condition === "Other" && customCondition ? customCondition : formData.condition}
                  onValueChange={(value) => {
                    if (conditions.includes(value)) {
                      setFormData({ ...formData, condition: value });
                      if (value !== "Other") {
                        setCustomCondition("");
                      }
                    } else {
                      setFormData({ ...formData, condition: "Other" });
                    }
                  }}
                >
                  <SelectTrigger className="border-border">
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    {conditions.map((condition) => (
                      <SelectItem key={condition} value={condition}>
                        {condition}
                      </SelectItem>
                    ))}
                    {customCondition && formData.condition === "Other" && (
                      <SelectItem key="custom-condition" value={customCondition}>
                        {customCondition}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {formData.condition === "Other" && (
                  <Input
                    placeholder="Enter custom condition..."
                    value={customCondition}
                    onChange={(e) => setCustomCondition(e.target.value)}
                    className="border-border mt-2"
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dimensions" className="text-foreground">Dimensions</Label>
              <div className="relative">
                <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="dimensions"
                  placeholder="e.g., 19mm diameter, 7.3g"
                  value={formData.dimensions}
                  onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                  className="pl-10 border-border"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="text-foreground">Find Location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="location"
                  placeholder="e.g., Sector A, Grid 23"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="pl-10 border-border"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="excavationDate" className="text-foreground">Excavation Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="excavationDate"
                  type="date"
                  value={formData.excavationDate}
                  onChange={(e) => setFormData({ ...formData, excavationDate: e.target.value })}
                  className="pl-10 border-border"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="significance" className="text-foreground">Significance</Label>
              <Select
                value={formData.significance === "Other" && customSignificance ? customSignificance : formData.significance}
                onValueChange={(value) => {
                  if (significance.includes(value)) {
                    setFormData({ ...formData, significance: value });
                    if (value !== "Other") {
                      setCustomSignificance("");
                    }
                  } else {
                    setFormData({ ...formData, significance: "Other" });
                  }
                }}
              >
                <SelectTrigger className="border-border">
                  <SelectValue placeholder="Select significance level" />
                </SelectTrigger>
                <SelectContent>
                  {significance.map((sig) => (
                    <SelectItem key={sig} value={sig}>
                      {sig}
                    </SelectItem>
                  ))}
                  {customSignificance && formData.significance === "Other" && (
                    <SelectItem key="custom-significance" value={customSignificance}>
                      {customSignificance}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {formData.significance === "Other" && (
                <Input
                  placeholder="Enter custom significance..."
                  value={customSignificance}
                  onChange={(e) => setCustomSignificance(e.target.value)}
                  className="border-border mt-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-foreground">Description</Label>
              <Textarea
                id="description"
                placeholder="Detailed description of the artifact, notable features, decoration..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-32 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="findContext" className="text-foreground">Find Context</Label>
              <Textarea
                id="findContext"
                placeholder="Archaeological context of the find (e.g., domestic context, burial, layer info...)"
                value={formData.findContext}
                onChange={(e) => setFormData({ ...formData, findContext: e.target.value })}
                className="min-h-24 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="finder" className="text-foreground">Finder Name</Label>
              <Input
                id="finder"
                placeholder="Name of person who discovered the artifact"
                value={formData.finder}
                onChange={(e) => setFormData({ ...formData, finder: e.target.value })}
                className="border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags" className="text-foreground">Tags</Label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="tags"
                  placeholder="e.g., Roman, Gold, Imperial, Currency (comma-separated)"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="pl-10 border-border"
                />
              </div>
              <p className="text-xs text-muted-foreground">Separate multiple tags with commas</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate(-1)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Artifact"
                )}
              </Button>
            </div>
          </form>
        </div>
    </ResponsiveLayout>
  );
};

export default EditArtifact;
