export interface AuthAPI {
    login: (credentials: any) => Promise<any>;
    sync: () => Promise<any>;
}

declare global {
    interface Window {
        auth: AuthAPI;
    }
}
