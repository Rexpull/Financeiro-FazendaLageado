import React, { useEffect, useState, useRef } from 'react';
import Modal from 'react-modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave, faCheck, faInfoCircle, faUsers, faMoneyBillTransfer, faSearch } from '@fortawesome/free-solid-svg-icons';
import { MovimentoBancario } from '../../../../../../backend/src/models/MovimentoBancario';
import { listarPlanoContas } from '../../../../services/planoContasService';
import { listarBancos } from '../../../../services/bancoService';
import { listarPessoas } from '../../../../services/pessoaService';
import { PlanoConta } from '../../../../../../backend/src/models/PlanoConta';
import { listarParametros } from '../../../../services/parametroService';
import { Parametro } from '../../../../../../backend/src/models/Parametro';
import { Banco } from '../../../../../../backend/src/models/Banco';
import { Pessoa } from '../../../../../../backend/src/models/Pessoa';

Modal.setAppElement('#root');

const cache: {
  parametros: Parametro[] | null;
  bancos: Banco[] | null;
  pessoas: Pessoa[] | null;
  planosConta: PlanoConta[] | null;
} = {
  parametros: null,
  bancos: null,
  pessoas: null,
  planosConta: null
};


interface ConciliaPlanoContasModalProps {
  isOpen: boolean;
  onClose: () => void;
  movimento: MovimentoBancario;
  planos: { id: number; descricao: string; tipo: string }[];
  handleConcilia: (data: any) => void;
}

