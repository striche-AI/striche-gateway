export type CanonicalRoute = {
  id: string;
  serviceId: string;
  path: string;
  methods: string[];
  plugins?: Record<string, any>;
};

export type CanonicalService = {
  id: string;
  name: string;
  upstreamUrl: string;
  description?: string;
};

export type CanonicalModel = {
  services: CanonicalService[];
  routes: CanonicalRoute[];
  metadata?: Record<string, any>;
};
