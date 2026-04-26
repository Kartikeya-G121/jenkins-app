import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { TerminalSquare } from 'lucide-react';

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
      <main className="main-content container">
        {children}
      </main>
    </div>
  );
}