const ConciliaPlanoContasModal: React.FC<ConciliaPlanoContasModalProps> = ({ isOpen, onClose, movimento, planos, handleConcilia }) => {
  const [modalidadeMovimento, setModalidadeMovimento] = useState('padrao');
  const [idPlanoContas, setIdPlanoContas] = useState<number | null>(null);
  const [idPessoa, setIdPessoa] = useState<number | null>(null);
  const [idBanco, setIdBanco] = useState<number | null>(null);
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [parcelado, setParcelado] = useState(false);
  const [parcelas, setParcelas] = useState<any[]>([]);
  const [planosFetch, setPlanosFetch] = useState<PlanoConta[]>([]);
  const [parametros, setParametros] = useState<Parametro[]>([]);
  const [bancos, setBancos] = useState<{ id: number; nome: string }[]>([]);
  const [pessoas, setPessoas] = useState<{ id: number; nome: string }[]>([]);
  const [numParcelas, setNumParcelas] = useState(1);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const planoRef = useRef(null);
  const [searchPlano, setSearchPlano] = useState('');
  const [nomePlanoFinanciamento, setNomePlanoFinanciamento] = useState('');


  const [formData, setFormData] = useState<any>({
    idPlanoContas: null,
    pessoaSelecionada: '',
    bancoSelecionado: '',
    idPessoa: null,
    idBanco: null,
    parcelado: false,
    numeroDocumento: ''
  });


  useEffect(() => {
    if (isOpen) {
      setModalidadeMovimento('padrao');
      setIdPlanoContas(null);
      setIdPessoa(null);
      setIdBanco(null);
      setNumeroDocumento('');
      setParcelado(false);
      setParcelas([]);
      setSearchPlano('');
      setFormData({
        idPlanoContas: movimento.idPlanoContas || null,
        idPessoa: movimento.idPessoa || null,
        idBanco: movimento.idBanco || null,
        parcelado: movimento.parcelado || false,
        numeroDocumento: movimento.numeroDocumento || ''
      });
      console.log("formData ", formData)
      preencherCamposExistentes();
      validarFormulario();
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!cache.parametros) cache.parametros = await listarParametros();
        if (!cache.planosConta) cache.planosConta = await listarPlanoContas();
        if (!cache.bancos) cache.bancos = await listarBancos();
        if (!cache.pessoas) cache.pessoas = await listarPessoas();

        setParametros(cache.parametros);

        setPlanosFetch(cache.planosConta.filter((p) => p.nivel === 3));
        setBancos(cache.bancos);
        setPessoas(cache.pessoas);
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const preencherCamposExistentes = () => {
    setModalidadeMovimento(movimento.modalidadeMovimento || 'padrao');

    if (movimento.modalidadeMovimento === 'padrao') {
      setFormData({
        idPlanoContas: movimento.idPlanoContas?.toString() || null,
        pessoaSelecionada: movimento.idPessoa ? movimento.idPessoa.toString() : '',
        bancoSelecionado: movimento.idBanco ? movimento.idBanco.toString() : '',
        numeroDocumento: ''
      });
      setIdPlanoContas(movimento.idPlanoContas || null);
      const plano = planos.find((p) => p.id === movimento.idPlanoContas);
      setSearchPlano(plano ? plano.descricao : '');

    } else if (movimento.modalidadeMovimento === 'financiamento') {
      setIdPlanoContas(movimento.idPlanoContas || null);
      setFormData({
        idPlanoContas: movimento.idPlanoContas?.toString() || null,
        pessoaSelecionada: movimento.idPessoa ? movimento.idPessoa.toString() : '',
        bancoSelecionado: movimento.idBanco ? movimento.idBanco.toString() : '',
        numeroDocumento: movimento.numeroDocumento || ''
      });

      console.log("movimento ", movimento)
      
      setNumeroDocumento(movimento.numeroDocumento || '');
      setParcelado(movimento.parcelado || false);
      setParcelas(movimento.parcelas || []);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };


  const validarFormulario = () => {
    const newErrors = {};
    if (modalidadeMovimento=== 'padrao' && !formData.idPlanoContas) newErrors.idPlanoContas = 'Selecione um plano de contas!';
    if (modalidadeMovimento=== 'financiamento') {
      if (!numeroDocumento.trim()) newErrors.numeroDocumento = 'Informe o número do documento!';
      if (!formData.bancoSelecionado && !formData.pessoaSelecionada) {
        newErrors.bancoPessoa = 'Escolha um banco ou uma pessoa!';
      }
      if (formData.bancoSelecionado && formData.pessoaSelecionada) {
        newErrors.bancoPessoa = 'Escolha apenas um: Banco ou Pessoa!';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    if (modalidadeMovimento=== 'financiamento' && movimento.tipoMovimento === 'C' && parametros.length > 0) {
      const idPlano = parametros[0]?.idPlanoEntradaFinanciamentos;
      if (idPlano) {
        setFormData((prev) => ({ ...prev, idPlanoContas: idPlano.toString() }));
        setIdPlanoContas(idPlano);
        const plano = planos.find((p) => p.id === idPlano);
        setSearchPlano(plano ? plano.descricao : '');
        setNomePlanoFinanciamento(plano ? plano.descricao : '');
      }
    } 
  }, [modalidadeMovimento, parametros, movimento.tipoMovimento, planos]);

  useEffect(() => {
    if (parcelado && movimento.valor > 0) {
      const valorParcela = (movimento.valor / numParcelas).toFixed(2);
      const novasParcelas = Array.from({ length: numParcelas }, (_, i) => ({
        numParcela: i + 1,
        dt_vencimento: new Date(new Date().setMonth(new Date().getMonth() + i)).toISOString().slice(0, 10),
        valor: valorParcela
      }));
      setParcelas(novasParcelas);
    }
  }, [parcelado, numParcelas, movimento.valor]);

  const filteredPlanos = planos
    .filter((plano) => plano.descricao.toLowerCase().includes(searchPlano.toLowerCase()) &&
      (movimento.tipoMovimento === 'D' ? plano.hierarquia.startsWith('002') : plano.hierarquia.startsWith('001')) 
      && plano.nivel === 3)
    .slice(0, 10);

  const handleSearchPlano = (e) => {
    setSearchPlano(e.target.value);
    setShowSuggestions(true);
  };

  const selectPlano = (plano) => {
    setSearchPlano(plano.descricao);
    setFormData((prev) => ({ ...prev, idPlanoContas: plano.id.toString() }));
    setIdPlanoContas(plano.id);
    setShowSuggestions(false);
  };


  useEffect(() => {
    gerarParcelas();
  }, [parcelado, numParcelas, movimento.valor]);

  const gerarParcelas = () => {
    if (!parcelado || movimento.valor <= 0) {
      setParcelas([]);
      return;
    }
    const valorParcela = (movimento.valor / numParcelas).toFixed(2);
    const novasParcelas = Array.from({ length: numParcelas }, (_, i) => ({
      numParcela: i + 1,
      dt_vencimento: new Date(new Date().setMonth(new Date().getMonth() + i)).toISOString().slice(0, 10),
      valor: valorParcela,
    }));
    setParcelas(novasParcelas);
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const handleSalvar = () => {
    if (!validarFormulario()) return;

    let dados = {};

    if (modalidadeMovimento=== 'padrao') {
      dados = {
        idPlanoContas: parseInt(formData.idPlanoContas),
        idPessoa: formData.idPessoa ? parseInt(formData.idPessoa) : null,
        idBanco: formData.idBanco ? parseInt(formData.idBanco) : null,
        modalidadeMovimento
      };
    } else if (modalidadeMovimento=== 'financiamento') {
      dados = {
        idPlanoContas: idPlanoContas,
        idPessoa: formData.idPessoa ? parseInt(formData.idPessoa) : null,
        idBanco: formData.idBanco ? parseInt(formData.idBanco) : null,
        numeroDocumento,
        parcelado,
        parcelas,
        modalidadeMovimento
      };
    } else if (modalidadeMovimento=== 'transferencia') {
      const idPlano = parametros[0]?.idPlanoTransferenciaEntreContas;
      dados = {
        idPlanoContas: idPlano,
        modalidadeMovimento
      };
    }

    handleConcilia(dados);
    onClose();
  };

  const renderCampos = () => {
    if (modalidadeMovimento=== 'padrao') {
      return (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div ref={planoRef} className="relative mb-4">
              <label>
                Plano de Contas <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  placeholder="Pesquisar plano de contas..."
                  value={searchPlano}
                  onChange={handleSearchPlano}
                />
                <FontAwesomeIcon icon={faSearch} className="absolute right-3 top-3 text-gray-400" />
              </div>
              {showSuggestions && (
                <ul className="absolute bg-white w-full border shadow-lg rounded mt-1 z-10">
                  {filteredPlanos.map((plano) => (
                    <li key={plano.id} className="p-2 hover:bg-gray-200 text-sm cursor-pointer" onClick={() => selectPlano(plano)}>
                      {plano.hierarquia} | {plano.descricao}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pessoa <span className="text-gray-500">(opcional)</span>
              </label>
              <select
                name="pessoaSelecionada"
                className="w-full p-2 border border-gray-300 rounded"
                value={formData.pessoaSelecionada}
                onChange={handleInputChange}
                
              >
                <option value="">Selecione uma pessoa</option>
                {pessoas.map((pessoa) => (
                  <option key={pessoa.id} value={pessoa.id}>
                    {pessoa.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      );
    }

    if (modalidadeMovimento=== 'financiamento') {
      return (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label>Plano de Contas</label>
              <input type="text" value={nomePlanoFinanciamento} readOnly className="w-full border p-2 rounded bg-gray-100 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número do Documento <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                className="w-full border p-2 rounded"
              />
              {errors.numeroDocumento && <p className="text-red-500 text-xs col-span-2">{errors.numeroDocumento}</p>}

            </div>

            {/* Banco */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Banco <span className="text-gray-500">(opcional)</span>
              </label>
              <select
                name="bancoSelecionado"
                className="w-full p-2 border border-gray-300 rounded"
                value={formData.bancoSelecionado}
                onChange={handleInputChange}
                disabled={!!formData.pessoaSelecionada}
              >
                <option value="">Selecione um banco</option>
                {bancos.map((banco) => (
                  <option key={banco.id} value={banco.id}>
                    {banco.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Pessoa */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pessoa <span className="text-gray-500">(opcional)</span>
              </label>
              <select
                name="pessoaSelecionada"
                className="w-full p-2 border border-gray-300 rounded"
                value={formData.pessoaSelecionada}
                onChange={handleInputChange}
                disabled={!!formData.bancoSelecionado}
              >
                <option value="">Selecione uma pessoa</option>
                {pessoas.map((pessoa) => (
                  <option key={pessoa.id} value={pessoa.id}>
                    {pessoa.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Validação de Banco/Pessoa */}
            {errors.bancoPessoa && <p className="text-red-500 text-xs col-span-2">{errors.bancoPessoa}</p>}

            {/* Switch Parcelado */}
            <div className="flex items-start flex-col gap-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Este movimento é parcelado?
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={parcelado} onChange={() => setParcelado(!parcelado)} />
                <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-orange-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
              </label>
            </div>

            {parcelado && (
              <div className="mt-2 pt-2 border-t">
                <label>Número de Parcelas</label>
                <input
                  type="number"
                  min="1"
                  value={numParcelas}
                  onChange={(e) => setNumParcelas(parseInt(e.target.value))}
                  className="w-full p-2 border rounded"
                />
                {parcelas.length > 0 && (
                  <table className="w-full text-left border-collapse mt-2">
                    <thead>
                      <tr className="bg-gray-200">
                        <th className="p-2">Parcela</th>
                        <th className="p-2">Vencimento</th>
                        <th className="p-2">Valor R$</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parcelas.map((parcela, index) => (
                        <tr key={index}>
                          <td className="p-2">
                            {parcela.numParcela}/{numParcelas}
                          </td>
                          <td className="p-2">
                            <input
                              type="date"
                              value={parcela.dt_vencimento}
                              onChange={(e) => {
                                const novasParcelas = [...parcelas];
                                novasParcelas[index].dt_vencimento = e.target.value;
                                setParcelas(novasParcelas);
                              }}
                              className="w-full p-1 border rounded"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={parcela.valor}
                              onChange={(e) => {
                                const novasParcelas = [...parcelas];
                                novasParcelas[index].valor = e.target.value;
                                setParcelas(novasParcelas);
                              }}
                              className="w-full p-1 border rounded"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </>
      );
    }

    if (modalidadeMovimento=== 'transferencia') {
      return (
        <div className="flex flex-col items-center text-center text-yellow-600 mt-10 mb-10">
          <FontAwesomeIcon icon={faMoneyBillTransfer} size="3x" />
          <p className="mt-2 font-medium">
            Mera transferência entre contas próprias da Fazenda <br />
            na qual será ignorada no Fluxo de Caixa!
          </p>
        </div>
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      shouldCloseOnOverlayClick={false}
      className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-auto z-100"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-100"
    >
      <div className="flex justify-between items-center bg-red-50 px-4 py-3 rounded-t-lg border-b">
        <h2 className="text-xl font-semibold text-gray-800">Associação de Plano de Contas</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <FontAwesomeIcon icon={faTimes} size="xl" />
        </button>
      </div>

      <div className="p-4">
        {movimento && movimento.valor && (
          <div className="flex items-center justify-between border-gray-200 border text-gray-800 p-3 rounded-lg mb-4 shadow-sm text-sm">
            <span className="flex items-center gap-2 overflow-hidden">
              <span>{formatarData(movimento.dtMovimento)}</span>
              <span>|</span>
              <span className="truncate max-w-[360px]" title={movimento.historico}>
                {movimento.historico}
              </span>
            </span>
            <strong className={`${movimento.valor >= 0 ? "text-green-600" : "text-red-600"}`}>{formatarMoeda(movimento.valor)}</strong>
          </div>
        )}

        <div className="flex items-center justify-center mb-6 flex w-full justify-center rounded-lg border overflow-hidden">
          {['padrao', 'financiamento', 'transferencia'].map((tipo) => (
            <button
              key={tipo}
              onClick={() => setModalidadeMovimento(tipo)}
              disabled={tipo === 'financiamento' && movimento.tipoMovimento === 'D'}
              className={`px-4 flex-1 text-center text-lg py-1 font-semibold ${modalidadeMovimento=== tipo ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
            >
              {tipo === 'padrao' && 'Padrão'}
              {tipo === 'financiamento' && 'Financiamento'}
              {tipo === 'transferencia' && 'Transferência'}
            </button>
          ))}
        </div>

        {renderCampos()}

        <div className="flex justify-end mt-8 border-t pt-4">
          <button
            className="bg-red-500 text-white font-semibold px-5 py-2 rounded flex items-center gap-2 hover:bg-red-600"
            onClick={handleSalvar}
          >
            <FontAwesomeIcon icon={faSave} />
            Associar
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConciliaPlanoContasModal;
