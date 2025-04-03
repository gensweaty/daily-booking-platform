
  // Inside the Calendar component declaration:
  console.log("[Calendar] Rendering with props:", { 
    isExternalCalendar, 
    businessId,
    businessUserId, 
    allowBookingRequests,
    directEvents: directEvents?.length || 0,
    fetchedEvents: fetchedEvents?.length || 0,
    eventsCount: events?.length || 0,
    view
  });
  
  if (events?.length > 0) {
    console.log("[Calendar] First event:", events[0]);
  }
