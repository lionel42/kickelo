import { getMessaging, getToken, deleteToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, getDoc, setDoc, updateDoc } from './firebase-service.js';
import { auth, db } from './firebase-service.js';
import { notifyOnMatchCheckbox } from './dom-elements.js';
import { serverTimestamp, deleteField } from 'firebase/firestore';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';
let initialized = false;
let currentToken = null;
let messagingInstance = null;
let suppressToggle = false;

async function getMessagingInstance() {
    if (messagingInstance) return messagingInstance;
    const supported = await isSupported();
    if (!supported) return null;
    messagingInstance = getMessaging();
    return messagingInstance;
}

function getUserDocRef() {
    const user = auth.currentUser;
    if (!user) return null;
    return doc(db, 'users', user.uid);
}

async function setOptInState(enabled) {
    const userRef = getUserDocRef();
    if (!userRef) return;
    await setDoc(userRef, {
        notificationsEnabled: enabled,
        lastActiveAt: serverTimestamp()
    }, { merge: true });
}

async function storeToken(token) {
    const userRef = getUserDocRef();
    if (!userRef) return;
    await setDoc(userRef, {
        notificationsEnabled: true,
        lastOptInAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        fcmTokens: {
            [token]: true
        }
    }, { merge: true });
}

async function removeToken(token) {
    const userRef = getUserDocRef();
    if (!userRef) return;
    await updateDoc(userRef, {
        [`fcmTokens.${token}`]: deleteField()
    });
}

function updateCheckboxState(value) {
    if (!notifyOnMatchCheckbox) return;
    suppressToggle = true;
    notifyOnMatchCheckbox.checked = value;
    suppressToggle = false;
}

async function enableNotifications() {
    if (!VAPID_KEY) {
        console.warn('Missing VITE_FIREBASE_VAPID_KEY. Notifications are disabled.');
        updateCheckboxState(false);
        alert('Notifications are not configured yet. Please set VITE_FIREBASE_VAPID_KEY.');
        return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        updateCheckboxState(false);
        await setOptInState(false);
        return;
    }

    const messaging = await getMessagingInstance();
    if (!messaging) {
        updateCheckboxState(false);
        return;
    }

    const swPath = import.meta.env.DEV
        ? '/src/firebase-messaging-sw.js'
        : '/firebase-messaging-sw.js';
    const registration = await navigator.serviceWorker.register(swPath, { type: 'module' });
    const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration
    });

    if (!token) {
        console.warn('FCM token was not generated.');
        updateCheckboxState(false);
        await setOptInState(false);
        return;
    }

    currentToken = token;
    await storeToken(token);
}

async function disableNotifications() {
    await setOptInState(false);
    const messaging = await getMessagingInstance();
    if (messaging && currentToken) {
        try {
            await deleteToken(messaging);
            await removeToken(currentToken);
        } catch (error) {
            console.warn('Failed to delete FCM token:', error);
        }
    }
    currentToken = null;
}

async function hydrateCheckbox() {
    const userRef = getUserDocRef();
    if (!userRef || !notifyOnMatchCheckbox) return;

    try {
        const snapshot = await getDoc(userRef);
        const enabled = snapshot.exists() ? Boolean(snapshot.data().notificationsEnabled) : false;
        updateCheckboxState(enabled);
    } catch (error) {
        console.warn('Failed to read notification preferences:', error);
    }
}

function setupForegroundNotifications() {
    getMessagingInstance().then((messaging) => {
        if (!messaging) return;
        onMessage(messaging, (payload) => {
            const title = payload.notification?.title || 'New match submitted';
            const body = payload.notification?.body || 'Join the session now.';
            if (Notification.permission === 'granted') {
                new Notification(title, { body, icon: '/assets/football.svg' });
            }
        });
    });
}

export async function initializeNotifications() {
    if (initialized) return;
    initialized = true;

    if (!notifyOnMatchCheckbox) {
        return;
    }

    notifyOnMatchCheckbox.disabled = true;

    const supported = await isSupported();
    if (!supported) {
        notifyOnMatchCheckbox.title = 'Notifications are not supported in this browser.';
        return;
    }

    notifyOnMatchCheckbox.disabled = false;
    await hydrateCheckbox();

    notifyOnMatchCheckbox.addEventListener('change', async () => {
        if (suppressToggle) return;
        if (notifyOnMatchCheckbox.checked) {
            await enableNotifications();
        } else {
            await disableNotifications();
        }
    });

    setupForegroundNotifications();
}
