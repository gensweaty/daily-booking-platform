
import React from 'react';
import { useBookingRequests } from '@/hooks/useBookingRequests';

export const BookingRequestList: React.FC = () => {
  const { data: bookingRequests, isLoading } = useBookingRequests();

  if (isLoading) {
    return <div className="text-center py-4">Loading booking requests...</div>;
  }

  if (!bookingRequests || bookingRequests.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        No booking requests
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="font-medium text-sm text-gray-700 mb-2">Booking Requests</h3>
      {bookingRequests.map((request) => (
        <div key={request.id} className="border rounded p-2 bg-gray-50 text-sm">
          <p className="font-medium">{request.title}</p>
          <p className="text-gray-600">{request.requester_name}</p>
          <p className="text-xs text-gray-500">
            {new Date(request.start_date).toLocaleDateString()}
          </p>
        </div>
      ))}
    </div>
  );
};
