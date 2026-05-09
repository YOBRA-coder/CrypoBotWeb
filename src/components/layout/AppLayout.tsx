import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wallet, Zap, Gamepad2, TrendingUp, Users, User, LogOut, Bell, Shield, UserCheck, Scale, Trophy } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useNotifications } from '@/hooks/useApi';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const sidebarNav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/wallet', icon: Wallet, label: 'Wallet' },
  { to: '/bills', icon: Zap, label: 'Bills' },
  { to: '/games', icon: Gamepad2, label: 'Games' },
  { to: '/sports', icon: Trophy, label: 'Sports' },
  { to: '/invest', icon: TrendingUp, label: 'Invest' },
  { to: '/referrals', icon: Users, label: 'Referrals' },
  { to: '/profile', icon: User, label: 'Profile' },
];

const bottomNav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/wallet', icon: Wallet, label: 'Wallet' },
  { to: '/bills', icon: Zap, label: 'Bills' },
  { to: '/games', icon: Gamepad2, label: 'Games' },
  { to: '/sports', icon: Trophy, label: 'Sports' },
  { to: '/invest', icon: TrendingUp, label: 'Invest' },
  { to: '/referrals', icon: Users, label: 'Referrals' },
  { to: '/profile', icon: User, label: 'Profile' },
];


function SidebarLink({ to, icon: Icon, label, exact }: any) {
  return (
    <NavLink
      to={to}
      end={exact}
      title={label}
      className={({ isActive }) =>
        clsx('w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 relative group cursor-pointer',
          isActive ? 'bg-green/10 text-green' : 'text-subtle hover:text-muted hover:bg-white/5'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-green rounded-r" />}
          <Icon size={18} />
          <span className="absolute left-14 bg-card border border-border text-white text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: notifData } = useNotifications();
  const unread = notifData?.unread || 0;

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    logout();
    navigate('/auth/login');
    toast.success('Logged out');
  };

  // Don't show bottom nav on game pages (needs full screen)
  const isGamePage = location.pathname.startsWith('/games/');

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* ── Desktop Sidebar ──────────────────────── */}
      <aside className="hidden md:flex w-[72px] bg-bg2 border-r border-border flex-col items-center py-5 gap-1 shrink-0">
        <div
          onClick={() => navigate('/')}
          className="w-10 h-10 gradient-green rounded-xl flex items-center justify-center font-display font-black text-black text-lg mb-5 glow-green cursor-pointer">
          P
        </div>

        {sidebarNav.map(n => <SidebarLink key={n.to} {...n} />)}

        {/* Admin/Agent links if applicable */}
        {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
          <>
            <div className="w-8 h-px bg-border my-1" />
            {user.role === 'ADMIN' && <SidebarLink to="/admin" icon={Shield} label="Admin" />}
            <SidebarLink to="/agent" icon={UserCheck} label="Agent" />
          </>
        )}

        <div className="flex-1" />

        {/* Notifications */}
        <button onClick={() => navigate('/profile')}
          className="w-11 h-11 rounded-xl flex items-center justify-center text-subtle hover:text-muted hover:bg-white/5 transition-all relative" title="Notifications">
          <Bell size={18} />
          {unread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full border-2 border-bg2" />}
        </button>

        <button onClick={() => navigate('/legal')} className="w-11 h-11 rounded-xl flex items-center justify-center text-subtle hover:text-muted hover:bg-white/5 transition-all" title="Legal">
          <Scale size={16} />
        </button>

        <button onClick={handleLogout} className="w-11 h-11 rounded-xl flex items-center justify-center text-danger/30 hover:text-danger hover:bg-danger/10 transition-all" title="Logout">
          <LogOut size={18} />
        </button>
      </aside>

      {/* ── Main Content ──────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Desktop Topbar */}
        <header className="hidden md:flex h-14 bg-bg2 border-b border-border items-center px-6 gap-4 shrink-0">
          <div className="flex-1 text-sm text-muted">
            {/* Breadcrumb would go here */}
          </div>

          {/* Balance quick view */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-subtle">Balance:</span>
            <span className="font-display font-bold text-green">—</span>
          </div>

          {/* User pill */}
          <div onClick={() => navigate('/profile')}
            className="flex items-center gap-2.5 bg-card border border-border rounded-xl px-3 py-2 cursor-pointer hover:border-border2 transition-all">
            <div className="w-7 h-7 rounded-lg bg-green/10 border border-green/20 flex items-center justify-center font-display font-bold text-green text-xs overflow-hidden">
              {user?.avatarUrl
                ? <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                : (user?.firstName?.[0] || user?.phone?.slice(-2) || 'U')}
            </div>
            <div className="leading-none">
              <p className="text-xs font-semibold text-white">{user?.firstName || user?.username || 'User'}</p>
              <p className="text-[10px] text-subtle mt-0.5">{user?.kycStatus === 'APPROVED' ? '✅ Verified' : '⚠️ Unverified'}</p>
            </div>
            {unread > 0 && <span className="w-4 h-4 bg-danger rounded-full flex items-center justify-center text-[9px] text-white font-bold">{unread}</span>}
          </div>
        </header>

        {/* Mobile Topbar */}
        <header className="md:hidden flex h-14 bg-bg2 border-b border-border items-center px-4 gap-3 shrink-0">
          <div className="w-8 h-8 gradient-green rounded-lg flex items-center justify-center font-display font-black text-black text-sm">P</div>
          <span className="font-display font-bold text-white text-sm">PesaApp</span>
          <div className="flex-1" />
          <button onClick={() => navigate('/profile')} className="relative">
            <div className="w-8 h-8 rounded-lg bg-green/10 border border-green/20 flex items-center justify-center font-display font-bold text-green text-xs overflow-hidden">
              {user?.avatarUrl ? <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : (user?.firstName?.[0] || 'U')}
            </div>
            {unread > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger rounded-full flex items-center justify-center text-[9px] text-white font-bold border border-bg2">{unread}</span>}
          </button>
        </header>

        {/* Page content */}
        <main className={clsx('flex-1 overflow-y-auto', !isGamePage && 'pb-20 md:pb-0')}>
          <div className={clsx('mx-auto', isGamePage ? 'max-w-5xl p-3 md:p-6' : 'max-w-6xl p-4 md:p-6')}>
            <div className="animate-slide-up">
              <Outlet />
            </div>
          </div>
        </main>

        {/* ── Mobile Bottom Nav ─────────────────────── */}
        {!isGamePage && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-bg2 border-t border-border flex items-center justify-around py-2 px-2 z-50 safe-area-bottom">
            {bottomNav.map(({ to, icon: Icon, label, exact }) => (
              <NavLink key={to} to={to} end={exact}
                className={({ isActive }) =>
                  clsx('flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-0 flex-1',
                    isActive ? 'text-green' : 'text-subtle')
                }>
                {({ isActive }) => (
                  <>
                    <div className={clsx('w-8 h-8 flex items-center justify-center rounded-xl transition-all', isActive && 'bg-green/10')}>
                      <Icon size={18} />
                    </div>
                    <span className="text-[10px] font-medium truncate">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}