import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, Sparkles, LogOut, Calendar, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/authContext';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation: Escape key closes menus and restores focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (profileOpen) {
          setProfileOpen(false);
          document.getElementById('profile-menu-button')?.focus();
        } else if (mobileOpen) {
          setMobileOpen(false);
          document.getElementById('mobile-menu-toggle')?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [profileOpen, mobileOpen]);

  const handleMobileLinkClick = () => {
    setMobileOpen(false);
    setProfileOpen(false);
  };

  const handleLogout = async () => {
    setProfileOpen(false);
    setMobileOpen(false);
    await logout();
    navigate('/login');
  };

  const navLinks = [
    { label: 'Home', to: '/' },
    ...(isAuthenticated ? [{ label: 'My Celebrations', to: '/events' }] : []),
    { label: 'Plan Celebration', to: '/create' },
  ];

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <header
      role="banner"
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-ivory-200'
          : 'bg-transparent'
      )}
    >
      <nav
        aria-label="Main navigation"
        className="section-container flex items-center justify-between h-16"
      >
        {/* ── Logo ──────────────────────────────────────────────────────── */}
        <Link
          to="/"
          className="flex items-center gap-2 group"
          aria-label="Celebration Planner home"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-plum flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
            <Sparkles size={16} className="text-gold-300" />
          </div>
          <span className="font-display font-semibold text-lg text-plum hidden sm:block">
            Celebration<span className="text-gold">Planner</span>
          </span>
        </Link>

        {/* ── Desktop nav ───────────────────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                cn(
                  'text-sm font-medium transition-colors duration-200 relative',
                  'after:absolute after:bottom-[-2px] after:left-0 after:w-full after:h-0.5 after:bg-gold after:scale-x-0 after:transition-transform after:duration-200',
                  'hover:text-plum hover:after:scale-x-100',
                  isActive ? 'text-plum after:scale-x-100' : 'text-charcoal-light'
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        {/* ── Right Action Controls ─────────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <div className="relative" ref={profileRef}>
              <button
                id="profile-menu-button"
                aria-label="User profile menu"
                aria-haspopup="true"
                aria-expanded={profileOpen}
                aria-controls="profile-dropdown-menu"
                onClick={() => setProfileOpen((prev) => !prev)}
                className="flex items-center gap-2 p-1.5 pl-3 pr-2.5 rounded-full border border-ivory-300 hover:border-gold/50 bg-white/80 hover:bg-white shadow-sm transition-all text-sm font-medium text-plum"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-plum text-gold-200 flex items-center justify-center font-bold text-xs shadow-inner">
                  {userInitial}
                </div>
                <span className="max-w-[120px] truncate">{user?.name}</span>
                <ChevronDown size={14} className={cn('text-charcoal-light transition-transform duration-200', profileOpen && 'rotate-180')} />
              </button>

              {/* Profile Dropdown */}
              {profileOpen && (
                <div
                  id="profile-dropdown-menu"
                  role="menu"
                  className="absolute right-0 mt-2 w-64 rounded-2xl bg-white shadow-xl border border-ivory-200 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  <div className="px-3 py-2.5 bg-ivory-50 rounded-xl mb-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-light">Signed in as</p>
                    <p className="text-sm font-bold text-plum truncate">{user?.name}</p>
                    <p className="text-xs text-charcoal-light truncate mt-0.5">{user?.email}</p>
                  </div>

                  <Link
                    to="/events"
                    role="menuitem"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-charcoal-light hover:text-plum hover:bg-ivory-100 rounded-lg transition-colors"
                  >
                    <Calendar size={16} />
                    My Celebrations
                  </Link>

                  <Link
                    to="/create"
                    role="menuitem"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-charcoal-light hover:text-plum hover:bg-ivory-100 rounded-lg transition-colors"
                  >
                    <Sparkles size={16} />
                    Plan New Event
                  </Link>

                  <div className="my-1 border-t border-ivory-200" />

                  <button
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-crimson hover:bg-crimson-50 rounded-lg transition-colors text-left font-medium"
                    id="profile-logout-btn"
                  >
                    <LogOut size={16} />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/login')}
                id="nav-login-btn"
              >
                Log In
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/register')}
                leftIcon={<Sparkles size={14} />}
                id="nav-signup-btn"
              >
                Sign Up
              </Button>
            </div>
          )}
        </div>

        {/* ── Mobile hamburger ─────────────────────────────────────────── */}
        <button
          id="mobile-menu-toggle"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden p-2 rounded-lg hover:bg-ivory-200 transition-colors text-charcoal"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* ── Mobile menu ───────────────────────────────────────────────── */}
      <div
        id="mobile-menu"
        role="navigation"
        aria-label="Mobile navigation"
        aria-hidden={!mobileOpen}
        hidden={!mobileOpen}
        className={cn(
          'md:hidden bg-white/95 backdrop-blur-md border-t border-ivory-200 overflow-hidden transition-all duration-300',
          mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="section-container py-4 flex flex-col gap-3">
          {isAuthenticated && (
            <div className="p-3 bg-ivory-100 rounded-xl mb-1 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-plum text-gold-200 flex items-center justify-center font-bold text-sm shadow-sm">
                {userInitial}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-plum truncate">{user?.name}</p>
                <p className="text-xs text-charcoal-light truncate">{user?.email}</p>
              </div>
            </div>
          )}

          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              onClick={handleMobileLinkClick}
              className={({ isActive }) =>
                cn(
                  'text-sm font-medium py-2 px-3 rounded-lg transition-colors',
                  isActive
                    ? 'bg-plum-50 text-plum'
                    : 'text-charcoal-light hover:bg-ivory-200'
                )
              }
            >
              {link.label}
            </NavLink>
          ))}

          {isAuthenticated ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              leftIcon={<LogOut size={14} />}
              className="text-crimson border-crimson-200 hover:bg-crimson-50 justify-start"
            >
              Log Out
            </Button>
          ) : (
            <div className="flex flex-col gap-2 pt-2 border-t border-ivory-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMobileOpen(false);
                  navigate('/login');
                }}
              >
                Log In
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setMobileOpen(false);
                  navigate('/register');
                }}
                leftIcon={<Sparkles size={14} />}
              >
                Sign Up
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
