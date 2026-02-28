import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, UserCheck, Search, Filter } from 'lucide-react';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import { PageHeader } from '@/components/PageHeader';
import { AccountButton } from '@/components/AccountButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { SitesService, type Site } from '@/services/sites';
import { useUser } from '@/hooks/use-user';
import type { SubmissionStatus } from '@/types/siteSubmissions';

const STATUS_LABELS: Record<string, string> = {
  assigned: 'Assigned',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  reviewed: 'Reviewed',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  assigned: 'secondary',
  in_progress: 'default',
  submitted: 'outline',
  reviewed: 'secondary',
};

function statusBadge(status: SubmissionStatus | undefined) {
  if (!status) return <Badge variant="outline" className="text-muted-foreground">Unassigned</Badge>;
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? 'outline'}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

const AdminSiteAssignments = () => {
  const navigate = useNavigate();
  const { organization } = useUser();

  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (!organization?.id) return;
    setLoading(true);
    SitesService.getSitesByOrganization(organization.id)
      .then(setSites)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [organization?.id]);

  const filtered = sites.filter(site => {
    const matchesSearch =
      !search ||
      site.name.toLowerCase().includes(search.toLowerCase()) ||
      (site.stateSiteNumber ?? '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'unassigned'
        ? !site.submissionStatus
        : site.submissionStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const counts = {
    all: sites.length,
    unassigned: sites.filter(s => !s.submissionStatus).length,
    assigned: sites.filter(s => s.submissionStatus === 'assigned').length,
    in_progress: sites.filter(s => s.submissionStatus === 'in_progress').length,
    submitted: sites.filter(s => s.submissionStatus === 'submitted').length,
    reviewed: sites.filter(s => s.submissionStatus === 'reviewed').length,
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

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Title */}
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Site Assignments</h1>
            <p className="text-sm text-muted-foreground">
              Manage form assignments for sites in your organization
            </p>
          </div>
        </div>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: `All (${counts.all})` },
            { key: 'unassigned', label: `Unassigned (${counts.unassigned})` },
            { key: 'assigned', label: `Assigned (${counts.assigned})` },
            { key: 'in_progress', label: `In Progress (${counts.in_progress})` },
            { key: 'submitted', label: `Submitted (${counts.submitted})` },
            { key: 'reviewed', label: `Reviewed (${counts.reviewed})` },
          ].map(({ key, label }) => (
            <Badge
              key={key}
              variant={statusFilter === key ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() => setStatusFilter(key)}
            >
              {label}
            </Badge>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by site name or state number..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table / Cards */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {loading ? 'Loading sites...' : `${filtered.length} site${filtered.length !== 1 ? 's' : ''}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No sites match your filters.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {/* Desktop header */}
                <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <span>Site</span>
                  <span>Type</span>
                  <span>Consultant</span>
                  <span>Status</span>
                  <span />
                </div>

                {filtered.map(site => (
                  <div
                    key={site.id}
                    className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 md:gap-4 px-4 py-3 items-center hover:bg-muted/30 transition-colors"
                  >
                    {/* Name + State # */}
                    <div>
                      <p className="font-medium text-sm">{site.name}</p>
                      {site.stateSiteNumber && (
                        <p className="text-xs text-muted-foreground font-mono">{site.stateSiteNumber}</p>
                      )}
                    </div>

                    {/* Type */}
                    <div className="text-sm text-muted-foreground">
                      {site.siteType ?? <span className="italic text-xs">—</span>}
                    </div>

                    {/* Assigned consultant */}
                    <div className="text-sm text-muted-foreground truncate">
                      {site.assignedConsultantEmail
                        ? <span title={site.assignedConsultantEmail}>{site.assignedConsultantEmail}</span>
                        : <span className="italic text-xs">None</span>}
                    </div>

                    {/* Status badge */}
                    <div>{statusBadge(site.submissionStatus)}</div>

                    {/* Action */}
                    <div>
                      <Button
                        size="sm"
                        variant={site.linkedTemplateId ? 'default' : 'outline'}
                        onClick={() => navigate(`/assign-form/${site.id}`)}
                        disabled={!site.linkedTemplateId}
                        title={!site.linkedTemplateId ? 'Link a template to this site first' : 'Assign form to consultant'}
                      >
                        {site.assignedConsultantId ? 'Reassign' : 'Assign'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  );
};

export default AdminSiteAssignments;
