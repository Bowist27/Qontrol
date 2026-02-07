import { triggerLogout } from '../utils/authEvents';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
    };
};

const getMultipartHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Authorization': token ? `Bearer ${token}` : '',
    };
};

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        if (response.status === 401) {
            triggerLogout();
            throw new Error('Su sesión ha expirado. Por favor inicie sesión nuevamente.');
        }

        // Try to parse error message from JSON, fallback to status text
        try {
            const error = await response.json();
            throw new Error(error.message || `Error ${response.status}: ${response.statusText}`);
        } catch (e) {
            if (e instanceof Error && e.message.includes('Sesión expirada')) throw e;
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
    }

    // For 204 No Content
    if (response.status === 204) {
        return {} as T;
    }

    return response.json();
}

export const httpClient = {
    get: async <T>(url: string): Promise<T> => {
        const res = await fetch(url, {
            headers: getAuthHeaders(),
        });
        return handleResponse<T>(res);
    },

    post: async <T>(url: string, body?: unknown): Promise<T> => {
        const res = await fetch(url, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse<T>(res);
    },

    put: async <T>(url: string, body: unknown): Promise<T> => {
        const res = await fetch(url, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse<T>(res);
    },

    delete: async <T>(url: string): Promise<T> => {
        const res = await fetch(url, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<T>(res);
    },

    // Special case for FormData (file uploads)
    postMultipart: async <T>(url: string, formData: FormData): Promise<T> => {
        const res = await fetch(url, {
            method: 'POST',
            headers: getMultipartHeaders(), // No Content-Type header (browser sets it with boundary)
            body: formData,
        });
        return handleResponse<T>(res);
    }
};
