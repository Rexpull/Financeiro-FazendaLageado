import React from "react";
import Sidebar from "./src/components/Sidebar";
import { Outlet } from "react-router-dom"; // 🔹 Importa Outlet para renderizar páginas

const MainLayout = React.memo(() => {
  return (
    <div className="flex">
      <Sidebar /> {/* 🔹 Sidebar presente em todas as páginas */}
      <div className="flex-1 py-5 px-4 lg:px-7 lg:ml-64" style={{maxWidth: '100vw'}}>
        <Outlet /> 
        <div className="mt-10 text-center text-gray-500 leading-tight">
          <span className="block text-sm font-medium">Financeiro Fazenda Lageado</span>
          <span className="block text-sm">54.539.152/0001-96</span>
          <span className="block text-xs">Todos os Direitos Reservados</span>
        </div>
      </div>
    </div>
  );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;
