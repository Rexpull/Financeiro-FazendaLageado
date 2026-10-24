import React from "react";
import ReactDOM from "react-dom/client";
import AppRoutes from "./frontend/routes";
import "./frontend/src/assets/css/index.css";
import "./frontend/src/assets/css/login.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { instalarFetchAutenticado } from "./frontend/src/services/apiFetch";

// Must run before any component fetches: adds the Bearer token to API calls and handles 401.
instalarFetchAutenticado();

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <AppRoutes />
    <ToastContainer 
      position="bottom-right" 
      pauseOnHover={false}  
      autoClose={2000} 
      hideProgressBar={false} 
    />
  </React.StrictMode>
);