import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, ChevronRight, CheckCircle2, Clock, Send, Inbox } from 'lucide-react';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import { PageHeader } from '@/components/PageHeader';
import { AccountButton } from '@/components/AccountButton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SiteAssignmentsService } from '@/services/siteAssignments';
import { SiteTemplatesService } from '@/services/siteTemplates';
import { useAuth } from '@/hooks/use-auth';
import { useUser } from '@/hooks/use-user';
import type { Site } from '@/services/sites';
import type { SubmissionStatus } from '@/types/siteSubmissions';

const STATUS_CONFIG: Record<
  SubmissionStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline'; icon: React.ElementType }
> = {
  assigned: { label: 'Pending', variant: 'secondary', icon: Inbox },
  in_progress: { label: 'In Progress', variant: 'default', icon: Clock },
  submitted: { label: 'Submitted', variant: 'outline', icon: Send },
  reviewed: { label: 'Reviewed', variant: 'secondary', icon: CheckCircle2 },
};

function StatusBadge({ status }: { status: SubmissionStatus | undefined }) {
  if (!status) return null;
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return null;
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

const MyAssignments = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useUser();

  const [sites, setSites] = useState<Site[]>([]);
  const [templateNames, setTemplateNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !organization?.id) return;

    const load = async () => {
      setLoading(true);
      try {
        const [assignments, templates] = await Promise.all([
          SiteAssignmentsService.getMemberAssignments(user.uid, organization.id),
          SiteTemplatesService.listTemplates(organization.id),
        ]);
        setSites(assignments);
        const nameMap: Record<string, string> = {};
        templates.forEach(t => { nameMap[t.id] = t.name; });
        setTemplateNames(nameMap);
      } catch (err) {
        console.error('Error loading assignments:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.uid, organization?.id]);

  const counts = {
    pending: sites.filter(s => s.submissionStatus === 'assigned').length,
    inProgress: sites.filter(s => s.submissionStatus === 'in_progress').length,
    submitted: sites.filter(s => s.submissionStatus === 'submitted' || s.submissionStatus === 'reviewed').length,
  };

  return (
    <ResponsiveLayout>
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-lg px-4 py-4 sm:px-6 lg:px-8 border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <PageHeader showLogo={false} />
          <AccountButton />
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Title */}
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">My Assignments</h1>
            <p className="text-sm text-muted-foreground">Sites assigned to you for form completion</p>
          </div>
        </div>

        {/* Summary counts */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold">{loading ? '—' : counts.pending}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-primary">{loading ? '—' : counts.inProgress}</p>
              <p className="text-xs text-muted-foreground mt-0.5">In Progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-green-600">{loading ? '—' : counts.submitted}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Submitted</p>
            </CardContent>
          </Card>
        </div>

        {/* Assignment cards */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : sites.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="font-medium text-muted-foreground">No assignments yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your organization admin will assign form tasks to you here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sites.map(site => {
              const templateName = site.linkedTemplateId
                ? (templateNames[site.linkedTemplateId] ?? 'Unknown template')
                : 'No template';

              const canFill =
                site.submissionStatus === 'assigned' || site.submissionStatus === 'in_progress';

              return (
                <Card
                  key={site.id}
                  className={`transition-colors ${canFill ? 'cursor-pointer hover:bg-muted/30' : 'opacity-75'}`}
                  onClick={() => canFill && navigate(`/form/${site.id}`)}
                >
                  <CardContent className="py-4 px-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm truncate">{site.name}</p>
                        <StatusBadge status={site.submissionStatus} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{templateName}</p>
                      {site.stateSiteNumber && (
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          {site.stateSiteNumber}
                        </p>
                      )}
                    </div>
                    {canFill && (
                      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ResponsiveLayout>
  );
};

export default MyAssignments;
