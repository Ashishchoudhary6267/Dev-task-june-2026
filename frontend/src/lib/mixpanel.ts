import mixpanel from 'mixpanel-browser';

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

// Prevent duplicate initialization during hot reloads in Next.js development
if (MIXPANEL_TOKEN && typeof window !== 'undefined') {
  mixpanel.init(MIXPANEL_TOKEN, {
    debug: process.env.NODE_ENV !== 'production', // Shows events in local console
    track_pageview: true, // Automatically track pageviews
    persistence: 'localStorage' // Maintains user tokens between visits
  });
}

export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (MIXPANEL_TOKEN && typeof window !== 'undefined') {
    mixpanel.track(eventName, properties);
  } else {
    // Only warn in development if we can't track
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`Mixpanel event tracking disabled: ${eventName}`);
    }
  }
};

export const identifyUser = (userId: string, traits?: Record<string, any>) => {
  if (MIXPANEL_TOKEN && typeof window !== 'undefined') {
    mixpanel.identify(userId);
    if (traits) {
      mixpanel.people.set(traits);
    }
  }
};
