import { useEffect } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AnalyticsCharts } from '@/components/admin/AnalyticsCharts';
import { CRMTable } from '@/components/admin/CRMTable';
import { TrafficOverview } from '@/components/admin/TrafficOverview';

const SectionTitle = ({ title, sub }: { title: string; sub: string }) => (
  <div className="space-y-1">
    <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
    <p className="text-sm text-muted-foreground">{sub}</p>
  </div>
);

export default function AdminPanelDashboard() {
  useEffect(() => {
    const currentTheme = localStorage.getItem('vite-ui-theme');
    if (!currentTheme) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('vite-ui-theme', 'dark');
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-12">
        <section className="space-y-5">
          <SectionTitle title="Website traffic" sub="Anonymous visitor statistics — who visits, from where, and which pages" />
          <TrafficOverview />
        </section>
        <section className="space-y-5">
          <SectionTitle title="Users & subscriptions" sub="Sign-ups and plan breakdown" />
          <AnalyticsCharts />
        </section>
        <section className="space-y-5">
          <SectionTitle title="User management" sub="All accounts and their activity" />
          <CRMTable />
        </section>
      </main>
    </div>
  );
}
