
import React, { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { TaskList } from '../TaskList';
import { NoteList } from '../NoteList';
import { ReminderList } from '../ReminderList';
import { Calendar } from '../Calendar/Calendar';
import { CustomerList } from '../crm/CustomerList';
import { Statistics } from '../Statistics';
import { BusinessPage } from '../business/BusinessPage';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';

export function DashboardContent() {
  const { user } = useAuth();
  const location = useLocation();

  // Set up real-time updates for the current user
  useRealtimeUpdates(user?.id);

  return (
    <div className="p-4 lg:p-8">
      <Routes>
        <Route path="/" element={<TaskList />} />
        <Route path="/notes" element={<NoteList />} />
        <Route path="/reminders" element={<ReminderList />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/crm" element={<CustomerList />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/business" element={<BusinessPage />} />
      </Routes>
    </div>
  );
}
