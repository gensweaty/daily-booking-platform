
// If this file doesn't exist, here's the implementation for getPublicCalendarEvents
export async function getPublicCalendarEvents(businessId: string) {
  const response = await fetch(`/api/calendar/public?businessId=${businessId}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch public calendar events');
  }
  
  return await response.json();
}
