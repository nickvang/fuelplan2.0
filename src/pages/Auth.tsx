import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import supplmeLogo from '@/assets/supplme-logo.png';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/admin');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate('/admin');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Verify if user has admin role immediately after login
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (roleError) {
          console.error("Role check error:", roleError);
        }

        if (!roleData) {
          toast({
            title: "Access Restricted",
            description: "You are logged in but don't have admin permissions. Please contact an administrator.",
            variant: "destructive",
          });
          // Not throwing error here, user is authenticated, just not authorized for admin
          navigate('/');
          return;
        }

        toast({
          title: "Login Successful",
          description: "Welcome back to the Admin Dashboard.",
        });
        navigate('/admin');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: {
              full_name: email.split('@')[0], // Default name from email
            }
          },
        });

        if (error) throw error;

        toast({
          title: "Account Created",
          description: "Please check your email to verify your account before logging in.",
        });
        setIsLogin(true);
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast({
        title: "Authentication Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center">
          <img src={supplmeLogo} alt="Supplme" className="h-32 mx-auto mb-2" />
          <h1 className="text-2xl font-bold">Admin Access</h1>
          <p className="text-muted-foreground text-sm">
            {isLogin ? 'Sign in to access admin dashboard' : 'Create admin account'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@supplme.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              minLength={6}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              isLogin ? 'Sign In' : 'Sign Up'
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setIsLogin(!isLogin)}
            disabled={loading}
          >
            {isLogin ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </Button>
        </form>

        <div className="text-center">
          <Button
            variant="link"
            onClick={() => navigate('/')}
            className="text-sm"
          >
            ← Back to Hydration Guide
          </Button>
        </div>
      </Card>
    </div>
  );
}