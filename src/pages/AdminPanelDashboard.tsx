
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AnalyticsCharts } from '@/components/admin/AnalyticsCharts';
import { CRMTable } from '@/components/admin/CRMTable';

export default function AdminPanelDashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Analytics Section */}
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Platform Analytics</h2>
              <p className="text-gray-600">Real-time insights and platform metrics</p>
            </div>
            <AnalyticsCharts />
          </section>

          {/* CRM Section */}
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
              <p className="text-gray-600">Comprehensive user data and activity overview</p>
            </div>
            <CRMTable />
          </section>
        </div>
      </main>
    </div>
  );
}
