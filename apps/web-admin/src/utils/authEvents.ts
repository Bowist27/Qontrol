/**
 * Auth Events Utility
 * Used to decouple API clients from React Context for handling global auth events (like 401 logout)
 */

export const AUTH_EVENTS = {
    LOGOUT: 'auth:logout',
};

export const triggerLogout = () => {
    window.dispatchEvent(new Event(AUTH_EVENTS.LOGOUT));
};
