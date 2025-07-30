
import { useEffect } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AnalyticsCharts } from '@/components/admin/AnalyticsCharts';
import { CRMTable } from '@/components/admin/CRMTable';
import { motion } from 'framer-motion';
import { EnhancedDashboardHeader } from '@/components/dashboard/EnhancedDashboardHeader';

export default function AdminPanelDashboard() {
  useEffect(() => {
    // Set dark mode as default for admin panel
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
      
      <motion.main 
        className="max-w-7xl mx-auto px-6 py-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="space-y-8">
          {/* Analytics Section */}
          <motion.section 
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-foreground">Platform Analytics</h2>
              <p className="text-muted-foreground text-lg">Real-time insights and platform metrics</p>
            </div>
            <AnalyticsCharts />
          </motion.section>

          {/* CRM Section */}
          <motion.section 
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-foreground">User Management</h2>
              <p className="text-muted-foreground text-lg">Comprehensive user data and activity overview</p>
            </div>
            <CRMTable />
          </motion.section>
        </div>
      </motion.main>
    </div>
  );
}
