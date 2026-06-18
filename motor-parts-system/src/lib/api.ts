// .NET Stock Service was removed; product search uses COSTEX only.
// Client search uses local Prisma (Users with role client).

// Utility function to handle API errors
export function handleAPIError(error: any): { message: string; status: number } {
  if (error.response) {
    return {
      message: error.response.data?.message || 'API request failed',
      status: error.response.status,
    };
  } else if (error.request) {
    return {
      message: 'No response received from server',
      status: 503,
    };
  } else {
    return {
      message: error.message || 'An unexpected error occurred',
      status: 500,
    };
  }
}

// Utility function to validate API responses
export function validateAPIResponse(response: any, expectedFields: string[]): boolean {
  if (!response || typeof response !== 'object') {
    return false;
  }

  return expectedFields.every(field => response.hasOwnProperty(field));
}

// Export SearchAPI for compatibility
export const SearchAPI = {
  search: async (reference: string, clientId?: number) => {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reference, clientId }),
    });
    return response.json();
  },
};
