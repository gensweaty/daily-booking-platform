import { es as baseEs } from 'some-base-translations-path'; // Adjust import path as needed

export const es = {
  ...baseEs,
  business: {
    ...baseEs.business,
    noRequestsYet: "Aún no hay solicitudes",
    requestsWillAppearHere: "Las solicitudes de reserva aparecerán aquí cuando los clientes las envíen",
  },
};
