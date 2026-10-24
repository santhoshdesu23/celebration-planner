import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export function PageLayout() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main id="main-content" role="main" className="flex-1 pt-16">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
