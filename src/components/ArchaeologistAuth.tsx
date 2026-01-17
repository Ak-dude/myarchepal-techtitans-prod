import React, { useState, useRef, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { UserService } from '@/services/users';
import { UserRoleService } from '@/services/userRoles';
import { DEFAULT_ORGANIZATION_ID, ROLE_IDS } from '@/types/organization';
import { Loader2, Mail, Lock, GraduationCap, CheckCircle, User, Eye, EyeOff } from 'lucide-react';
import { useKeyboard } from '@/hooks/use-keyboard';

interface ArchaeologistAuthProps {
  onAuthSuccess?: () => void;
  defaultMode?: 'signin' | 'signup';
}

export const ArchaeologistAuth: React.FC<ArchaeologistAuthProps> = ({
  onAuthSuccess,
  defaultMode = 'signin'
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(defaultMode === 'signup');
  const [loading, setLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const { toast } = useToast();
  const { hideKeyboard } = useKeyboard();
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle tap outside inputs to dismiss keyboard
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTap = (e: TouchEvent | MouseEvent) => {
      const target = e.target as HTMLElement;
      const interactiveElements = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'LABEL'];
      if (interactiveElements.includes(target.tagName)) return;
      if (target.closest('button') || target.closest('a') || target.closest('label')) return;
      hideKeyboard();
    };

    container.addEventListener('touchstart', handleTap, { passive: true });
    return () => container.removeEventListener('touchstart', handleTap);
  }, [hideKeyboard]);

  // Signup-specific fields
  const [signupData, setSignupData] = useState({
    firstName: '',
    lastName: '',
    institution: '',
    specialization: '',
    credentials: ''
  });

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      toast({
        title: "Error",
        description: "Firebase authentication is not initialized",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // Get user profile from users collection
      const userProfile = await UserService.getByUid(userCredential.user.uid);
      const userName = userProfile?.displayName || userCredential.user.displayName || userCredential.user.email?.split('@')[0] || "";

      // Get user's role from user_roles collection
      const userRoles = await UserRoleService.getByUserId(userCredential.user.uid);
      const highestRole = await UserRoleService.getHighestRole(userCredential.user.uid);

      console.log("User signed in:", userCredential.user);
      console.log("User roles:", userRoles);
      console.log("Highest role:", highestRole);

      toast({
        title: userName ? `Welcome back, ${userName}!` : "Welcome back!",
        description: "Successfully signed in",
      });
      onAuthSuccess?.();
    } catch (error: any) {
      console.error("Error signing in:", error.message);
      toast({
        title: "Sign In Failed",
        description: error.message || "Invalid email or password",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      toast({
        title: "Error",
        description: "Firebase authentication is not initialized",
        variant: "destructive"
      });
      return;
    }

    // Basic validation
    if (!signupData.firstName || !signupData.lastName || !signupData.institution || !signupData.specialization) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // Password confirmation validation
    if (password !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure your passwords match",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Combine first and last name
      const displayName = `${signupData.firstName} ${signupData.lastName}`.trim();

      // Create user in users collection (multi-tenant system)
      await UserService.create({
        uid: userCredential.user.uid,
        email: userCredential.user.email || '',
        displayName,
        organizationId: DEFAULT_ORGANIZATION_ID, // Default org until invited to specific org
        role: 'MEMBER',
        institution: signupData.institution,
        specialization: signupData.specialization,
        credentials: signupData.credentials,
      });

      // Create user_roles entry for the user
      await UserRoleService.create({
        userId: userCredential.user.uid,
        roleId: ROLE_IDS.MEMBER,
        organizationId: DEFAULT_ORGANIZATION_ID,
      });

      console.log("Account created:", userCredential.user);
      console.log("User role assigned: MEMBER in DEFAULT organization");

      toast({
        title: `Welcome to ArchePal, ${displayName}!`,
        description: "Your account has been created successfully",
      });
      onAuthSuccess?.();
    } catch (error: any) {
      console.error("Error creating account:", error.message);
      toast({
        title: "Sign Up Failed",
        description: error.message || "Failed to create account",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address first",
        variant: "destructive"
      });
      return;
    }

    if (!auth) {
      toast({
        title: "Error",
        description: "Firebase authentication is not initialized",
        variant: "destructive"
      });
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setResetEmailSent(true);
      toast({
        title: "Password Reset Email Sent",
        description: "Check your email for password reset instructions",
      });
    } catch (error: any) {
      toast({
        title: "Password Reset Failed",
        description: error.message || "Failed to send reset email",
        variant: "destructive"
      });
    }
  };

  const handleSignupInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSignupData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div ref={containerRef}>
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <GraduationCap className="w-5 h-5" />
          {isSigningUp ? 'Register as Archaeologist' : 'Archaeologist Sign In'}
        </CardTitle>
        <CardDescription>
          {isSigningUp
            ? 'Create your verified archaeologist account'
            : 'Access your archaeologist dashboard'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={isSigningUp ? handleSignUp : handleSignIn} className="space-y-4">

          {isSigningUp && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="firstName"
                    name="firstName"
                    value={signupData.firstName}
                    onChange={handleSignupInputChange}
                    placeholder="First name"
                    className="pl-10"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="lastName"
                    name="lastName"
                    value={signupData.lastName}
                    onChange={handleSignupInputChange}
                    placeholder="Last name"
                    className="pl-10"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="pl-10"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSigningUp ? "Password (min. 6 characters)" : "Enter your password"}
                className="pl-10 pr-10"
                minLength={isSigningUp ? 6 : undefined}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {isSigningUp && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="pl-10 pr-10"
                  minLength={6}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={loading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {isSigningUp && (
            <>
              <div className="space-y-2">
                <Label htmlFor="institution">Institution/Organization *</Label>
                <Input
                  id="institution"
                  name="institution"
                  value={signupData.institution}
                  onChange={handleSignupInputChange}
                  placeholder="e.g., University of Archaeology"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialization">Specialization *</Label>
                <Input
                  id="specialization"
                  name="specialization"
                  value={signupData.specialization}
                  onChange={handleSignupInputChange}
                  placeholder="e.g., Ancient Roman History"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="credentials">Credentials/Qualifications</Label>
                <Textarea
                  id="credentials"
                  name="credentials"
                  value={signupData.credentials}
                  onChange={handleSignupInputChange}
                  placeholder="e.g., PhD in Archaeology, Published researcher..."
                  rows={3}
                  disabled={loading}
                />
              </div>
            </>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isSigningUp ? 'Creating Account...' : 'Signing In...'}
              </>
            ) : (
              <>
                {isSigningUp ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Create Archaeologist Account
                  </>
                ) : (
                  <>
                    <GraduationCap className="w-4 h-4 mr-2" />
                    Sign In as Archaeologist
                  </>
                )}
              </>
            )}
          </Button>
        </form>

        {!isSigningUp && (
          <div className="text-center">
            <Button
              variant="link"
              onClick={handlePasswordReset}
              className="text-sm"
              disabled={loading || resetEmailSent}
            >
              {resetEmailSent ? 'Reset email sent!' : 'Forgot password?'}
            </Button>
          </div>
        )}

        <div className="text-center">
          <Button
            variant="link"
            onClick={() => setIsSigningUp(!isSigningUp)}
            className="text-sm"
            disabled={loading}
          >
            {isSigningUp
              ? "Already have an archaeologist account? Sign In"
              : "Need an archaeologist account? Register"
            }
          </Button>
        </div>

        <div className="text-xs text-center text-muted-foreground">
          <p>🏛️ Professional archaeologist accounts only</p>
          <p>Public users can browse without signing up</p>
        </div>
      </CardContent>
    </Card>
    </div>
  );
};

export default ArchaeologistAuth;