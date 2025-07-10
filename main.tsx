import React from "react";
import ReactDOM from "react-dom/client";
import AppRoutes from "./frontend/routes";
import "./frontend/src/assets/css/index.css";
import "./frontend/src/assets/css/login.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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