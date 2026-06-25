const API_URL = import.meta.env.VITE_API_URL || '';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const url = `${API_URL}${path}`;
  
  // Ensure credentials are included (to send/receive cookies)
  options.credentials = 'include';
  
  // Set JSON headers by default
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  options.headers = headers;

  const response = await fetch(url, options);
  
  if (!response.ok) {
    let errorMessage = 'An error occurred';
    try {
      const errData = await response.json();
      errorMessage = errData.error || errData.message || errorMessage;
    } catch {
      try {
        errorMessage = await response.text();
      } catch {}
    }
    throw new Error(errorMessage || `HTTP error ${response.status}`);
  }

  // Handle empty or text responses
  const contentType = response.headers.get('Content-Type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}
