import { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { TerminalSquare, Layers } from 'lucide-react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="layout">
      <nav className="navbar">
        <div className="container navbar-content">
          <Link to="/" className="navbar-brand">
            <TerminalSquare size={24} color="var(--primary)" />
            CI/CD Engine
          </Link>

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
