import { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { TerminalSquare, GitFork, Layers, LayoutDashboard } from 'lucide-react';

const NAV_LINKS = [
  { to: '/',             label: 'Builds',       icon: <LayoutDashboard size={15} />, exact: true  },
  { to: '/repositories', label: 'Repositories', icon: <GitFork size={15} />,         exact: false },
  { to: '/queue',        label: 'Queue',        icon: <Layers size={15} />,          exact: false },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="layout">
      <nav className="navbar">
        <div className="container navbar-content">
          <Link to="/" className="navbar-brand">
            <TerminalSquare size={22} color="var(--primary)" />
            CI/CD Engine
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '2rem' }}>
            {NAV_LINKS.map(({ to, label, icon, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  fontSize: '0.825rem', fontWeight: 500,
                  padding: '0.375rem 0.75rem', borderRadius: '6px',
                  color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                  background: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
                  transition: 'color 0.15s, background 0.15s',
                })}
              >
                {icon} {label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
      <main className="main-content">
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 2rem' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
