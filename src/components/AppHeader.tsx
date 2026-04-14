import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

export function AppHeader() {
  const { user } = useAuth();
  const { t } = useLanguage();

  // Derive avatar letter from name or email
  const displayName =
    user?.user_metadata?.full_name ||
    user?.email ||
    '';
  const avatarLetter = displayName.charAt(0).toUpperCase() || '?';

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 h-14 flex items-center justify-between px-4">
      <Link to="/" className="shrink-0">
        <span className="text-[15px] font-bold tracking-[0.2em] text-[#050505] uppercase">SUPPLME</span>
      </Link>

      {user ? (
        <Link
          to="/account"
          className="w-8 h-8 rounded-full bg-[#0a0a0a] text-white flex items-center justify-center text-sm font-bold shrink-0"
        >
          {avatarLetter}
        </Link>
      ) : (
        <Link
          to="/login"
          className="text-[13px] text-gray-400 hover:text-[#0a0a0a] transition-colors"
        >
          {t('auth.signIn')}
        </Link>
      )}
    </header>
  );
}
