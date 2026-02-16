import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header />
        <main className="flex-1 p-4 lg:p-6 overflow-auto pb-20 lg:pb-6">
          <Outlet />
        </main>
        <MobileNav />
      </div>
    </div>
  );
}