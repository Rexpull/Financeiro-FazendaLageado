import React, { useState, useEffect, useRef } from 'react';
import { IoMdNotificationsOutline } from "react-icons/io";
import { getNotificacoesComTotal, NotificacaoConciliacao } from '../services/notificacaoService';
import { useNavigate } from 'react-router-dom';

const NotificacaoIcon: React.FC = () => {
  const [notificacoes, setNotificacoes] = useState<NotificacaoConciliacao[]>([]);
  const [totalNotificacoes, setTotalNotificacoes] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNotificacoes = async () => {
      try {
        setIsLoading(true);
        const { notificacoes: notifData, total } = await getNotificacoesComTotal();
        setNotificacoes(notifData);
        setTotalNotificacoes(total);
      } catch (error) {
        console.error('Erro ao carregar notificações:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotificacoes();
    
    // Atualiza a cada 5 minutos
    const interval = setInterval(fetchNotificacoes, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificacaoClick = (notificacao: NotificacaoConciliacao) => {
    // Criar objeto completo da conta com base na notificação
    const contaCompleta = {
      id: notificacao.idContaCorrente,
      numConta: notificacao.numConta,
      bancoNome: notificacao.nomeBanco,
      responsavel: notificacao.nomeConta,
      bancoCodigo: notificacao.nomeBanco.substring(0, 2).toUpperCase()
    };

    // Atualizar o localStorage com a conta selecionada
    localStorage.setItem('contaSelecionada', JSON.stringify(contaCompleta));

    // Navegar para a tela de conciliação bancária com os dados da conta
    navigate('/financeiro/conciliacao-bancaria', { 
      state: { 
        contaSelecionada: contaCompleta,
        filtroPendentes: true,
        fromNotification: true
      } 
    });
    setIsOpen(false);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateRange = (dataInicial: string, dataFinal: string) => {
    if (!dataInicial || !dataFinal) return 'N/A';
    
    const inicio = new Date(dataInicial);
    const fim = new Date(dataFinal);
    
    if (inicio.getTime() === fim.getTime()) {
      return formatDate(dataInicial);
    }
    
    return `${formatDate(dataInicial)} - ${formatDate(dataFinal)}`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-800 transition-colors"
        disabled={isLoading}
      >
        <IoMdNotificationsOutline size={26} />
        {totalNotificacoes > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-6 w-8 flex items-center justify-center font-bold">
            {totalNotificacoes > 99 ? '99+' : totalNotificacoes}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden z-50">
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">
              Notificações de Conciliação
            </h3>
              <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
                {totalNotificacoes}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Movimentos aguardando conciliação bancária
            </p>
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                <p className="text-gray-500 text-sm">Carregando notificações...</p>
            </div>
          ) : notificacoes.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-gray-600 font-medium">Tudo em dia!</p>
                <p className="text-gray-500 text-sm">Nenhuma notificação pendente</p>
            </div>
          ) : (
              <div className="divide-y divide-gray-100">
              {notificacoes.map((notificacao, index) => (
                <div
                  key={index}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-all duration-200 group"
                  onClick={() => handleNotificacaoClick(notificacao)}
                >
                    <div className="flex items-start space-x-3">
                      {/* Ícone do banco */}
                      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {notificacao.nomeBanco.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      
                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                        {notificacao.nomeConta}
                      </h4>
                          <span className="bg-red-100 text-nowrap text-red-800 text-xs font-semibold px-2 py-1 rounded-full">
                      {notificacao.quantidadePendentes} pendente{notificacao.quantidadePendentes !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600 flex items-center">
                            <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                            {notificacao.nomeBanco} - {notificacao.numConta}
                          </p>
                          
                          <div className="flex items-center text-xs text-gray-500">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Período: {formatDateRange(notificacao.dataInicial, notificacao.dataFinal)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Seta */}
                      <div className="flex-shrink-0 text-gray-400 group-hover:text-blue-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>

          {/* Footer */}
          {notificacoes.length > 0 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => {
                  navigate('/financeiro/conciliacao-bancaria');
                  setIsOpen(false);
                }}
                className="w-full text-center text-blue-600 hover:text-blue-800 font-medium text-sm py-2 px-4 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Ver todas as conciliações →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificacaoIcon;
