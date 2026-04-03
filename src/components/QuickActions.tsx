import { Map, FlaskConical, Users, Compass } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useArchaeologist } from "@/hooks/use-archaeologist";

const actions = [
  { icon: Map, label: "Site Map", subtitle: "View excavation", color: "bg-accent", textColor: "text-accent-foreground", path: "/site-map" },
  { icon: FlaskConical, label: "Analysis", subtitle: "Lab results", color: "bg-secondary", textColor: "text-secondary-foreground", path: "/analysis" },
  { icon: Users, label: "Team", subtitle: "Collaborate", color: "bg-muted", textColor: "text-foreground", path: "/team" },
];

export const QuickActions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isArchaeologist } = useArchaeologist();

  // Only show Quick Actions for logged-in archaeologists
  if (!user || !isArchaeologist) {
    return null;
  }

  return (
    <div className="px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 lg:px-8 lg:py-8">
      <div className="max-w-7xl mx-auto">
        <h3 className="text-h3 font-bold text-foreground mb-3 md:mb-4 lg:mb-5 font-heading leading-tight tracking-tight">
          Quick Actions
        </h3>
        {/* Responsive grid: 3 cols on mobile, 4 cols on lg+ */}
        <div className="grid grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4 lg:gap-5">
          {actions.map((action, index) => (
            <Card
              key={action.label}
              onClick={() => navigate(action.path)}
              className="p-3 sm:p-4 md:p-5 lg:p-6 hover:shadow-lg active:scale-[0.98] lg:active:scale-100 lg:hover:-translate-y-1 transition-all duration-200 cursor-pointer border-border/50 animate-scale-in group"
              style={{ animationDelay: `${index * 75}ms` }}
            >
              {/* Icon container - scales up on larger screens */}
              <div className={`${action.color} w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 lg:w-14 lg:h-14 2xl:w-16 2xl:h-16 rounded-xl md:rounded-2xl flex items-center justify-center mb-2 sm:mb-3 md:mb-4 shadow-sm group-hover:scale-110 transition-transform duration-200`}>
                <action.icon className={`w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 lg:w-7 lg:h-7 2xl:w-8 2xl:h-8 ${action.textColor}`} />
              </div>
              <h4 className="text-h4 font-semibold text-foreground mb-0.5 md:mb-1 leading-snug font-sans group-hover:text-primary transition-colors">
                {action.label}
              </h4>
              <p className="text-caption text-muted-foreground font-sans leading-snug">
                {action.subtitle}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
