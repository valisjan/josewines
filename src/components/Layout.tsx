import { NavLink, Outlet } from 'react-router-dom'
import { Wine, LayoutGrid, Bell, BarChart3, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import clsx from 'clsx'

export default function Layout() {
  const { signOut } = useAuth()

  const navItems = [
    { to: '/', icon: LayoutGrid, label: 'Bodega' },
    { to: '/pendientes', icon: Bell, label: 'Pendientes' },
    { to: '/estadisticas', icon: BarChart3, label: 'Stats' },
  ]

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:w-60 md:flex-col bg-[#100303] border-r border-wine-800/50">
        <div className="flex items-center gap-3 px-5 py-6 border-b border-wine-800/50">
          <div className="w-9 h-9 rounded-xl bg-wine-800 flex items-center justify-center">
            <Wine className="w-5 h-5 text-wine-300" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">Mi Bodega</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-wine-800 text-white'
                  : 'text-wine-400 hover:bg-wine-900 hover:text-white'
              )}
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-wine-800/50">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-medium text-wine-400 hover:bg-wine-900 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Cerrar sesión
          </button>
          <p className="mt-3 px-3 text-[10px] text-wine-700 tabular-nums">
            Build {new Date(__BUILD_TIME__).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 md:ml-60 pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[#100303] border-t border-wine-800/50 safe-area-pb">
        <div className="flex items-stretch">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => clsx(
                'flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors',
                isActive ? 'text-wine-300' : 'text-wine-600'
              )}
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
          <button
            onClick={signOut}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium text-wine-600"
          >
            <LogOut className="w-5 h-5" />
            Salir
          </button>
        </div>
      </nav>
    </div>
  )
}
