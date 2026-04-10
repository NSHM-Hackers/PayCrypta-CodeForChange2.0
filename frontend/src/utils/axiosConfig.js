import axios from "axios";

const resolveApiBaseUrl = () => {
  if (typeof window === "undefined") {
    return "http://localhost:8000/api";
  }

  const { hostname, port, protocol } = window.location;

  // Local Vite dev server should always point to local backend on :8000.
  if (hostname === "localhost" && port === "5173") {
    return "http://localhost:8000/api";
  }

  // Production/static hosting should use same scheme + host with default port (80/443).
  return `${protocol}//${hostname}/api`;
};

const axiosInstance = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 10000,
});

const buildAuthorizationHeader = (token) => {
  if (!token) return null;
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
};

// Request interceptor to add token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    const authHeader = buildAuthorizationHeader(token);

    if (authHeader) {
      config.headers.Authorization = authHeader;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor to handle auth errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/";
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;
