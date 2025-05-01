import React from "react";
import Sidebar from "./src/components/Sidebar";
import { Outlet } from "react-router-dom"; // 🔹 Importa Outlet para renderizar páginas

const MainLayout = () => {
  return (
    <div className="flex">
      <Sidebar /> {/* 🔹 Sidebar presente em todas as páginas */}
      <div className="flex-1 py-5 px-7" style={{maxWidth: 'calc(100vw - 257px)'}}>
        <Outlet /> 
        <div className="mt-10 text-center text-gray-500 leading-tight">
          <span className="block text-sm font-medium">Financeiro Fazenda Lageado</span>
          <span className="block text-sm">54.539.152/0001-96</span>
          <span className="block text-xs">Todos os Direitos Reservados</span>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
