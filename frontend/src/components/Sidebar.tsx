import React, { useState, useEffect } from 'react';
import { FiUsers, FiDatabase, FiBarChart2, FiMenu, FiX, FiChevronDown, FiChevronRight  } from "react-icons/fi";
import { RiUserFill, RiDatabaseFill, RiBarChartFill, RiMenuFill, RiCloseFill, RiArrowDownSFill, RiArrowRightSFill } from "react-icons/ri";
import { IoMdNotificationsOutline } from "react-icons/io";
import { FaUserCircle } from "react-icons/fa";
import { Link, useLocation, useNavigate  } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';


import logoFazenda from "../assets/img/logo-FazendaLageado.svg";

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredRoutes, setFilteredRoutes] = useState<string[]>([]);

  const routes = [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/cadastro/pessoa", label: "Pessoa" },
    { path: "/cadastro/usuario", label: "Usuário" },
    { path: "/cadastro/banco", label: "Banco" },
    { path: "/cadastro/conta-corrente", label: "Conta Corrente" },
    { path: "/cadastro/plano-de-contas", label: "Plano de Contas" },
    { path: "/financeiro/conciliacao-bancaria", label: "Conciliação Bancária" },
    { path: "/financeiro/fluxo-de-caixa", label: "Fluxo de Caixa" },
  ];


  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({
    cadastros: false,
    financeiro: false
  });

  useEffect(() => {
    if (location.pathname.startsWith('/cadastro')) {
      setExpanded(prevState => ({ ...prevState, cadastros: true }));
    } else if (location.pathname.startsWith('/financeiro')) {
      setExpanded(prevState => ({ ...prevState, financeiro: true }));      
    } else {
      setExpanded({ cadastros: false, financeiro: false });
    }
  }, [location.pathname]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = routes.filter((route) =>
        route.label.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredRoutes(filtered);
    } else {
      setFilteredRoutes([]);
    }
  }, [searchTerm]);

  const toggleExpand = (section: string) => {
    setExpanded(prevState => ({
      ...prevState,
      [section]: !prevState[section]
    }));
  };

  const isActive = (path: string) => location.pathname === path ? 'active' : '';

  return (
    <div className="flex ">
      {/* Sidebar */}
      <div className={`sidebar bg-gray-100 h-screen p-3  w-85  sm:hidden lg:block`} style={{ display: isOpen ? "block" : "none", minHeight: '100vh', height:'100%' }}>
        {/* Logo */}
        <div className="flex items-center justify-between mt-1" style={{position: 'relative'}} >
          <img src={logoFazenda} alt="Logo sidebFazenda Lageado"  className="logoSidebar" />
          <button style={{position: 'absolute', top:'0', right: '0'}} className="lg:hidden" onClick={() => setIsOpen(false)}>
            <FiX size={24} />
          </button>
        </div>

        {/* Barra de Pesquisa */}
        <div className="mt-4 relative">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center " style={{ paddingLeft: '0.75rem', color: '#666666'}}>
              <FontAwesomeIcon icon={faSearch} />
            </span>
            <input 
              type="text" 
              placeholder="Pesquisar" 
              className="w-full p-2 pl-10 border rounded-md hover:border-gray-500 focus:outline-none focus:border-blue-500"  style={{borderRadius: '0.875rem', borderColor: 'lightgrey'}}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {filteredRoutes.length > 0 && (
            <ul className="absolute top-full left-0 w-full bg-white border rounded-md mt-1 shadow-md z-50">
              {filteredRoutes.map((route) => (
                <li
                  key={route.path}
                  className="p-2 cursor-pointer hover:bg-gray-200"
                  onClick={() => {
                    navigate(route.path);
                    setSearchTerm(""); // Limpa a pesquisa após a navegação
                  }}
                >
                  {route.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Navegação */}
        <nav className="mt-4 nav">
          <ul className="space-y-2">
            {/* Dashboard */}
            <Link to="/dashboard">
              <li className={`flex items-center gap-2 p-2 text-gray-800 hover:bg-gray-200 rounded-md cursor-pointer sub-menu single-menu ${isActive('/dashboard')}`}>
                <RiBarChartFill /> Dashboard
              </li>
            </Link>

            {/* Cadastros */}
            <li className='div-subMenu'>
              <div
              className={`flex items-center justify-between p-2 text-gray-800 hover:bg-gray-200 rounded-md sub-menu ${expanded.cadastros ? 'expanded' : ''}`}
              onClick={() => toggleExpand('cadastros')}
              >
                <span className="flex items-center gap-2 sub-menu-text"><FiDatabase /> Cadastros</span>
                {expanded.cadastros ? <FiChevronDown /> : <FiChevronRight />}
              </div>
              
              <ul className={`space-y-2 div-subMenu-item ${expanded.cadastros ? 'block' : 'hidden'}`}>
                <Link to="/cadastro/pessoa">
                  <li className={`flex items-center gap-2 p-2 text-gray-800 hover:bg-gray-200 rounded-md cursor-pointer sub-menu-item ${isActive('/cadastro/pessoa')}`}>
                    Pessoa
                  </li>
                </Link>
                <Link to="/cadastro/usuario">
                  <li className={`flex items-center gap-2 p-2 text-gray-800 hover:bg-gray-200 rounded-md cursor-pointer sub-menu-item ${isActive('/cadastro/usuario')}`}>
                    Usuário
                  </li>
                </Link>
                <Link to="/cadastro/banco">
                  <li className={`flex items-center gap-2 p-2 text-gray-800 hover:bg-gray-200 rounded-md cursor-pointer sub-menu-item ${isActive('/cadastro/banco')}`}>
                    Banco
                  </li>
                </Link>
                <Link to="/cadastro/conta-corrente">
                  <li className={`flex items-center gap-2 p-2 text-gray-800 hover:bg-gray-200 rounded-md cursor-pointer sub-menu-item ${isActive('/cadastro/conta-corrente')}`}>
                    Conta Corrente
                  </li>
                </Link>
                <Link to="/cadastro/plano-de-contas">
                  <li className={`flex items-center gap-2 p-2 text-gray-800 hover:bg-gray-200 rounded-md cursor-pointer sub-menu-item ${isActive('/cadastro/plano-de-contas')}`}>
                    Plano de Contas
                  </li>
                </Link>
              </ul>
              
            </li>

            {/* Financeiro */}
            <li className='div-subMenu'>
              <div
              className={`flex items-center justify-between p-2 text-gray-800 hover:bg-gray-200 rounded-md sub-menu ${expanded.financeiro ? 'expanded' : ''}`}
              onClick={() => toggleExpand('financeiro')}
              >
                <span className="flex items-center gap-2 sub-menu-text"><FiUsers /> Financeiro</span>
                {expanded.financeiro ? <FiChevronDown /> : <FiChevronRight />}
              </div>
              
              <ul className={`space-y-2 div-subMenu-item ${expanded.financeiro ? 'block' : 'hidden'}`}>
                <Link to="/financeiro/conciliacao-bancaria">
                  <li className={`flex items-center gap-2 p-2 text-gray-800 hover:bg-gray-200 rounded-md cursor-pointer sub-menu-item ${isActive('/financeiro/conciliacao-bancaria')}`}>
                    Conciliação Bancária
                  </li>
                </Link>
                <Link to="/financeiro/fluxo-de-caixa">
                  <li className={`flex items-center gap-2 p-2 text-gray-800 hover:bg-gray-200 rounded-md cursor-pointer sub-menu-item ${isActive('/financeiro/fluxo-de-caixa')}`}>
                    Fluxo de Caixa
                  </li>
                </Link>
              </ul>
            </li>
          </ul>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-5 navBar-header">
        <div className="flex justify-between items-center" style={{gap:'15px'}}>
          {/* Botão para abrir sidebar no mobile */}
          <button className="lg:hidden" onClick={() => setIsOpen(true)}>
            <FiMenu size={24} />
          </button>

          {/* Notificações e Usuário */}
          <div className="flex items-center gap-4">
            <IoMdNotificationsOutline size={24}  />
            <FaUserCircle size={28}  />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;