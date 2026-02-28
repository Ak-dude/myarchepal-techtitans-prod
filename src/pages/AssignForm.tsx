import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserCheck, ArrowLeft, AlertCircle, Loader2, Users, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import { PageHeader } from '@/components/PageHeader';
import { AccountButton } from '@/components/AccountButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { SitesService, type Site } from '@/services/sites';
import { SiteTemplatesService } from '@/services/siteTemplates';
import { SiteAssignmentsService } from '@/services/siteAssignments';
import { ConsultantPicker } from '@/components/templates/ConsultantPicker';
import { useUser } from '@/hooks/use-user';
import type { SiteTemplate } from '@/types/siteTemplates';

const AssignForm = () => {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const { organization } = useUser();

  const [site, setSite] = useState<Site | null>(null);
  const [template, setTemplate] = useState<SiteTemplate | null>(null);
  const [loadingSite, setLoadingSite] = useState(true);

  const [selectedUid, setSelectedUid] = useState('');
  const [selectedEmail, setSelectedEmail] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [saving, setSaving] = useState(false);
  const [unassigning, setUnassigning] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    setLoadingSite(true);
    SitesService.getSiteById(siteId)
      .then(async s => {
        setSite(s);
        if (s?.linkedTemplateId) {
          const tmpl = await SiteTemplatesService.getTemplate(s.linkedTemplateId);
          setTemplate(tmpl);
        }
        // Pre-fill existing assignment if any
        if (s?.assignedConsultantId) setSelectedUid(s.assignedConsultantId);
        if (s?.assignedConsultantEmail) setSelectedEmail(s.assignedConsultantEmail);
      })
      .catch(err => {
        console.error(err);
        toast.error('Failed to load site details');
      })
      .finally(() => setLoadingSite(false));
  }, [siteId]);

  const isReassign = !!site?.assignedConsultantId;

  const handleAssign = async () => {
    if (!siteId || !selectedUid || !selectedEmail) return;
    setSaving(true);
    try {
      await SiteAssignmentsService.assignConsultant(siteId, selectedUid, selectedEmail);
      toast.success(isReassign ? 'Site reassigned successfully.' : 'Site assigned successfully.');
      navigate('/admin-assignments');
    } catch (err) {
      console.error(err);
      toast.error('Failed to assign. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async () => {
    if (!siteId) return;
    setUnassigning(true);
    try {
      await SitesService.updateSite(siteId, {
        assignedConsultantId: undefined,
        assignedConsultantEmail: undefined,
        submissionStatus: undefined,
      });
      setSite(prev => prev ? { ...prev, assignedConsultantId: undefined, assignedConsultantEmail: undefined } : prev);
      setSelectedUid('');
      setSelectedEmail('');
      setSelectedName('');
      toast.success('Assignment cleared.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to clear assignment.');
    } finally {
      setUnassigning(false);
    }
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
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin-assignments')}
          className="gap-2 -ml-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Assignments
        </Button>

        {/* Title */}
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">
            {isReassign ? 'Reassign Site' : 'Assign Site'}
          </h1>
        </div>

        {loadingSite ? (
          <Card>
            <CardContent className="p-6 space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
        ) : !site ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Site not found.</AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Site info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Site Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Site Name</span>
                  <span className="font-medium">{site.name}</span>
                </div>
                {site.stateSiteNumber && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">State Site #</span>
                    <span className="font-mono">{site.stateSiteNumber}</span>
                  </div>
                )}
                {site.siteType && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Site Type</span>
                    <span>{site.siteType}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Linked Template</span>
                  <span className={template ? 'font-medium' : 'italic text-muted-foreground'}>
                    {template ? template.name : 'None'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assignment Status</span>
                  <Badge variant={site.assignedConsultantEmail ? 'default' : 'secondary'} className="text-xs">
                    {site.assignedConsultantEmail ? 'Assigned' : 'Unassigned'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* No template warning */}
            {!site.linkedTemplateId && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This site has no linked template. Please edit the site to link a form template before assigning it.
                </AlertDescription>
              </Alert>
            )}

            {/* Assignment card */}
            {site.linkedTemplateId && organization?.id && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserCheck className="w-4 h-4" />
                    {isReassign ? 'Reassign to a Team Member' : 'Assign to a Team Member'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">

                  {/* Current assignee banner */}
                  {site.assignedConsultantEmail && (
                    <>
                      <div className="flex items-center justify-between rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-3">
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                            Currently Assigned To
                          </p>
                          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                            {site.assignedConsultantEmail}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                          onClick={handleUnassign}
                          disabled={unassigning}
                        >
                          {unassigning
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <XCircle className="w-3.5 h-3.5" />
                          }
                          Clear
                        </Button>
                      </div>
                      <Separator />
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                        Select a different team member below to reassign:
                      </p>
                    </>
                  )}

                  {!site.assignedConsultantEmail && (
                    <p className="text-sm text-muted-foreground">
                      Choose any active team member — admins or field consultants — to fill out this form.
                    </p>
                  )}

                  <ConsultantPicker
                    orgId={organization.id}
                    value={selectedUid}
                    onSelect={(uid, email, name) => {
                      setSelectedUid(uid);
                      setSelectedEmail(email);
                      setSelectedName(name);
                    }}
                  />

                  <Button
                    className="w-full"
                    onClick={handleAssign}
                    disabled={!selectedUid || saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {isReassign ? 'Reassigning…' : 'Assigning…'}
                      </>
                    ) : isReassign ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reassign to {selectedName || 'Selected Member'}
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Assign to {selectedName || 'Selected Member'}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </ResponsiveLayout>
  );
};

export default AssignForm;
