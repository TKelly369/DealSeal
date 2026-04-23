/** In-memory per API key (partner layer). */
export const byKey = new Map<string, { n: number; reset: number }>();
