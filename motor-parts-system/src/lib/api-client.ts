import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Utility function to handle API calls with authentication checks
 * Automatically redirects to login on 401 errors
 */
export async function apiCall(url: string, options: RequestInit = {}, router?: any) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        // Check for authentication errors
        if (response.status === 401) {
            if (router) {
                router.push('/login');
            } else {
                // If no router provided, redirect using window.location
                window.location.href = '/login';
            }
            throw new Error('Unauthorized - redirecting to login');
        }

        return response;
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

/**
 * Hook to get authenticated API call function
 */
export function useApiCall() {
    const router = useRouter();
    // Memoize to ensure stable reference across renders
    return useCallback((url: string, options: RequestInit = {}) =>
        apiCall(url, options, router), [router]);
}
