import React, { useState, useEffect, useRef } from 'react';
import { FiDollarSign, FiDatabase, FiMenu, FiX, FiChevronDown, FiChevronRight } from "react-icons/fi";
import {  RiBarChartFill, RiSettings3Fill} from "react-icons/ri";
import { FaUserCircle } from "react-icons/fa";
import { Link, useLocation, useNavigate  } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDoorOpen, faSearch, faUserEdit, faFileAlt } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from "../pages/Login/AuthContext";
import NotificacaoIcon from './NotificacaoIcon';
import { filtrarRotasPesquisa, type RotaPesquisa } from './sidebarRotas';

import logoFazenda from "../assets/img/logo-FazendaLageado.svg";
import logoDefaultPerfil from "../assets/img/defaultPerfil-Man1.svg";

const Sidebar = () => {
  // Mobile drawer starts closed (on desktop the sidebar is always visible via lg:translate-x-0)
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredRoutes, setFilteredRoutes] = useState<RotaPesquisa[]>([]);
  const [menuAberto, setMenuAberto] = useState(false);
  const { user, logout } = useAuth(); // Obtém os dados do usuário e função de logout
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Fecha o menu se o usuário clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuAberto(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({
    cadastros: false,
    financeiro: false,
    relatorios: false
  });

  useEffect(() => {
    if (location.pathname.startsWith('/cadastro')) {
      setExpanded(prevState => ({ ...prevState, cadastros: true }));
    } else if (location.pathname.startsWith('/financeiro')) {
      setExpanded(prevState => ({ ...prevState, financeiro: true }));      
    } else if (location.pathname.startsWith('/relatorios')) {
      setExpanded(prevState => ({ ...prevState, relatorios: true }));
    } else {
      setExpanded({ cadastros: false, financeiro: false, relatorios: false });
    }
  }, [location.pathname]);

  useEffect(() => {
    setFilteredRoutes(filtrarRotasPesquisa(searchTerm));
  }, [searchTerm]);

  // Close the mobile drawer after navigating
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const teclaAlterna = (section: string) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExpand(section);
    }
  };

  const toggleExpand = (section: string) => {
    setExpanded(prevState => ({
      ...prevState,
      [section]: !prevState[section]
    }));
  };

  const isActive = (path: string) => location.pathname === path ? 'active' : '';

  return (
    <div className="flex ">
      {/* Overlay para mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`sidebar bg-gray-100 h-screen p-3 fixed top-0 left-0 w-64 z-40 transform transition-transform duration-300 ease-in-out overflow-y-auto ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`} style={{ minHeight: '100vh', height:'100vh', maxHeight: '100vh'}}>
        {/* Logo */}
        <div className="flex items-center justify-between mt-1" style={{position: 'relative'}} >
          <img src={logoFazenda} alt="Fazenda Lageado"  className="logoSidebar" />
          <button style={{position: 'absolute', top:'0', right: '0'}} className="lg:hidden" onClick={() => setIsOpen(false)} aria-label="Fechar menu" title="Fechar menu">
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
                  {route.secao && <span className="ml-1 text-xs text-gray-500">({route.secao})</span>}
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
              role="button"
              tabIndex={0}
              aria-expanded={expanded.cadastros}
              onKeyDown={teclaAlterna('cadastros')}
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
                <Link to="/cadastro/centro-custos">
                  <li className={`flex items-center gap-2 p-2 text-gray-800 hover:bg-gray-200 rounded-md cursor-pointer sub-menu-item ${isActive('/cadastro/centro-custos')}`}>
                    Centro de Custos
                  </li>
                </Link>
              </ul>
              
            </li>

            {/* Financeiro */}
            <li className='div-subMenu'>
              <div
              className={`flex items-center justify-between p-2 text-gray-800 hover:bg-gray-200 rounded-md sub-menu ${expanded.financeiro ? 'expanded' : ''}`}
              onClick={() => toggleExpand('financeiro')}
              role="button"
              tabIndex={0}
              aria-expanded={expanded.financeiro}
              onKeyDown={teclaAlterna('financeiro')}
              >
                <span className="flex items-center gap-2 sub-menu-text"><FiDollarSign /> Financeiro</span>
                {expanded.financeiro ? <FiChevronDown /> : <FiChevronRight />}
              </div>
              
              <ul className={`space-y-2 div-subMenu-item ${expanded.financeiro ? 'block' : 'hidden'}`}>
                <Link to="/financeiro/conciliacao-bancaria">
                  <li className={`flex items-center gap-2 p-2 text-gray-800 hover:bg-gray-200 rounded-md cursor-pointer sub-menu-item ${isActive('/financeiro/conciliacao-bancaria')}`}>
                    Conciliação Bancária
                  </li>
                </Link>
                <Link to="/financeiro/financiamento">
                  <li className={`flex items-center gap-2 p-2 text-gray-800 hover:bg-gray-200 rounded-md cursor-pointer sub-menu-item ${isActive('/financeiro/financiamento')}`}>
                    Financiamento
                  </li>
                </Link>
              </ul>
            </li>

            {/* Relatórios */}
            <li className='div-subMenu'>
              <div
              className={`flex items-center justify-between p-2 text-gray-800 hover:bg-gray-200 rounded-md sub-menu ${expanded.relatorios ? 'expanded' : ''}`}
              onClick={() => toggleExpand('relatorios')}
              role="button"
              tabIndex={0}
              aria-expanded={expanded.relatorios}
              onKeyDown={teclaAlterna('relatorios')}
              >
                <span className="flex items-center gap-2 sub-menu-text"><FontAwesomeIcon icon={faFileAlt} /> Relatórios</span>
                {expanded.relatorios ? <FiChevronDown /> : <FiChevronRight />}
              </div>
              
              <ul className={`space-y-2 div-subMenu-item ${expanded.relatorios ? 'block' : 'hidden'}`}>
                <Link to="/relatorios/fluxo-de-caixa">
                  <li className={`flex items-center gap-2 p-2 text-gray-800 hover:bg-gray-200 rounded-md cursor-pointer sub-menu-item ${isActive('/relatorios/fluxo-de-caixa')}`}>
                    Fluxo de Caixa
                  </li>
                </Link>
                <Link to="/relatorios/centro-custos">
                  <li className={`flex items-center gap-2 p-2 text-gray-800 hover:bg-gray-200 rounded-md cursor-pointer sub-menu-item ${isActive('/relatorios/centro-custos')}`}>
                    Centro de Custos
                  </li>
                </Link>
                <Link to="/relatorios/itens-classificados">
                  <li className={`flex items-center gap-2 p-2 text-gray-800 hover:bg-gray-200 rounded-md cursor-pointer sub-menu-item ${isActive('/relatorios/itens-classificados')}`}>
                    Plano de Contas
                  </li>
                </Link>
                <Link to="/relatorios/financiamentos">
                  <li className={`flex items-center gap-2 p-2 text-gray-800 hover:bg-gray-200 rounded-md cursor-pointer sub-menu-item ${isActive('/relatorios/financiamentos')}`}>
                    Financiamentos
                  </li>
                </Link>
              
              </ul>
            </li>

            {/* Parametros */}
            <Link to="/parametros">
              <li className={`flex items-center gap-2 mt-2 p-2 text-gray-800 hover:bg-gray-200 rounded-md cursor-pointer sub-menu single-menu ${isActive('/parametros')}`}>
                <RiSettings3Fill /> Parâmetros
              </li>
            </Link>
          </ul>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 lg:p-5 navBar-header lg:ml-64">
        <div className="flex justify-between items-center" style={{gap:'15px'}}>
          {/* Botão para abrir sidebar no mobile */}
          <button className="lg:hidden" onClick={() => setIsOpen(true)} aria-label="Abrir menu" title="Abrir menu">
            <FiMenu size={24} />
          </button>
          {/* Notificações e Usuário */}
          <div className="flex items-center gap-4 relative">
            <NotificacaoIcon />
            <span>|</span>

            {/* Imagem do perfil que abre o menu */}
            <button type="button" onClick={() => setMenuAberto(!menuAberto)} aria-label="Menu do usuário" title="Menu do usuário" aria-expanded={menuAberto}>
              <img
                src={ user?.foto_perfil ? user.foto_perfil : logoDefaultPerfil} // Exibe a foto do usuário ou a padrão
                alt=""
                className="logoPerfil cursor-pointer rounded-full w-10 h-10 object-cover"
              />
            </button>

            {/* Dropdown do Menu de Perfil */}
            {menuAberto && (
              <div
                ref={menuRef}
                className="absolute right-0 top-10 mt-2 w-44 bg-white font-medium border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50"
              > 
                <div className='block w-full text-lg text-left px-4 py-1 text-gray-900 border-b border-gray-400 bg-gray-200' style={{textTransform:'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                    {user?.nome.toLocaleLowerCase()}
                </div>
                <button
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-800"
                  onClick={() => {
                    navigate("/cadastro/usuario");
                    setMenuAberto(false);
                  }}
                >
                  <FontAwesomeIcon icon={faUserEdit} className='mr-2'/>
                  Usuários
                </button>
                <button
                  className="block w-full text-left px-4 py-2 border-t text-red-500 hover:bg-gray-100 " 
                  onClick={logout}
                >
                  <FontAwesomeIcon icon={faDoorOpen} className='mr-2'/>
                  Sair
                </button>
              </div>
            )}
          </div>
      
        </div>
      </div>
    </div>
  );
};

export default Sidebar;