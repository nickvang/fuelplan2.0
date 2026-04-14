import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import supplmeLogo from '@/assets/supplme-logo-sort.svg';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [gdprConsent, setGdprConsent] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const returnTo = searchParams.get('returnTo') || '/';

  useEffect(() => {
    if (user) {
      navigate(returnTo, { replace: true });
    }
  }, [user, navigate, returnTo]);

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        if (!gdprConsent) {
          toast({
            title: t('auth.consentRequired'),
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login${searchParams.toString() ? '?' + searchParams.toString() : ''}`,
            data: { full_name: email.split('@')[0] },
          },
        });
        if (error) throw error;

        toast({
          title: t('auth.magicLinkSent'),
          description: 'Please verify your email before signing in.',
        });
        setIsLogin(true);
        setLoading(false);
        return;
      }
    } catch (error: unknown) {
      toast({
        title: error instanceof Error ? error.message : 'Authentication error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/login${searchParams.toString() ? '?' + searchParams.toString() : ''}`,
        },
      });
      if (error) throw error;

      toast({ title: t('auth.magicLinkSent') });
    } catch (error: unknown) {
      toast({
        title: error instanceof Error ? error.message : 'Authentication error',
        variant: 'destructive',
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
          <h1 className="text-2xl font-bold">{t('auth.loginTitle')}</h1>
          <p className="text-muted-foreground text-sm">{t('auth.loginSubtitle')}</p>
        </div>

        <Tabs defaultValue="email-password" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email-password">{t('auth.emailPassword')}</TabsTrigger>
            <TabsTrigger value="magic-link">{t('auth.magicLink')}</TabsTrigger>
          </TabsList>

          <TabsContent value="email-password">
            <form onSubmit={handleEmailPassword} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.password')}</Label>
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

              {!isLogin && (
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="gdpr-consent"
                    checked={gdprConsent}
                    onCheckedChange={(checked) => setGdprConsent(checked === true)}
                    disabled={loading}
                  />
                  <Label htmlFor="gdpr-consent" className="text-xs leading-tight cursor-pointer">
                    {t('auth.gdprConsent')}{' '}
                    <a href="/privacy" className="underline" target="_blank">Privacy Policy</a>
                  </Label>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />...</>
                ) : (
                  isLogin ? t('auth.signIn') : t('auth.signUp')
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setIsLogin(!isLogin)}
                disabled={loading}
              >
                {isLogin ? t('auth.needAccount') : t('auth.alreadyHaveAccount')}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="magic-link">
            <form onSubmit={handleMagicLink} className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">{t('auth.magicLinkDescription')}</p>
              <div className="space-y-2">
                <Label htmlFor="magic-email">{t('auth.email')}</Label>
                <Input
                  id="magic-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />...</>
                ) : (
                  t('auth.sendMagicLink')
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="text-center space-y-2">
          <Button variant="link" onClick={() => navigate('/')} className="text-sm">
            &larr; {t('auth.backToApp')}
          </Button>
          <div className="text-xs text-muted-foreground">
            <a href="/terms" className="underline">Terms</a>
            {' · '}
            <a href="/privacy" className="underline">Privacy</a>
          </div>
        </div>
      </Card>
    </div>
  );
}
