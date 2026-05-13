import { 
  Brain, 
  Zap, 
  Activity, 
  ShieldCheck, 
  CheckCircle2, 
  Star, 
  ArrowRight, 
  ChevronDown, 
  Clock, 
  Truck, 
  CreditCard, 
  Lock,
  Menu,
  X,
  User,
  MapPin,
  Plus,
  Minus,
  Copy,
  Check,
  ChevronRight,
  Info,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, ChangeEvent } from 'react';
import { createPixCharge, getOrderStatus, type PixChargeResult } from './api/fruitfy';
import { useUrlTracking } from './context/UrlTrackingContext';
import { formatCep, formatCpf, formatPhoneBr, onlyDigits, validateCpf } from './lib/brFormat';

// --- Components ---

const Checkout = ({ selectedPlan, onBack }: { selectedPlan: any, onBack: () => void }) => {
  const { trackingParams } = useUrlTracking();
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [quantity, setQuantity] = useState(1);
  const [cep, setCep] = useState('');
  const [address, setAddress] = useState({
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: ''
  });
  const [customer, setCustomer] = useState({
    name: '',
    email: '',
    cpf: '',
    phone: ''
  });
  const [shippingMethod, setShippingMethod] = useState<'free' | 'sedex'>('free');
  const [loadingCep, setLoadingCep] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState<string | null>(null);
  const [pixData, setPixData] = useState<PixChargeResult | null>(null);
  const [orderPaid, setOrderPaid] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [cpfError, setCpfError] = useState<string | null>(null);

  const cepDigits = onlyDigits(cep, 8);

  const basePrice = parseFloat(selectedPlan.price.replace(',', '.'));
  const shippingPrice = shippingMethod === 'sedex' ? 18.75 : 0;
  const total = (basePrice * quantity) + shippingPrice;

  const handleCepChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    setCep(formatted);
    setCepError(null);
    const value = onlyDigits(formatted, 8);
    if (value.length < 8) {
      return;
    }
    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${value}/json/`);
      const data = await response.json();
      if (data.erro) {
        setCepError('CEP não encontrado. Verifique o número digitado.');
        return;
      }
      setAddress(prev => ({
        ...prev,
        street: data.logradouro ?? '',
        neighborhood: data.bairro ?? '',
        city: data.localidade ?? '',
        state: data.uf ?? '',
      }));
    } catch {
      setCepError('Não foi possível consultar o CEP. Tente novamente.');
    } finally {
      setLoadingCep(false);
    }
  };

  const pixCode = pixData?.pixCode ?? '';
  const qrSrc =
    pixData?.qrCodeBase64?.trim() ||
    (pixCode
      ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(pixCode)}`
      : '');

  const handleCopyPix = () => {
    if (!pixCode) return;
    void navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const paidAmountBrl =
    pixData != null
      ? (pixData.amountCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      : total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  useEffect(() => {
    if (step !== 'success' || !pixData?.orderId || orderPaid) return;
    let cancelled = false;
    const tick = async () => {
      const status = await getOrderStatus(pixData.orderId);
      if (cancelled) return;
      if (status === 'paid') setOrderPaid(true);
    };
    void tick();
    const id = window.setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [step, pixData?.orderId, orderPaid]);

  const handleFinalizePayment = async () => {
    setPixError(null);
    const name = customer.name.trim();
    const email = customer.email.trim();
    const phoneDigits = onlyDigits(customer.phone, 11);

    if (!name) {
      setPixError('Informe seu nome completo.');
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setPixError('Informe um e-mail válido.');
      return;
    }
    if (!validateCpf(customer.cpf)) {
      const msg = 'CPF inválido. Confira os dígitos ou os verificadores.';
      setCpfError(msg);
      setPixError(msg);
      return;
    }
    setCpfError(null);
    if (phoneDigits.length < 10) {
      setPixError('Informe um telefone com DDD (ex.: 11999999999).');
      return;
    }
    if (cepDigits.length !== 8) {
      const msg = 'Digite o CEP completo (8 dígitos).';
      setCepError(msg);
      setPixError(msg);
      return;
    }
    if (cepError) {
      setPixError(cepError);
      return;
    }
    if (!address.street.trim() || !address.number.trim()) {
      setPixError('Preencha rua e número do endereço.');
      return;
    }

    const amountCents = Math.round(total * 100);
    if (amountCents < 500) {
      setPixError('O valor mínimo para PIX é R$ 5,00.');
      return;
    }

    setPixLoading(true);
    try {
      const data = await createPixCharge({
        name,
        email,
        phone: customer.phone,
        cpf: customer.cpf,
        amountCents,
        urlParams: trackingParams,
      });
      setPixData(data);
      setOrderPaid(false);
      setStep('success');
      window.scrollTo(0, 0);
    } catch (e) {
      setPixError(e instanceof Error ? e.message : 'Erro ao gerar PIX. Tente novamente.');
    } finally {
      setPixLoading(false);
    }
  };

  const handleBackToStore = () => {
    setPixData(null);
    setOrderPaid(false);
    setPixError(null);
    onBack();
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-[40px] shadow-2xl overflow-hidden">
          <div className="bg-primary p-8 text-center text-white">
            <CheckCircle2 size={64} className="mx-auto mb-4" />
            <h2 className="text-3xl font-black mb-2">
              {orderPaid ? 'PAGAMENTO CONFIRMADO!' : 'PEDIDO RESERVADO!'}
            </h2>
            <p className="font-medium opacity-90">
              {orderPaid
                ? 'Obrigado! Seu PIX foi recebido e o pedido seguirá para separação.'
                : 'Finalize o pagamento via PIX para processarmos seu envio.'}
            </p>
          </div>
          
          <div className="p-8 text-center">
            {orderPaid && (
              <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-800">
                Pagamento identificado. Você receberá atualizações por e-mail.
              </div>
            )}
            <div className="mb-8">
              <p className="text-gray-600 mb-4 font-medium">Escaneie o QR Code abaixo:</p>
              <div className="bg-gray-100 p-4 rounded-3xl inline-block mb-4">
                {qrSrc ? (
                  <img src={qrSrc} alt="QR Code PIX" className="w-48 h-48 object-contain" />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-gray-400 text-sm">
                    Carregando QR…
                  </div>
                )}
              </div>
              
              <div className="max-w-md mx-auto">
                <p className="text-sm text-gray-500 mb-2">Ou copie o código abaixo:</p>
                <div className="flex gap-2">
                  <input 
                    readOnly 
                    value={pixCode}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs font-mono truncate"
                  />
                  <button 
                    type="button"
                    onClick={handleCopyPix}
                    disabled={!pixCode}
                    className="bg-primary text-white p-3 rounded-xl hover:bg-primary-dark transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {copied ? <Check size={20} /> : <Copy size={20} />}
                  </button>
                </div>
                {pixData?.expiresAt && (
                  <p className="text-xs text-gray-400 mt-2">
                    Código válido até {pixData.expiresAt}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4 text-left bg-purple-50 p-6 rounded-3xl border border-purple-100">
              <h4 className="font-black text-secondary flex items-center gap-2">
                <Info size={20} className="text-primary" />
                INSTRUÇÕES:
              </h4>
              <ul className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                <li>Abra o app do seu banco e escolha a opção <b>PIX</b>.</li>
                <li>Selecione <b>&quot;Ler QR Code&quot;</b> ou <b>&quot;PIX Copia e Cola&quot;</b>.</li>
                <li>Confira os dados e o valor de <b>R$ {paidAmountBrl}</b>.</li>
                <li>Após o pagamento, seu pedido será aprovado instantaneamente!</li>
              </ul>
            </div>

            <button 
              type="button"
              onClick={handleBackToStore}
              className="mt-8 text-primary font-bold hover:underline"
            >
              Voltar para a loja
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm py-4 sticky top-0 z-50">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <img 
            src="https://i.ibb.co/ZrXtP9h/logo-alwaysfit-1200x628.jpg" 
            alt="Always Fit Logo" 
            className="h-6 w-auto object-contain"
          />
          <div className="flex items-center gap-2 text-green-600 font-black text-sm">
            <Lock size={16} />
            CHECKOUT SEGURO
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Stepper */}
          <div className="flex items-center justify-between mb-8 max-w-xl mx-auto relative">
            <div className="absolute top-4 left-0 w-full h-px bg-gray-200 -z-10" />
            
            <div className="flex flex-col items-center gap-1.5 bg-gray-50 px-3">
              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-black shadow-lg shadow-primary/20">1</div>
              <span className="text-[9px] font-black text-primary uppercase tracking-widest">Identificação</span>
            </div>

            <div className="flex flex-col items-center gap-1.5 bg-gray-50 px-3">
              <div className="w-8 h-8 bg-gray-300 text-white rounded-full flex items-center justify-center text-sm font-black">2</div>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Entrega</span>
            </div>

            <div className="flex flex-col items-center gap-1.5 bg-gray-50 px-3">
              <div className="w-8 h-8 bg-gray-300 text-white rounded-full flex items-center justify-center text-sm font-black">3</div>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Pagamento</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left Column: Forms */}
            <div className="space-y-6">
              {/* Product Summary - Image Layout */}
              <div className="bg-white rounded-3xl p-5 lg:p-6 shadow-sm border border-gray-100">
                <div className="flex gap-5 items-center">
                  <div className="w-20 h-20 lg:w-32 lg:h-32 bg-gray-50 rounded-2xl p-2 lg:p-3 flex items-center justify-center border border-gray-100 flex-shrink-0">
                    <img 
                      src={selectedPlan.img} 
                      alt={selectedPlan.name} 
                      className="max-h-full object-contain drop-shadow-lg" 
                    />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-1 mb-3">
                      <div>
                        <h4 className="text-base lg:text-xl font-black text-secondary leading-tight mb-0.5 uppercase">
                          {selectedPlan.bottles} {selectedPlan.bottles === 1 ? 'Pote' : 'Potes'}
                        </h4>
                        <p className="text-primary font-black text-[10px] lg:text-xs uppercase italic">
                          Tratamento para{' '}
                          {selectedPlan.bottles * quantity}{' '}
                          {selectedPlan.bottles * quantity === 1 ? 'mês' : 'meses'}{' '}
                          ({selectedPlan.bottles * quantity * 30} dias)
                        </p>
                      </div>
                      
                      <div className="flex flex-row lg:flex-col items-baseline lg:items-end gap-2 lg:gap-0">
                        <span className="text-gray-300 line-through text-[10px] lg:text-xs font-bold">
                          R$ {(parseFloat(selectedPlan.price.replace(',', '.')) * 2.5 * quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-xl lg:text-3xl font-black text-secondary italic">
                          R$ {(parseFloat(selectedPlan.price.replace(',', '.')) * quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="hidden sm:inline text-[10px] font-black text-secondary uppercase tracking-tighter">Quantidade</span>
                      <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                        <button 
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center font-black text-secondary text-sm">{quantity}</span>
                        <button 
                          onClick={() => setQuantity(quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer Data */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-base font-black text-secondary mb-4 flex items-center gap-2">
                <div className="w-7 h-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center text-xs">2</div>
                DADOS PESSOAIS
              </h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-widest">Nome Completo</label>
                  <input 
                    type="text" 
                    placeholder="Seu nome completo"
                    className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    value={customer.name}
                    onChange={(e) => setCustomer({...customer, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-widest">E-mail</label>
                  <input 
                    type="email" 
                    placeholder="exemplo@email.com"
                    className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    value={customer.email}
                    onChange={(e) => setCustomer({...customer, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-widest">CPF</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="000.000.000-00"
                    className={`w-full bg-gray-50 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all ${
                      cpfError ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-100'
                    }`}
                    value={customer.cpf}
                    onChange={(e) => {
                      setCpfError(null);
                      setCustomer({ ...customer, cpf: formatCpf(e.target.value) });
                    }}
                    onBlur={() => {
                      const d = onlyDigits(customer.cpf, 11);
                      if (d.length === 0) return;
                      if (d.length < 11 || !validateCpf(customer.cpf)) {
                        setCpfError('CPF inválido. Confira os dígitos ou os verificadores.');
                      }
                    }}
                  />
                  {cpfError && (
                    <p className="text-[11px] font-bold text-red-600 mt-1">{cpfError}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-widest">WhatsApp / Celular</label>
                  <input 
                    type="tel" 
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="(11) 99999-9999"
                    className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    value={customer.phone}
                    onChange={(e) =>
                      setCustomer({ ...customer, phone: formatPhoneBr(e.target.value) })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Delivery Data */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-base font-black text-secondary mb-4 flex items-center gap-2">
                <div className="w-7 h-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center text-xs">3</div>
                ENDEREÇO DE ENTREGA
              </h3>
              <div className="grid md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-widest">CEP</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      inputMode="numeric"
                      autoComplete="postal-code"
                      placeholder="00000-000"
                      className={`w-full bg-gray-50 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all ${
                        cepError ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-100'
                      }`}
                      value={cep}
                      onChange={handleCepChange}
                    />
                    {loadingCep && <div className="absolute right-2 top-2.5 animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>}
                  </div>
                  {cepError && (
                    <p className="text-[11px] font-bold text-red-600 mt-1">{cepError}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-widest">Rua / Logradouro</label>
                  <input 
                    type="text" 
                    placeholder="Nome da rua"
                    className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    value={address.street}
                    onChange={(e) => setAddress({...address, street: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-widest">Número</label>
                  <input 
                    type="text" 
                    placeholder="123"
                    className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    value={address.number}
                    onChange={(e) => setAddress({...address, number: e.target.value})}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-widest">Complemento</label>
                  <input 
                    type="text" 
                    placeholder="Apto, Bloco, etc"
                    className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    value={address.complement}
                    onChange={(e) => setAddress({...address, complement: e.target.value})}
                  />
                </div>
              </div>

              {cepDigits.length === 8 && !cepError && (
                <div className="mt-8 space-y-3">
                  <label className="block text-xs font-black text-gray-400 mb-1 uppercase tracking-widest">Opções de Frete</label>
                  <button 
                    onClick={() => setShippingMethod('free')}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${shippingMethod === 'free' ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200'}`}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${shippingMethod === 'free' ? 'border-primary' : 'border-gray-300'}`}>
                        {shippingMethod === 'free' && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                      </div>
                      <div>
                        <p className="font-black text-secondary text-sm">FRETE GRÁTIS</p>
                        <p className="text-xs text-gray-500">Entrega em 7 a 10 dias úteis</p>
                      </div>
                    </div>
                    <span className="font-black text-green-600 text-sm">GRÁTIS</span>
                  </button>

                  <button 
                    onClick={() => setShippingMethod('sedex')}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${shippingMethod === 'sedex' ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200'}`}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${shippingMethod === 'sedex' ? 'border-primary' : 'border-gray-300'}`}>
                        {shippingMethod === 'sedex' && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                      </div>
                      <div>
                        <p className="font-black text-secondary text-sm">FRETE SEDEX</p>
                        <p className="text-xs text-gray-500">Entrega em 2 a 3 dias úteis</p>
                      </div>
                    </div>
                    <span className="font-black text-secondary text-sm">R$ 18,75</span>
                  </button>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2.5 mb-5">
                <CreditCard className="text-primary" size={20} />
                <h3 className="text-lg font-black text-secondary italic uppercase tracking-tight">FORMA DE PAGAMENTO</h3>
              </div>
              
              <div className="p-5 rounded-2xl border-2 border-primary bg-white relative overflow-hidden">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full border-2 border-primary flex items-center justify-center flex-shrink-0">
                      <div className="w-3.5 h-3.5 rounded-full bg-primary" />
                    </div>
                    <div>
                      <p className="font-black text-secondary text-base">PIX (Aprovação Imediata)</p>
                      <p className="text-primary font-black text-[10px] uppercase tracking-wider">LIBERAÇÃO INSTANTÂNEA DO PEDIDO</p>
                    </div>
                  </div>
                  
                  <div className="hidden sm:flex items-center gap-2 bg-green-50 border border-green-100 px-2.5 py-1 rounded-lg">
                    <img src="https://logopng.com.br/logos/pix-106.png" alt="PIX" className="w-3.5 h-3.5 object-contain" />
                    <span className="text-green-700 font-black text-[10px]">PIX</span>
                  </div>
                </div>
                
                {/* Subtle background icon */}
                <div className="absolute -right-3 -bottom-3 opacity-5 transform -rotate-12">
                  <img src="https://logopng.com.br/logos/pix-106.png" alt="PIX" className="w-20 h-20 object-contain" />
                </div>
              </div>

              <div className="mt-3.5 bg-gray-50 p-3.5 rounded-xl flex items-start gap-2.5 border border-gray-100">
                <Zap size={16} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                  <span className="font-black text-secondary">DICA:</span> O pagamento via PIX é processado na hora e garante que seu pedido seja enviado ainda hoje.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Summary & Button */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 lg:p-7 shadow-xl border border-gray-100 lg:sticky lg:top-24">
              <h3 className="text-base font-black text-secondary italic uppercase tracking-tight mb-5 border-b border-gray-100 pb-3">RESUMO DO PEDIDO</h3>
              
              <div className="flex items-center gap-3.5 mb-6">
                <div className="w-16 h-16 bg-gray-50 rounded-xl p-1.5 flex items-center justify-center border border-gray-100 flex-shrink-0">
                  <img src={selectedPlan.img} alt={selectedPlan.name} className="max-h-full object-contain" />
                </div>
                <div>
                  <h4 className="font-black text-secondary text-base uppercase leading-none mb-0.5">{selectedPlan.bottles} {selectedPlan.bottles === 1 ? 'POTE' : 'POTES'}</h4>
                  <p className="text-gray-400 text-xs font-medium">Fórmula Original Always Fit</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-500 font-medium text-sm">
                  <span>Subtotal ({quantity}x)</span>
                  <span className="text-secondary font-black">R$ {(basePrice * quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-gray-500 font-medium text-sm">
                  <span>Frete</span>
                  {shippingMethod === 'free' ? (
                    <span className="text-green-600 font-black uppercase">GRÁTIS</span>
                  ) : (
                    <span className="text-secondary font-black">R$ {shippingPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  )}
                </div>
                <div className="flex justify-between text-gray-500 font-medium text-sm">
                  <span>Adicionais</span>
                  <span className="text-secondary font-black">R$ 0,00</span>
                </div>
                
                <div className="h-px bg-gray-100 my-5" />
                
                <div className="flex justify-between items-center">
                  <span className="text-lg font-black text-secondary uppercase">TOTAL</span>
                  <span className="text-2xl font-black text-primary italic">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {pixError && (
                <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-700">
                  {pixError}
                </p>
              )}

              <button 
                type="button"
                onClick={() => void handleFinalizePayment()}
                disabled={pixLoading}
                className="w-full bg-green-600 text-white py-4 rounded-xl font-black text-lg shadow-xl shadow-green-600/20 hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2 group disabled:opacity-60 disabled:pointer-events-none"
              >
                {pixLoading ? (
                  <>
                    <Loader2 size={22} className="animate-spin" />
                    GERANDO PIX…
                  </>
                ) : (
                  <>
                    FINALIZAR PAGAMENTO
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
    </div>
  );
};

// --- Components ---

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { hrefWithParams } = useUrlTracking();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white shadow-md py-3">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center">
          <img 
            src="https://i.ibb.co/ZrXtP9h/logo-alwaysfit-1200x628.jpg" 
            alt="Always Fit Logo" 
            className="h-6 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        
        <div className="hidden md:flex items-center gap-8">
          <a href={hrefWithParams('#beneficios')} className="font-medium text-sm text-gray-600 hover:text-primary transition-colors">Benefícios</a>
          <a href={hrefWithParams('#formula')} className="font-medium text-sm text-gray-600 hover:text-primary transition-colors">Fórmula</a>
          <a href={hrefWithParams('#depoimentos')} className="font-medium text-sm text-gray-600 hover:text-primary transition-colors">Resultados</a>
          <a href={hrefWithParams('#ofertas')} className="bg-primary text-white px-5 py-1.5 rounded-full font-bold text-sm hover:bg-primary-dark transition-all shadow-lg hover:shadow-primary/30">COMPRAR AGORA</a>
        </div>

        <button className="md:hidden text-primary" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X size={28} /> : <Menu size={28} className="text-primary" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-100 overflow-hidden"
          >
            <div className="flex flex-col p-4 gap-4">
              <a href={hrefWithParams('#beneficios')} onClick={() => setIsMenuOpen(false)} className="text-gray-600 font-medium text-sm">Benefícios</a>
              <a href={hrefWithParams('#formula')} onClick={() => setIsMenuOpen(false)} className="text-gray-600 font-medium text-sm">Fórmula</a>
              <a href={hrefWithParams('#depoimentos')} onClick={() => setIsMenuOpen(false)} className="text-gray-600 font-medium text-sm">Resultados</a>
              <a href={hrefWithParams('#ofertas')} onClick={() => setIsMenuOpen(false)} className="bg-primary text-white text-center py-2.5 rounded-lg font-bold text-sm">COMPRAR AGORA</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Hero = () => {
  const { hrefWithParams } = useUrlTracking();

  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden bg-secondary">
      {/* Background elements */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-primary/10 skew-x-12 transform translate-x-20 z-0 hidden lg:block"></div>
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl"></div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center lg:text-left"
          >
            <div className="inline-flex items-center gap-2 bg-primary/20 text-primary px-4 py-1 rounded-full text-sm font-bold mb-6 border border-primary/30">
              <ShieldCheck size={16} />
              COMPLEXO B CONCENTRADO
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-white leading-tight mb-6">
              MAIS <span className="text-primary">ENERGIA E FOCO</span> COM O PODER DAS VITAMINAS B
            </h1>
            <div className="mb-8 flex justify-center lg:justify-start">
              <img 
                src="https://i.ibb.co/43zdFbY/image.png" 
                alt="Benefícios Complexo B" 
                className="w-full max-w-md rounded-2xl shadow-2xl border border-white/10"
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="text-base sm:text-lg text-gray-300 mb-8 max-w-lg mx-auto lg:mx-0">
              Aumente sua disposição, melhore o funcionamento do sistema nervoso e fortaleça sua imunidade com a combinação ideal de B6, B9 e B12.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a href={hrefWithParams('#ofertas')} className="bg-primary text-white px-8 py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 hover:bg-primary-dark transition-all shadow-xl shadow-primary/20 group">
                QUERO MEU COMPLEXO B AGORA
                <ArrowRight className="group-hover:translate-x-1 transition-transform" />
              </a>
              <div className="flex items-center gap-3 px-4 py-2">
                <div className="flex -space-x-2">
                  {[1,2,3].map(i => (
                    <img key={i} src={`https://i.pravatar.cc/100?img=${i+10}`} alt="User" className="w-8 h-8 rounded-full border-2 border-secondary" />
                  ))}
                </div>
                <div className="text-sm">
                  <div className="flex text-yellow-500">
                    {[1,2,3,4,5].map(i => <Star key={i} size={12} fill="currentColor" />)}
                  </div>
                  <span className="text-gray-400">+15.000 clientes satisfeitos</span>
                </div>
              </div>
            </div>

            <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex flex-col items-center sm:items-start gap-1">
                <span className="text-primary font-bold text-xl">100%</span>
                <span className="text-gray-400 text-xs uppercase tracking-wider">Natural</span>
              </div>
              <div className="flex flex-col items-center sm:items-start gap-1">
                <span className="text-primary font-bold text-xl">ANVISA</span>
                <span className="text-gray-400 text-xs uppercase tracking-wider">Aprovado</span>
              </div>
              <div className="flex flex-col items-center sm:items-start gap-1">
                <span className="text-primary font-bold text-xl">FRETE</span>
                <span className="text-gray-400 text-xs uppercase tracking-wider">Grátis*</span>
              </div>
              <div className="flex flex-col items-center sm:items-start gap-1">
                <span className="text-primary font-bold text-xl">60</span>
                <span className="text-gray-400 text-xs uppercase tracking-wider">Cápsulas</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative flex justify-center"
          >
            {/* Floating badges */}
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute top-10 -left-10 bg-white p-4 rounded-2xl shadow-2xl z-20 hidden md:block"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
                  <Brain size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase">Sistema Nervoso</p>
                  <p className="text-sm font-black text-secondary">Saúde Cerebral</p>
                </div>
              </div>
            </motion.div>

            <motion.div 
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 4, repeat: Infinity, delay: 0.5 }}
              className="absolute bottom-20 -right-10 bg-white p-4 rounded-2xl shadow-2xl z-20 hidden md:block"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
                  <Zap size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase">Metabolismo</p>
                  <p className="text-sm font-black text-secondary">Energia Vital</p>
                </div>
              </div>
            </motion.div>

            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl transform scale-150"></div>
              <img 
                src="https://i.ibb.co/FqjV0xXY/image.png" 
                alt="Complexo B Always Fit" 
                className="relative z-10 w-full max-w-md rounded-3xl shadow-2xl border border-white/10"
                referrerPolicy="no-referrer"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const Benefits = () => {
  const benefits = [
    {
      icon: <Zap className="text-primary" size={32} />,
      title: "ENERGIA",
      desc: "As vitaminas do complexo B são essenciais para converter alimentos em energia, combatendo o cansaço e a fadiga diária."
    },
    {
      icon: <Brain className="text-primary" size={32} />,
      title: "SISTEMA NERVOSO",
      desc: "Auxilia na manutenção da saúde do sistema nervoso, melhorando a função cognitiva e o equilíbrio emocional."
    },
    {
      icon: <Activity className="text-primary" size={32} />,
      title: "IMUNIDADE",
      desc: "Fortalece as defesas naturais do organismo, auxiliando na produção de células de defesa e anticorpos."
    },
    {
      icon: <ShieldCheck className="text-primary" size={32} />,
      title: "SANGUE",
      desc: "A vitamina B12 e o ácido fólico (B9) são fundamentais para a formação de glóbulos vermelhos saudáveis."
    }
  ];

  return (
    <section id="beneficios" className="py-24 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-primary font-black tracking-widest text-sm mb-4 uppercase">POR QUE ESCOLHER O COMPLEXO B?</h2>
          <h3 className="text-2xl sm:text-3xl md:text-5xl font-black text-secondary mb-6">VITALIDADE COMPLETA PARA O SEU DIA</h3>
          <p className="text-gray-600 text-lg">Nossa fórmula exclusiva combina as vitaminas B mais importantes em concentrações ideais para máxima absorção e resultados reais.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {benefits.map((b, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -10 }}
              className="bg-gray-50 p-8 rounded-3xl border border-gray-100 hover:border-primary/30 transition-all hover:shadow-xl hover:shadow-primary/5"
            >
              <div className="mb-6 bg-white w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm">
                {b.icon}
              </div>
              <h4 className="text-xl font-black text-secondary mb-4">{b.title}</h4>
              <p className="text-gray-600 leading-relaxed">{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Formula = () => {
  return (
    <section id="formula" className="py-24 bg-secondary text-white overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-white to-transparent opacity-5"></div>
      
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1">
            <h2 className="text-primary font-black tracking-widest text-sm mb-4 uppercase text-center">A CIÊNCIA POR TRÁS</h2>
            <h3 className="text-2xl sm:text-3xl md:text-5xl font-black mb-8 leading-tight text-center">UMA FÓRMULA <span className="text-primary">COMPLETA E BALANCEADA</span></h3>
            
            <div className="space-y-8">
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary flex items-center justify-center font-black text-xl">1</div>
                <div>
                  <h4 className="text-xl font-bold mb-2">Vitamina B12 (Metilcobalamina)</h4>
                  <p className="text-gray-400">Essencial para a formação de glóbulos vermelhos e para o funcionamento saudável do sistema nervoso e do cérebro.</p>
                </div>
              </div>
              
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary flex items-center justify-center font-black text-xl">2</div>
                <div>
                  <h4 className="text-xl font-bold mb-2">Vitamina B6 (Piridoxina)</h4>
                  <p className="text-gray-400">Importante para o metabolismo de proteínas e gorduras, além de auxiliar na produção de neurotransmissores como a serotonina.</p>
                </div>
              </div>
              
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary flex items-center justify-center font-black text-xl">3</div>
                <div>
                  <h4 className="text-xl font-bold mb-2">Vitamina B9 (Ácido Fólico)</h4>
                  <p className="text-gray-400">Crucial para o crescimento celular e a formação do DNA, sendo vital para a saúde cardiovascular e imunológica.</p>
                </div>
              </div>
            </div>

            <div className="mt-12 p-6 bg-white/5 rounded-2xl border border-white/10">
              <p className="italic text-gray-300">"O complexo B é a base da energia celular. Sem estas vitaminas, o corpo não consegue funcionar em sua capacidade máxima."</p>
              <p className="mt-4 font-bold text-primary">— Dra. Ana Souza, Nutricionista Clínica</p>
            </div>
          </div>

          <div className="order-1 lg:order-2 relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-[120px]"></div>
            <img 
              src="https://i.ibb.co/sdgn3wHN/image.png" 
              alt="Fórmula Complexo B" 
              className="relative z-10 w-full max-w-md mx-auto drop-shadow-2xl"
              referrerPolicy="no-referrer"
            />
            
            {/* Stats Overlay */}
            <div className="absolute top-1/2 -right-4 transform -translate-y-1/2 space-y-4 hidden sm:block">
              <div className="bg-white p-4 rounded-xl shadow-xl text-secondary">
                <p className="text-xs font-bold text-gray-400 uppercase">Absorção</p>
                <p className="text-2xl font-black text-primary">98%</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-xl text-secondary">
                <p className="text-xs font-bold text-gray-400 uppercase">Pureza</p>
                <p className="text-2xl font-black text-primary">100%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Pricing = ({ onSelectPlan }: { onSelectPlan: (plan: any) => void }) => {
  const plans = [
    {
      bottles: 1,
      name: "TRATAMENTO INICIAL",
      price: "34,90",
      installments: "Tratamento para 1 mês",
      discount: "0%",
      popular: false,
      shipping: "Frete Pago",
      cta: "COMPRAR 1 POTE",
      img: "https://i.ibb.co/C52fPNY6/image.png"
    },
    {
      bottles: 2,
      name: "TRATAMENTO RECOMENDADO",
      price: "49,90",
      installments: "Tratamento para 2 meses",
      discount: "29% OFF",
      popular: false,
      shipping: "Frete Grátis",
      cta: "COMPRAR 2 POTES",
      img: "https://i.ibb.co/hxXPyx06/image.png"
    },
    {
      bottles: 3,
      name: "MÁXIMO RESULTADO",
      price: "59,90",
      installments: "Tratamento para 3 meses",
      discount: "43% OFF",
      popular: true,
      shipping: "Frete Grátis",
      cta: "COMPRAR 3 POTES",
      img: "https://i.ibb.co/VcXkNmrQ/image.png"
    }
  ];

  return (
    <section id="ofertas" className="py-24 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-primary font-black tracking-widest text-sm mb-4 uppercase">OFERTAS EXCLUSIVAS</h2>
          <h3 className="text-2xl sm:text-3xl md:text-5xl font-black text-secondary mb-6">ESCOLHA O MELHOR KIT PARA VOCÊ</h3>
          <p className="text-gray-600 text-lg">Aproveite nossos descontos progressivos e garanta seu estoque com o melhor preço do mercado.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((p, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -10 }}
              className={`relative bg-white rounded-[40px] p-8 shadow-xl border-2 transition-all ${p.popular ? 'border-primary scale-105 z-10' : 'border-transparent'}`}
            >
              {p.popular && (
                <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-primary text-white px-6 py-1 rounded-full text-sm font-black shadow-lg">
                  MAIS VENDIDO
                </div>
              )}
              
              <div className="text-center mb-8">
                <span className="inline-block bg-gray-100 text-gray-500 px-4 py-1 rounded-full text-xs font-bold mb-4">{p.name}</span>
                <h4 className="text-2xl font-black text-secondary mb-2">{p.bottles} {p.bottles === 1 ? 'POTE' : 'POTES'}</h4>
                <div className="flex justify-center items-center gap-2 mb-4">
                  <span className="text-primary font-black text-4xl">R$ {p.price}</span>
                  <span className="bg-green-100 text-green-600 px-2 py-1 rounded-lg text-xs font-bold">{p.discount}</span>
                </div>
                <p className="text-gray-500 font-medium">{p.installments}</p>
              </div>

              <div className="flex justify-center mb-8">
                <img 
                  src={p.img} 
                  alt={`${p.bottles} potes`} 
                  className={`object-contain transition-transform ${p.bottles === 2 ? 'h-60 scale-110' : 'h-48'} ${p.bottles > 1 ? 'drop-shadow-2xl' : ''}`}
                  referrerPolicy="no-referrer"
                />
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-sm font-medium text-gray-600">
                  <CheckCircle2 className="text-primary" size={18} />
                  {p.bottles * 60} Cápsulas no total
                </li>
                <li className="flex items-center gap-3 text-sm font-medium text-gray-600">
                  <CheckCircle2 className="text-primary" size={18} />
                  {p.shipping}
                </li>
                <li className="flex items-center gap-3 text-sm font-medium text-gray-600">
                  <CheckCircle2 className="text-primary" size={18} />
                  Garantia de 30 dias
                </li>
              </ul>

              <button 
                onClick={() => onSelectPlan(p)}
                className={`w-full py-4 rounded-2xl font-black text-lg shadow-lg transition-all ${p.popular ? 'bg-primary text-white hover:bg-primary-dark shadow-primary/20' : 'bg-secondary text-white hover:bg-black shadow-secondary/20'}`}
              >
                {p.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Testimonials = () => {
  const reviews = [
    {
      name: "Ricardo Mendes",
      role: "Programador",
      text: "Eu vivia cansado e com dificuldade de foco. Depois que comecei o Complexo B da Always Fit, sinto uma disposição mental que não tinha há anos.",
      img: "https://i.pravatar.cc/100?img=11"
    },
    {
      name: "Beatriz Santos",
      role: "Professora",
      text: "Minha imunidade estava sempre baixa. Este suplemento me ajudou a sentir mais forte e com muito mais energia para dar minhas aulas.",
      img: "https://i.pravatar.cc/100?img=25"
    },
    {
      name: "André Luiz",
      role: "Estudante",
      text: "O melhor custo-benefício que encontrei. Sinto que meu raciocínio está mais rápido e não fico mais exausto no fim do dia.",
      img: "https://i.pravatar.cc/100?img=32"
    }
  ];

  return (
    <section id="depoimentos" className="py-24 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-primary font-black tracking-widest text-sm mb-4 uppercase">RESULTADOS REAIS</h2>
          <h3 className="text-2xl sm:text-3xl md:text-5xl font-black text-secondary mb-6">O QUE NOSSOS CLIENTES DIZEM</h3>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {reviews.map((r, i) => (
            <div key={i} className="bg-gray-50 p-8 rounded-3xl relative">
              <div className="flex text-yellow-500 mb-6">
                {[1,2,3,4,5].map(i => <Star key={i} size={16} fill="currentColor" />)}
              </div>
              <p className="text-gray-600 italic mb-8">"{r.text}"</p>
              <div className="flex items-center gap-4">
                <img src={r.img} alt={r.name} className="w-12 h-12 rounded-full border-2 border-primary" />
                <div>
                  <p className="font-black text-secondary">{r.name}</p>
                  <p className="text-xs text-gray-400 uppercase font-bold">{r.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Guarantee = () => {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto bg-gray-50 rounded-3xl md:rounded-[50px] p-6 md:p-16 flex flex-col items-center gap-8 border border-gray-100 text-center relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1 rounded-full text-xs font-black mb-4 uppercase tracking-widest">
              Garantia de Satisfação
            </div>
            <h3 className="text-2xl sm:text-3xl md:text-5xl font-black text-secondary mb-6 leading-tight">
              RISCO ZERO: <span className="text-primary">30 DIAS</span> DE GARANTIA TOTAL
            </h3>
            <p className="text-gray-600 text-base md:text-xl mb-8 leading-relaxed">
              Temos tanta confiança na eficácia do <span className="font-bold text-secondary">Complexo B Always Fit</span> que o risco é todo nosso. Se em até 30 dias você não sentir os benefícios reais em sua energia e bem-estar, basta nos enviar um e-mail. 
              <span className="block mt-4 font-bold text-secondary">Nós devolvemos 100% do seu investimento. Sem perguntas, sem letras miúdas.</span>
            </p>
            <div className="flex flex-wrap justify-center md:justify-start gap-6">
              <div className="flex items-center gap-3 text-secondary font-black bg-white px-6 py-3 rounded-2xl shadow-sm border border-gray-100">
                <ShieldCheck className="text-primary" size={24} />
                Compra 100% Segura
              </div>
              <div className="flex items-center gap-3 text-secondary font-black bg-white px-6 py-3 rounded-2xl shadow-sm border border-gray-100">
                <Lock className="text-primary" size={24} />
                Privacidade Protegida
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const questions = [
    {
      q: "Como devo tomar o Complexo B?",
      a: "Recomenda-se a ingestão de 1 cápsula ao dia, preferencialmente após a principal refeição ou conforme orientação de um profissional."
    },
    {
      q: "Em quanto tempo vejo os resultados?",
      a: "A melhoria nos níveis de energia costuma ser percebida nas primeiras semanas de uso contínuo."
    },
    {
      q: "Existem contraindicações?",
      a: "O Complexo B é um suplemento natural. Gestantes, lactantes e crianças devem consultar um médico antes de consumir."
    },
    {
      q: "O produto é aprovado pela ANVISA?",
      a: "Sim, nosso Complexo B é produzido seguindo todas as normas da ANVISA para suplementos alimentares."
    }
  ];

  return (
    <section className="py-24 bg-gray-50">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-16">
          <h3 className="text-2xl sm:text-3xl md:text-5xl font-black text-secondary mb-6">DÚVIDAS FREQUENTES</h3>
        </div>

        <div className="space-y-4">
          {questions.map((item, i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
              <button 
                className="w-full p-6 text-left flex justify-between items-center hover:bg-gray-50 transition-colors"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <span className="font-bold text-secondary">{item.q}</span>
                <ChevronDown className={`text-primary transition-transform ${openIndex === i ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-6 pt-0 text-gray-600 border-t border-gray-50">
                      {item.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  const { hrefWithParams } = useUrlTracking();

  return (
    <footer className="bg-secondary text-white pt-20 pb-10">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-2">
            <div className="flex items-center mb-6">
              <img 
                src="https://i.ibb.co/ZrXtP9h/logo-alwaysfit-1200x628.jpg" 
                alt="Always Fit Logo" 
                className="h-14 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="text-gray-400 max-w-md mb-8">
              A Always Fit é líder em suplementação de alta performance, focada em trazer fórmulas puras e eficazes para melhorar a qualidade de vida de milhares de brasileiros.
            </p>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary transition-colors cursor-pointer">
                <Star size={20} />
              </div>
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary transition-colors cursor-pointer">
                <Star size={20} />
              </div>
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary transition-colors cursor-pointer">
                <Star size={20} />
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-6">Links Úteis</h4>
            <ul className="space-y-4 text-gray-400">
              <li><a href={hrefWithParams('#beneficios')} className="hover:text-primary transition-colors">Benefícios</a></li>
              <li><a href={hrefWithParams('#formula')} className="hover:text-primary transition-colors">Fórmula</a></li>
              <li><a href={hrefWithParams('#ofertas')} className="hover:text-primary transition-colors">Ofertas</a></li>
              <li><a href={hrefWithParams('#')} className="hover:text-primary transition-colors">Rastrear Pedido</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6">Atendimento</h4>
            <ul className="space-y-4 text-gray-400">
              <li className="flex items-center gap-3">
                <Clock size={16} className="text-primary" />
                Seg a Sex: 09h às 18h
              </li>
              <li className="flex items-center gap-3">
                <Truck size={16} className="text-primary" />
                Envio para todo Brasil
              </li>
              <li className="flex items-center gap-3">
                <ShieldCheck size={16} className="text-primary" />
                Compra 100% Segura
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-10 text-center text-xs text-gray-500 space-y-4">
          <p>Copyright © 2026 ALWAYS FIT - Todos os direitos reservados.</p>
          <p className="max-w-4xl mx-auto">
            AVISO LEGAL: As informações contidas neste site não substituem o aconselhamento médico profissional. Sempre consulte seu médico antes de iniciar qualquer suplementação. Os resultados podem variar de pessoa para pessoa. Este produto não se destina a diagnosticar, tratar, curar ou prevenir qualquer doença.
          </p>
        </div>
      </div>
    </footer>
  );
};

// --- Main App ---

export default function App() {
  const [currentPage, setCurrentPage] = useState<'landing' | 'checkout'>('landing');
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  const handleSelectPlan = (plan: any) => {
    setSelectedPlan(plan);
    setCurrentPage('checkout');
    window.scrollTo(0, 0);
  };

  if (currentPage === 'checkout') {
    return <Checkout selectedPlan={selectedPlan} onBack={() => setCurrentPage('landing')} />;
  }

  return (
    <div className="min-h-screen selection:bg-primary selection:text-white">
      <Navbar />
      <main>
        <Hero />
        
        {/* Trust Bar */}
        <div className="bg-primary py-6 overflow-hidden">
          <div className="flex whitespace-nowrap animate-marquee">
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className="flex items-center gap-8 mx-8 text-white font-black text-sm uppercase tracking-widest">
                <Star size={16} fill="white" />
                FRETE GRÁTIS PARA TODO BRASIL
                <Star size={16} fill="white" />
                SATISFAÇÃO GARANTIDA OU SEU DINHEIRO DE VOLTA
              </div>
            ))}
          </div>
        </div>

        <Benefits />
        <Formula />
        
        {/* Nutritional Table */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 flex justify-center">
            <div className="max-w-4xl w-full">
              <h3 className="text-2xl sm:text-3xl md:text-5xl font-black text-secondary mb-12 text-center uppercase">TABELA NUTRICIONAL</h3>
              <img 
                src="https://i.ibb.co/ymYK5Hj2/image.png" 
                alt="Tabela Nutricional Complexo B" 
                className="w-full h-auto rounded-3xl shadow-xl"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </section>

        {/* Why Us Section */}
        <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-3 gap-12">
              <div className="flex flex-col items-center text-center p-8 bg-white rounded-3xl shadow-sm">
                <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-6">
                  <Truck size={32} />
                </div>
                <h4 className="text-xl font-black text-secondary mb-4">ENTREGA RÁPIDA</h4>
                <p className="text-gray-500">Enviamos seu pedido em até 24h úteis com código de rastreio em tempo real.</p>
              </div>
              <div className="flex flex-col items-center text-center p-8 bg-white rounded-3xl shadow-sm">
                <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-6">
                  <CreditCard size={32} />
                </div>
                <h4 className="text-xl font-black text-secondary mb-4">PAGAMENTO SEGURO</h4>
                <p className="text-gray-500">Ambiente criptografado e seguro. Aceitamos Cartão, Pix e Boleto.</p>
              </div>
              <div className="flex flex-col items-center text-center p-8 bg-white rounded-3xl shadow-sm">
                <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-6">
                  <Star size={32} />
                </div>
                <h4 className="text-xl font-black text-secondary mb-4">QUALIDADE PREMIUM</h4>
                <p className="text-gray-500">Matéria-prima importada com o mais alto grau de pureza farmacêutica.</p>
              </div>
            </div>
          </div>
        </section>

        <Testimonials />
        <Pricing onSelectPlan={handleSelectPlan} />
        <Guarantee />
        <FAQ />
      </main>
      <Footer />

      {/* Custom styles for marquee */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
}
