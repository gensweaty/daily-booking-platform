import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCustomers } from '@/lib/api';
import { Customer } from '@/lib/types';

const formatPaymentStatus = (status: string, amount: number | null) => {
  if (!status) return '-';
  const displayStatus = status.replace('_', ' ');
  
  if ((status === 'partly' || status === 'fully') && amount) {
    return (
      <span className={`capitalize ${
        status === 'fully' ? 'text-green-600' :
        status === 'partly' ? 'text-yellow-600' :
        'text-red-600'
      }`}>
        {displayStatus} (${amount})
      </span>
    );
  }

  return (
    <span className={`capitalize ${
      status === 'fully' ? 'text-green-600' :
      status === 'partly' ? 'text-yellow-600' :
      'text-red-600'
    }`}>
      {displayStatus}
    </span>
  );
};

export const CustomerList = () => {
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: getCustomers,
  });

  if (isLoading) return <div>Loading customers...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold">Customer List</h2>
      <ul>
        {(customers as Customer[]).map((customer: Customer) => (
          <li key={customer.id} className="py-2">
            <div className="flex justify-between">
              <span>{customer.title}</span>
              <span>{formatPaymentStatus(customer.payment_status || '', customer.payment_amount || null)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};