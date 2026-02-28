import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useUser } from '@/hooks/use-user';
import { UserService } from '@/services/users';
import { OrganizationService } from '@/services/organizations';
import { InvitationService } from '@/services/invitations';
import { User, Organization, Invitation, UserRole } from '@/types/organization';
import {
  Building2,
  Users,
  Mail,
  UserPlus,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  Copy,
  RefreshCw,
  Trash2,
  Shield,
  UserCheck,
  ClipboardList,
  ChevronRight,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SitesService } from '@/services/sites';
import type { Site } from '@/services/sites';

const OrgAdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, organization: userOrg, isOrgAdmin, isSuperAdmin, loading: userLoading } = useUser();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'MEMBER' as UserRole,
  });

  const [assignmentSites, setAssignmentSites] = useState<Site[]>([]);

  // Load organization data
  useEffect(() => {
    const loadData = async () => {
      if (!user || userLoading) return;

      // Check if user has admin permissions
      if (!isOrgAdmin && !isSuperAdmin) {
        navigate('/');
        return;
      }

      setLoading(true);
      try {
        // Load organization details
        if (user.organizationId) {
          const org = await OrganizationService.getById(user.organizationId);
          setOrganization(org);

          // Load organization members
          const orgMembers = await UserService.getByOrganization(user.organizationId);
          setMembers(orgMembers);

          // Load pending invitations
          const pendingInvites = await InvitationService.getPendingByOrganization(user.organizationId);
          setInvitations(pendingInvites);
        }
      } catch (error) {
        console.error('Error loading organization data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load organization data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, userLoading, isOrgAdmin, isSuperAdmin, navigate, toast]);

  // Load assignment stats for the Assignments tab
  useEffect(() => {
    if (!user?.organizationId) return;
    SitesService.getSitesByOrganization(user.organizationId)
      .then(setAssignmentSites)
      .catch(console.error);
  }, [user?.organizationId]);

  const handleInviteUser = async () => {
    if (!user || !organization) return;

    if (!inviteForm.email) {
      toast({
        title: 'Email Required',
        description: 'Please enter an email address',
        variant: 'destructive',
      });
      return;
    }

    setInviteLoading(true);
    try {
      const invitation = await InvitationService.create({
        email: inviteForm.email,
        organizationId: organization.id,
        invitedBy: user.uid,
        role: inviteForm.role,
        baseUrl: window.location.origin,
      });

      setInvitations([...invitations, invitation]);
      setInviteDialogOpen(false);
      setInviteForm({ email: '', role: 'MEMBER' });

      toast({
        title: 'Invitation Sent',
        description: `Invitation sent to ${inviteForm.email}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invitation',
        variant: 'destructive',
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleResendInvitation = async (invitation: Invitation) => {
    try {
      await InvitationService.resend(invitation.id);
      toast({
        title: 'Invitation Resent',
        description: `New invitation sent to ${invitation.email}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to resend invitation',
        variant: 'destructive',
      });
    }
  };

  const handleCancelInvitation = async (invitation: Invitation) => {
    try {
      await InvitationService.cancel(invitation.id);
      setInvitations(invitations.filter(i => i.id !== invitation.id));
      toast({
        title: 'Invitation Cancelled',
        description: `Invitation to ${invitation.email} has been cancelled`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel invitation',
        variant: 'destructive',
      });
    }
  };

  const handleCopyInviteLink = (invitation: Invitation) => {
    // Use stored inviteLink if available, otherwise generate it
    const inviteLink = invitation.inviteLink || `${window.location.origin}/#/accept-invite?token=${invitation.token}`;
    navigator.clipboard.writeText(inviteLink);
    console.log('📋 Copied invite link:', inviteLink);
    console.log('🔑 Token:', invitation.token);
    toast({
      title: 'Link Copied',
      description: 'Invitation link copied to clipboard',
    });
  };

  const handleUpdateUserRole = async (targetUser: User, newRole: UserRole) => {
    // Prevent demoting yourself or other admins if you're the only admin
    if (targetUser.uid === user?.uid && newRole !== 'ORG_ADMIN' && newRole !== 'SUPER_ADMIN') {
      const admins = members.filter(m => m.role === 'ORG_ADMIN' || m.role === 'SUPER_ADMIN');
      if (admins.length === 1) {
        toast({
          title: 'Cannot Change Role',
          description: 'You are the only admin. Promote someone else first.',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      await UserService.updateRole(targetUser.uid, newRole);
      setMembers(members.map(m =>
        m.uid === targetUser.uid ? { ...m, role: newRole } : m
      ));
      toast({
        title: 'Role Updated',
        description: `${targetUser.displayName || targetUser.email}'s role updated to ${newRole}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update role',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete || !organization) return;

    // Prevent deleting yourself
    if (memberToDelete.uid === user?.uid) {
      toast({
        title: 'Error',
        description: 'You cannot remove yourself from the organization',
        variant: 'destructive',
      });
      return;
    }

    // Prevent deleting Super Admins
    if (memberToDelete.role === 'SUPER_ADMIN') {
      toast({
        title: 'Error',
        description: 'Super Admins cannot be removed',
        variant: 'destructive',
      });
      return;
    }

    setDeleteLoading(true);
    try {
      const { doc, setDoc, deleteDoc, Timestamp } = await import('firebase/firestore');
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const { db } = await import('@/lib/firebase');
      const firebaseApp = (await import('@/lib/firebase')).default;

      if (!db) throw new Error('Database not initialized');

      // Create inactive user record with deletion metadata
      const inactiveUserData = {
        ...memberToDelete,
        deletedAt: Timestamp.now(),
        deletedBy: user?.uid,
        deletedFromOrganization: organization.id,
        originalStatus: memberToDelete.status,
        status: 'INACTIVE',
      };

      // Move to users_inactive collection
      const inactiveUserDoc = doc(db, 'users_inactive', memberToDelete.uid);
      await setDoc(inactiveUserDoc, inactiveUserData);

      // Delete from users collection
      const userDoc = doc(db, 'users', memberToDelete.uid);
      await deleteDoc(userDoc);

      // Also delete from user_roles collection
      const userRoleDoc = doc(db, 'user_roles', `${memberToDelete.uid}_${organization.id}`);
      await deleteDoc(userRoleDoc);

      // Delete from Firebase Authentication using Cloud Function
      try {
        if (firebaseApp) {
          const functions = getFunctions(firebaseApp);
          const deleteUserFromAuth = httpsCallable(functions, 'deleteUserFromAuth');
          await deleteUserFromAuth({
            userId: memberToDelete.uid,
            organizationId: organization.id,
          });
          console.log('✅ User deleted from Firebase Authentication');
        }
      } catch (authError: any) {
        // Log the error but don't fail the whole operation
        // The user is already removed from Firestore
        console.warn('Warning: Could not delete user from Authentication:', authError.message);
        // If Cloud Function is not deployed yet, this will fail silently
      }

      // Update local state
      setMembers(members.filter(m => m.uid !== memberToDelete.uid));

      toast({
        title: 'Member Removed',
        description: `${memberToDelete.displayName || memberToDelete.email} has been removed from the organization`,
      });

      setDeleteDialogOpen(false);
      setMemberToDelete(null);
    } catch (error: any) {
      console.error('Error removing member:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove member',
        variant: 'destructive',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const openDeleteDialog = (member: User) => {
    setMemberToDelete(member);
    setDeleteDialogOpen(true);
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'destructive';
      case 'ORG_ADMIN':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  if (loading || userLoading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <PageHeader title="Organization Dashboard" showBackButton />
      <div className="container max-w-6xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6" />
              {organization?.name || 'Organization'}
            </h1>
            <p className="text-muted-foreground">
              Manage your organization members and invitations
            </p>
          </div>
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite New Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to join {organization?.name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={inviteForm.role}
                    onValueChange={(value) => setInviteForm({ ...inviteForm, role: value as UserRole })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">Member</SelectItem>
                      <SelectItem value="ORG_ADMIN">Organization Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInviteUser} disabled={inviteLoading}>
                  {inviteLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Organization Info Card */}
        {organization && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{organization.name}</CardTitle>
              <CardDescription>
                {organization.type === 'SUBSCRIBED' ? 'Subscribed Organization' : organization.type}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <Users className="w-5 h-5 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold">{members.length}</p>
                  <p className="text-sm text-muted-foreground">Members</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <Mail className="w-5 h-5 mx-auto mb-2 text-orange-500" />
                  <p className="text-2xl font-bold">{invitations.length}</p>
                  <p className="text-sm text-muted-foreground">Pending Invites</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <Shield className="w-5 h-5 mx-auto mb-2 text-blue-500" />
                  <p className="text-2xl font-bold">
                    {members.filter(m => m.role === 'ORG_ADMIN' || m.role === 'SUPER_ADMIN').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Admins</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <CheckCircle className="w-5 h-5 mx-auto mb-2 text-green-500" />
                  <p className="text-2xl font-bold">
                    {members.filter(m => m.status === 'ACTIVE').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs: Members / Site Assignments */}
        <Tabs defaultValue="members">
          <TabsList className="mb-2">
            <TabsTrigger value="members">
              <Users className="w-4 h-4 mr-2" />
              Members
            </TabsTrigger>
            <TabsTrigger value="assignments">
              <ClipboardList className="w-4 h-4 mr-2" />
              Site Assignments
            </TabsTrigger>
          </TabsList>

          {/* ── Members tab ── */}
          <TabsContent value="members" className="space-y-6">

        {/* Members Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Organization Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.displayName || 'No name'}
                      {member.uid === user?.uid && (
                        <Badge variant="outline" className="ml-2">You</Badge>
                      )}
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(member.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Only show role change for non-super admins and if current user is admin */}
                        {member.role !== 'SUPER_ADMIN' && (isOrgAdmin || isSuperAdmin) && (
                          <Select
                            value={member.role}
                            onValueChange={(value) => handleUpdateUserRole(member, value as UserRole)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MEMBER">Member</SelectItem>
                              <SelectItem value="ORG_ADMIN">Org Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {/* Delete button - don't show for yourself or super admins */}
                        {member.uid !== user?.uid && member.role !== 'SUPER_ADMIN' && (isOrgAdmin || isSuperAdmin) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(member)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Remove member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {members.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No members found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Delete Member Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove Member</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove {memberToDelete?.displayName || memberToDelete?.email} from the organization?
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                This action will:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
                <li>Remove the user from this organization</li>
                <li>Revoke their access to organization resources</li>
                <li>Delete their authentication account</li>
                <li>Move their profile data to inactive status</li>
              </ul>
              <p className="text-sm text-destructive mt-4 font-medium">
                Warning: The user will need to create a new account to access the system again.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setMemberToDelete(null);
                }}
                disabled={deleteLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteMember}
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove Member
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Pending Invitations Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Pending Invitations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(invitation.role)}>
                        {invitation.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(invitation.createdAt)}</TableCell>
                    <TableCell>{formatDate(invitation.expiresAt)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyInviteLink(invitation)}
                        title="Copy invite link"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResendInvitation(invitation)}
                        title="Resend invitation"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelInvitation(invitation)}
                        title="Cancel invitation"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {invitations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No pending invitations
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

          </TabsContent>{/* end members tab */}

          {/* ── Assignments tab ── */}
          <TabsContent value="assignments" className="space-y-6">
            {/* Assignment stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="text-center p-4">
                  <p className="text-2xl font-bold">{assignmentSites.length}</p>
                  <p className="text-sm text-muted-foreground">Total Sites</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-center p-4">
                  <p className="text-2xl font-bold text-amber-600">
                    {assignmentSites.filter(s => !s.assignedConsultantId).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Unassigned</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-center p-4">
                  <p className="text-2xl font-bold text-blue-600">
                    {assignmentSites.filter(s => s.submissionStatus === 'in_progress').length}
                  </p>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-center p-4">
                  <p className="text-2xl font-bold text-green-600">
                    {assignmentSites.filter(s =>
                      s.submissionStatus === 'submitted' || s.submissionStatus === 'reviewed'
                    ).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Submitted</p>
                </CardContent>
              </Card>
            </div>

            <Button
              className="w-full sm:w-auto"
              variant="outline"
              onClick={() => navigate('/admin-assignments')}
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              Manage All Site Assignments
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </TabsContent>

        </Tabs>{/* end tabs */}

      </div>
    </ResponsiveLayout>
  );
};

export default OrgAdminDashboard;
