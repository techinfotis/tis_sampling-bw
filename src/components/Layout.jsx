import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { getCurrentUser, logout, isAdmin, canAccessUserManagement } from '../lib/auth';
import { useEffect, useState, useCallback } from 'react';
import { syncToSupabase, pullFromSupabase } from '../lib/sync';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // 'ok' | 'error' | null
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Deteksi update Service Worker
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then(reg => {
      // Cek jika sudah ada SW yang waiting saat komponen mount
      if (reg.waiting) {
        setUpdateAvailable(true);
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
          }
        });
      });
    });

    // Reload otomatis setelah SW baru aktif
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    // Cek update setiap 5 menit
    const interval = setInterval(() => {
      navigator.serviceWorker.ready.then(reg => reg.update());
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdate = () => {
    setIsUpdating(true);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
      });
    }
    // Beri sedikit jeda agar user melihat animasi loading sebelum refresh
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      doSync();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const doSync = useCallback(async () => {
    if (syncing || !navigator.onLine) return;
    setSyncing(true);
    setSyncStatus(null);
    try {
      await pullFromSupabase();
      await syncToSupabase();
      setSyncStatus('ok');
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err) {
      console.error('[Sync] Error:', err);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus(null), 5000);
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  const handleLogout = async () => {
    if (confirm('Yakin ingin logout?')) {
      await logout();
      navigate('/login');
    }
  };

  const desktopLinks = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/input', label: 'Input' },
    { to: '/sebaran', label: 'Sebaran' },
    { to: '/kandang', label: 'Kandang' },
    ...(canAccessUserManagement() ? [
      { to: '/users', label: 'Users' }
    ] : []),
    ...(isAdmin() ? [
      { to: '/admin', label: 'Audit' }
    ] : [])
  ];

  const bottomNavLinks = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
    },
    {
      to: '/kandang',
      label: 'Kandang',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      to: '/input',
      label: 'Input',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      )
    },
    {
      to: '/sebaran',
      label: 'Sebaran',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Loading Overlay saat Update */}
      {isUpdating && (
        <div className="fixed inset-0 z-[9999] bg-green-600 flex flex-col items-center justify-center text-white animate-in fade-in duration-300">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-green-200 border-t-white rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-2xl">🐔</div>
          </div>
          <h2 className="mt-6 text-xl font-bold">Smart Farm</h2>
          <p className="mt-2 text-green-100 animate-pulse text-sm">Menyiapkan versi terbaru...</p>
        </div>
      )}

      {/* Banner update tersedia */}
      {updateAvailable && (
        <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between text-sm z-50">
          <span>🆕 Versi baru tersedia</span>
          <button
            onClick={handleUpdate}
            className="bg-white text-blue-600 px-3 py-1 rounded font-semibold text-xs hover:bg-blue-50"
          >
            Update Sekarang
          </button>
        </div>
      )}

      {/* Top Nav */}
      <nav className="bg-green-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">

            {/* Logo & Status */}
            <div>
              <h1 className="text-base md:text-xl font-bold leading-tight">🐔 Smart Farm</h1>
              {user && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-xs text-green-100 truncate max-w-[110px] md:max-w-none">
                    {user.nama} {user.role === 'admin' ? '👑' : '👤'}
                  </p>
                  {/* Status badge — klik untuk sync manual di mobile */}
                  <button
                    onClick={doSync}
                    disabled={syncing || !isOnline}
                    className={`text-xs px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap transition-all ${
                      syncing        ? 'bg-yellow-400 text-yellow-900'
                      : syncStatus === 'ok'    ? 'bg-green-200 text-green-900'
                      : syncStatus === 'error' ? 'bg-red-300 text-red-900'
                      : isOnline     ? 'bg-green-300 text-green-900'
                      : 'bg-red-400 text-red-900'
                    }`}
                    title="Tap untuk sync manual"
                  >
                    <span className={syncing ? 'inline-block animate-spin' : ''}>
                      {syncing ? '⟳' : syncStatus === 'ok' ? '✓' : syncStatus === 'error' ? '✗' : isOnline ? '●' : '○'}
                    </span>
                    <span className="ml-1">
                      {syncing        ? 'Syncing...'
                      : syncStatus === 'ok'    ? 'Tersync'
                      : syncStatus === 'error' ? 'Gagal'
                      : isOnline      ? 'Online'
                      : 'Offline'}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Profile Menu (Desktop & Mobile) */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-1 rounded-full hover:bg-green-500 transition-colors border-2 border-transparent hover:border-green-300"
              >
                <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-full flex items-center justify-center text-green-600 shadow-sm overflow-hidden">
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <svg className={`w-4 h-4 hidden md:block transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showProfileMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowProfileMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-50 border border-gray-100 animate-in fade-in zoom-in duration-100">
                    <div className="px-4 py-2 border-b border-gray-100 mb-1">
                      <p className="text-xs text-gray-500">Login sebagai</p>
                      <p className="text-sm font-bold text-gray-800 truncate">{user?.nama}</p>
                    </div>
                    
                    <button
                      onClick={() => { navigate('/kandang'); setShowProfileMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-50 flex items-center gap-2"
                    >
                      <span className="text-green-600">🏠</span> + Kandang
                    </button>
                    
                    {canAccessUserManagement() && (
                      <button
                        onClick={() => { navigate('/users'); setShowProfileMenu(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-50 flex items-center gap-2"
                      >
                        <span className="text-blue-600">👥</span> + User
                      </button>
                    )}
                    
                    <button
                      onClick={() => { doSync(); setShowProfileMenu(false); }}
                      disabled={syncing || !isOnline}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-50 flex items-center gap-2 disabled:opacity-50"
                    >
                      <span className={syncing ? 'animate-spin' : ''}>🔄</span> Sync Data
                    </button>
                    
                    <hr className="my-1 border-gray-100" />
                    
                    <button
                      onClick={() => { handleLogout(); setShowProfileMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <span>🚪</span> Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-8">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="flex">
          {bottomNavLinks.map(link => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                  active ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {link.icon}
                <span className={`text-xs font-medium ${active ? 'text-green-600' : 'text-gray-400'}`}>
                  {link.label}
                </span>
              </Link>
            );
          })}

        </div>
      </nav>
    </div>
  );
}
