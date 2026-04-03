import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { QuickActions } from "@/components/QuickActions";
import { ActiveProject } from "@/components/ActiveProject";
import { RecentFinds } from "@/components/RecentFinds";
import { SiteConditions } from "@/components/SiteConditions";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, MapPin, BookOpen, Calendar } from "lucide-react";
import { SitesService } from "@/services/sites";
import type { Site } from "@/services/sites";
import { ArticlesService } from "@/services/articles";
import type { Article } from "@/services/articles";
import { EventsService } from "@/services/events";
import type { Event as ArcheEvent } from "@/services/events";
import { Timestamp } from "firebase/firestore";

// Default coordinates for Raleigh, North Carolina
const DEFAULT_LOCATION = {
  latitude: 35.7796,
  longitude: -78.6382
};

const formatEventDate = (date: Timestamp | Date | undefined): string => {
  if (!date) return "";
  const d = date instanceof Timestamp ? date.toDate() : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const Index = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [featuredSite, setFeaturedSite] = useState<Site | null>(null);
  const [latestArticle, setLatestArticle] = useState<Article | null>(null);
  const [upcomingEvent, setUpcomingEvent] = useState<ArcheEvent | null>(null);

  useEffect(() => {
    SitesService.getRecentSites(1).then(sites => setFeaturedSite(sites[0] ?? null)).catch(() => {});
    ArticlesService.getAllArticles().then(articles => {
      const published = articles.filter(a => a.published);
      setLatestArticle(published[0] ?? null);
    }).catch(() => {});
    EventsService.getAllEvents().then(events => {
      const now = new Date();
      const upcoming = events
        .filter(e => {
          const d = e.date instanceof Timestamp ? e.date.toDate() : new Date(e.date as any);
          return d >= now;
        })
        .sort((a, b) => {
          const da = a.date instanceof Timestamp ? a.date.toDate() : new Date(a.date as any);
          const db_ = b.date instanceof Timestamp ? b.date.toDate() : new Date(b.date as any);
          return da.getTime() - db_.getTime();
        });
      setUpcomingEvent(upcoming[0] ?? null);
    }).catch(() => {});
  }, []);

  // Get user's location on component mount
  useEffect(() => {
    const getUserLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
            setLocationLoading(false);
            console.log('User location obtained:', position.coords.latitude, position.coords.longitude);
          },
          (error) => {
            console.warn('Location permission denied or unavailable:', error.message);
            console.log('Using default location: Raleigh, NC');
            setUserLocation(DEFAULT_LOCATION);
            setLocationLoading(false);
          },
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 0
          }
        );
      } else {
        console.warn('Geolocation is not supported by this browser');
        console.log('Using default location: Raleigh, NC');
        setUserLocation(DEFAULT_LOCATION);
        setLocationLoading(false);
      }
    };

    getUserLocation();
  }, []);

  return (
    <ResponsiveLayout>
      <AppHeader />

      {/* Feature Cards */}
      <div className="py-8 max-w-7xl mx-auto">
        {/* Mobile: horizontal scroll carousel. sm+: 3-column grid */}
        <div className="flex sm:grid sm:grid-cols-3 gap-4 sm:gap-6 overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none scroll-smooth px-4 sm:px-6 lg:px-8 pb-2 sm:pb-0 [-webkit-overflow-scrolling:touch]">
          {/* Featured Content */}
          <Card
            className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow group flex-none w-[80vw] sm:w-auto snap-start"
            onClick={() => navigate("/site-lists")}
          >
            <div className="aspect-video overflow-hidden">
              <img
                src={featuredSite?.images?.[0] ?? "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80"}
                alt={featuredSite?.name ?? "Archaeological site"}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="p-4">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Featured Content</p>
              <h3 className="font-semibold text-foreground text-sm leading-snug mb-1 line-clamp-2">
                {featuredSite?.name ?? "Explore Archaeological Sites"}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {featuredSite?.description ?? "Browse NC archaeological sites and discoveries."}
              </p>
              <div className="mt-3 flex items-center gap-1 text-xs text-primary font-medium">
                View Sites <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </Card>

          {/* Latest Articles */}
          <Card
            className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow group flex-none w-[80vw] sm:w-auto snap-start"
            onClick={() => navigate("/articles")}
          >
            <div className="aspect-video overflow-hidden">
              <img
                src={latestArticle?.image ?? "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&q=80"}
                alt={latestArticle?.title ?? "Research articles"}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="p-4">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Latest Articles</p>
              <h3 className="font-semibold text-foreground text-sm leading-snug mb-1 line-clamp-2">
                {latestArticle?.title ?? "Research & Discoveries"}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {latestArticle?.excerpt ?? "Read the latest archaeological research and field notes."}
              </p>
              <div className="mt-3 flex items-center gap-1 text-xs text-amber-600 font-medium">
                Read Articles <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </Card>

          {/* Upcoming Events */}
          <Card
            className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow group flex-none w-[80vw] sm:w-auto snap-start"
            onClick={() => navigate("/events")}
          >
            <div className="aspect-video overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=600&q=80"
                alt="Community events"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="p-4">
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">Upcoming Events</p>
              <h3 className="font-semibold text-foreground text-sm leading-snug mb-1 line-clamp-2">
                {upcomingEvent?.title ?? "Community Events"}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {upcomingEvent
                  ? `${formatEventDate(upcomingEvent.date)} · ${upcomingEvent.locationName}`
                  : "Join upcoming archaeology events and workshops."}
              </p>
              <div className="mt-3 flex items-center gap-1 text-xs text-green-600 font-medium">
                View Events <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </Card>
        </div>
      </div>

      <main className="animate-fade-in">
        {/* Two-column layout on desktop */}
        <div className="lg:flex lg:gap-8 px-4 mx-auto max-w-7xl lg:py-6">
          {/* Main content column */}
          <div className="lg:flex-1">
            <QuickActions />
            <ActiveProject />
            <RecentFinds />
          </div>

          {/* Sidebar column - only on desktop */}
          <div className="hidden lg:block lg:w-80 xl:w-96 lg:flex-shrink-0">
            {/* Show Site Conditions in sidebar on desktop */}
            {!isAuthenticated && !locationLoading && userLocation && (
              <div className="sticky top-24">
                <SiteConditions
                  latitude={userLocation.latitude}
                  longitude={userLocation.longitude}
                />
              </div>
            )}
          </div>
        </div>

        {/* Show Site Conditions inline on mobile for non-authenticated users */}
        <div className="lg:hidden">
          {!isAuthenticated && !locationLoading && userLocation && (
            <SiteConditions
              latitude={userLocation.latitude}
              longitude={userLocation.longitude}
            />
          )}
        </div>
      </main>
    </ResponsiveLayout>
  );
};

export default Index;
