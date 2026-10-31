import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export function PageLayout() {
  return (
    <div className="flex flex-col min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-plum focus:text-white focus:rounded-xl focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-gold"
      >
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content" role="main" className="flex-1 pt-16">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
