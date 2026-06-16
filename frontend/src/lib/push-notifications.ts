function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported');
    return null;
  }

  try {
    console.log('Requesting notification permission...');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission denied');
      return null;
    }

    console.log('Checking for existing SW registration...');
    let registration = await navigator.serviceWorker.getRegistration();
    
    if (registration) {
      console.log('Existing SW registration found:', registration.scope);
      if (registration.active) {
        console.log('SW status: ACTIVE');
      } else if (registration.waiting) {
        console.log('SW status: WAITING - skipping waiting...');
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        console.log('SW status:', registration.installing ? 'INSTALLING' : 'UNKNOWN');
      }
    } else {
      console.log('No SW found, registering /sw.js manually...');
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('New registration successful:', registration.scope);
    }

    // Ensure it's ready and controlled
    await navigator.serviceWorker.ready;
    
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    console.log("Using VAPID key:", vapidKey ? "KEY_EXISTS" : "KEY_MISSING");

    if (!vapidKey) {
        throw new Error('VAPID public key is missing in environment variables.');
    }

    console.log('Accessing PushManager...');

    let subscription = await registration.pushManager.getSubscription();
    console.log('Existing subscription found:', !!subscription);

    if (!subscription) {
      console.log('Creating new push subscription...');
      const convertedVapidKey = urlBase64ToUint8Array(vapidKey);

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
      console.log('New subscription created successfully');
    }

    return subscription;
  } catch (error) {
    console.error('Error subscribing to push notifications', error);
    throw error;
  }
}

export async function unsubscribeFromPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      return subscription.endpoint;
    }
  } catch (error) {
    console.error('Error unsubscribing', error);
  }
  return null;
}
