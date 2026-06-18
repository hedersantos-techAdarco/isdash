import React, { useState, useMemo, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie
} from 'recharts';
import { 
  Phone, PhoneCall, PhoneOutgoing, 
  TrendingUp, Users, CheckCircle2, XCircle, Search, Calendar,
  ChevronDown, ArrowUpRight, ArrowDownRight, Menu, X,
  RefreshCcw, Loader2, Sun, Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import Papa from 'papaparse';
import { CallRecord, TeamName } from './types.ts';
import { CONSULTANT_MAPPING } from './constants.ts';
import { cn, formatDuration } from './lib/utils.ts';

// --- Components ---

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: React.ElementType;
  trend?: number;
  colorClass?: "primary" | "secondary";
}

const StatCard = ({ title, value, subtext, icon: Icon, trend, colorClass = "primary" }: StatCardProps) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileHover={{ y: -4, transition: { duration: 0.2 } }}
    animate={{ opacity: 1, y: 0 }}
    className={cn(
      "bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-7 rounded-[1.25rem] shadow-soft border flex items-start justify-between transition-all hover:shadow-lg",
      colorClass === "primary" ? "border-adarco-light/30 dark:border-adarco-dark/30" : "border-slate-100/50 dark:border-slate-700/50"
    )}
  >
    <div className="flex flex-col h-full justify-between">
      <div>
        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">{title}</p>
        <h3 className={cn(
          "text-2xl md:text-3xl font-bold tracking-tight",
          colorClass === "primary" ? "text-adarco-dark dark:text-white" : "text-slate-800 dark:text-slate-100"
        )}>{value}</h3>
      </div>
      
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {trend !== undefined && (
          <span className={cn(
            "inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-lg",
            trend >= 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
          )}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
        {subtext && <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">{subtext}</p>}
      </div>
    </div>
    <div className={cn(
      "p-4 rounded-2xl",
      colorClass === "primary" ? "bg-adarco-soft dark:bg-adarco-dark/30" : "bg-slate-50 dark:bg-slate-700/50"
    )}>
      <Icon className={cn(
        "w-6 h-6",
        colorClass === "primary" ? "text-adarco-primary" : "text-slate-400 dark:text-slate-300"
      )} />
    </div>
  </motion.div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-800 p-3 border border-gray-100 dark:border-slate-700 shadow-xl rounded-lg">
        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-500 dark:text-gray-400">{entry.name}:</span>
            <span className="font-bold text-gray-900 dark:text-white">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  icon?: React.ElementType;
}

const FilterSelect = ({ label, value, onChange, options, icon: Icon }: FilterSelectProps) => (
  <div className="space-y-2">
    <p className="text-[10px] font-black text-white/50 pl-1 flex items-center gap-2 uppercase tracking-wider">
      {Icon && <Icon className="w-3 h-3" />} {label}
    </p>
    <div className="relative group">
      <select 
        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl py-3 pl-4 pr-10 text-sm font-bold appearance-none focus:ring-2 focus:ring-adarco-primary/20 focus:bg-[#004D2C] outline-none transition-all cursor-pointer text-white backdrop-blur-xl"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(opt => (
          <option key={opt.value} className="bg-[#004D2C] py-2" value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-hover:text-white/60 pointer-events-none transition-colors" />
    </div>
  </div>
);
const cleanName = (name: string) => name.replace(/\s*-\s*(INS|ATEND).*/i, '').trim();

// --- Main App ---

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [data, setData] = useState<CallRecord[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>('Todos');
  const [selectedConsultant, setSelectedConsultant] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pagError, setPagError] = useState<{
    message: string;
    detail: string;
    page: number;
    partialCount: number;
  } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const normalizeApiData = useCallback((rawCalls: any[]): CallRecord[] => {
    const seenUniqueIds = new Set<string>();
    
    return rawCalls
      .map((call: any): CallRecord | null => {
        // 1. Identificação Única
        const uniqueId = String(call.id || call.uniqueid || call.externalId || '');
        if (uniqueId && seenUniqueIds.has(uniqueId)) return null;
        if (uniqueId) seenUniqueIds.add(uniqueId);

        // 2. Extração de Ramal e Mapeamento de Time (Adarco Business Rule)
        // O usuário orientou extrair de 'origin'
        const rawOrigin = String(call.origin || '').trim();
        const rawDestiny = String(call.destiny || '').trim();
        
        // Identifica se é entrada ou saída para pegar o ramal interno correto
        const typeRaw = String(call.type || call.calltype || '').toUpperCase();
        const isIncoming = typeRaw === 'ENTRANTE' || typeRaw === 'ENTRADA' || typeRaw === 'INCOMING';
        
        const internalExtension = isIncoming ? rawDestiny : rawOrigin;
        const mapping = CONSULTANT_MAPPING[internalExtension];
        
        // Apenas Inside Sales (Time Débora/Marília)
        if (!mapping) return null;

        // 3. Normalização de Tipo/Direção
        let type = 'Ignorar';
        if (typeRaw === 'SAINTE' || typeRaw === 'SAÍDA' || typeRaw === 'OUTCOMING' || typeRaw === 'ATIVA') {
          type = 'Ativa';
        }

        if (type === 'Ignorar') return null;

        // 4. Duração e Status (KPI Efetividade: Atendida >= 20s)
        const duration = parseInt(call.duration) || 0;
        const rawDisposition = String(call.disposition || call.status || '').toUpperCase();
        const isAnswered = rawDisposition === 'ANSWERED' || rawDisposition === 'ANSWER' || rawDisposition === 'ATENDIDA';
        
        const status = (isAnswered && duration >= 20) ? 'Atendida' : 'Não Atendida';

        // 5. Data/Hora (Conversão ISO 8601)
        let timestampISO = '';
        try {
          const rawTs = call.createdAt || call.startDate || call.start_date || call.date;
          if (rawTs) {
            const d = new Date(rawTs);
            timestampISO = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
          } else {
            timestampISO = new Date().toISOString();
          }
        } catch (e) {
          timestampISO = new Date().toISOString();
        }

        // 6. Nome do Consultor e Limpeza
        const rawDisplayName = call.originDisplayName || call.destinyDisplayName || mapping.name;
        // O mapeamento CONSULTANT_MAPPING já contém o nome limpo no arquivo constants.ts
        // Mas vamos garantir a limpeza se vier da API
        let displayName = rawDisplayName ? cleanName(String(rawDisplayName)) : mapping.name;
        if (mapping.isSupervisor) {
          displayName = mapping.name;
        }

        return {
          id: uniqueId,
          extension: internalExtension,
          displayName: displayName,
          type,
          status,
          duration,
          timestamp: timestampISO,
          consultantName: mapping.name, // Nome oficial do mapeamento
          team: mapping.team
        };
      })
      .filter((item): item is CallRecord => item !== null);
  }, []);

  const processRawCalls = normalizeApiData; // Alias para manter compatibilidade com hooks antigos

  const handleFileUpload = useCallback((file: File) => {
    setIsLoading(true);
    setErrorMsg(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData = processRawCalls(results.data);
        
        if (parsedData.length > 0) {
          setData(parsedData);
          setLastUpdated(new Date());
          localStorage.setItem('adarco_persisted_calls', JSON.stringify(parsedData));
        } else {
          setErrorMsg("Nenhuma chamada de Inside Sales identificada no CSV. Verifique os ramais mapeados.");
        }
        setIsLoading(false);
      },
      error: (err) => {
        console.error("[App] CSV Parsing Error:", err);
        setErrorMsg("Erro ao processar o arquivo CSV. Verifique o formato.");
        setIsLoading(false);
      }
    });
  }, [processRawCalls]);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setPagError(null);
    try {
      const response = await axios.get('/api/calls', {
        params: {
          start: startDate ? `${startDate}T00:00:00Z` : undefined,
          end: endDate ? `${endDate}T23:59:59Z` : undefined
        }
      });
      
      const parsedData = processRawCalls(response.data);
      
      if (parsedData.length > 0) {
        setData(parsedData);
        setLastUpdated(new Date());
        localStorage.setItem('adarco_persisted_calls', JSON.stringify(parsedData));
      } else {
        if (data.length === 0) {
          setErrorMsg("Nenhuma ligação encontrada na Bem Melhor para este período.");
        } else {
          setData([]);
        }
      }
    } catch (error: any) {
      console.error("[App] Erro API Bem Melhor:", error);
      if (error.response?.data?.page) {
        setPagError({
          message: error.response.data.message,
          detail: error.response.data.detail,
          page: error.response.data.page,
          partialCount: error.response.data.partialCount
        });
      } else {
        const apiError = error.response?.data?.detail || error.response?.data?.error || "Erro ao conectar com a API Bem Melhor. Verifique sua chave.";
        setErrorMsg(apiError);
      }
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, processRawCalls, data.length]);

  // Carrega dados persistidos do localStorage ao iniciar
  useEffect(() => {
    const savedData = localStorage.getItem('adarco_persisted_calls');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setData(parsed);
          setLastUpdated(new Date());
        }
      } catch (e) {
        console.error("[App] Erro ao carregar cache local:", e);
      }
    }
    
    // Se não tiver dados em cache, tenta buscar automaticamente
    if (!savedData || JSON.parse(savedData).length === 0) {
       fetchDashboardData();
    }
  }, []); // Run once on mount

  // Busca dados sempre que o período mudar
  useEffect(() => {
    if (startDate && endDate) {
      fetchDashboardData();
    }
  }, [startDate, endDate]);

  // Regra de Atualização Automática: 10 min entre 08h e 20h
  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = new Date();
      const hour = now.getHours();
      
      // Regra Adarco: Atualizar apenas entre 08h e 20h
      if (hour >= 8 && hour < 20) {
        console.log(`[AutoRefresh] Sincronizando dados às ${now.toLocaleTimeString()}`);
        fetchDashboardData();
      }
    }, 10 * 60 * 1000); // 10 minutos

    return () => clearInterval(intervalId);
  }, [fetchDashboardData]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize(); 
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const availableConsultants = useMemo(() => {
    const baseList = Object.values(CONSULTANT_MAPPING);
    if (selectedTeam === 'Todos') {
       const names = Array.from(new Set(baseList.map(c => c.name))).sort();
       return ['Todos', ...names];
    }
    const filtered = baseList.filter(c => c.team === selectedTeam).map(c => c.name).sort();
    return ['Todos', ...filtered];
  }, [selectedTeam]);

  // Reseta o filtro de consultor se a seleção atual não estiver mais na lista permitida
  React.useEffect(() => {
    if (selectedConsultant !== 'Todos' && !availableConsultants.includes(selectedConsultant)) {
      setSelectedConsultant('Todos');
    }
  }, [availableConsultants, selectedConsultant]);

  const dateFilteredData = useMemo(() => {
    if (!startDate && !endDate) return data;
    const filtered = data.filter(item => {
      if (!item.timestamp) return false;
      
      const itemDate = item.timestamp.includes('T') 
        ? item.timestamp.split('T')[0] 
        : item.timestamp.split(' ')[0];
      
      const matchesStart = !startDate || itemDate >= startDate;
      const matchesEnd = !endDate || itemDate <= endDate;
      
      return matchesStart && matchesEnd;
    });
    
    // Log diagnóstico para ajudar a entender o abandono de dados
    if (data.length > 0 && filtered.length === 0) {
      console.warn(`[Diagnostics] Filtro de data removeu todos os ${data.length} registros. Range: ${startDate} até ${endDate}`);
    }
    
    return filtered;
  }, [data, startDate, endDate]);

  const indices = useMemo(() => {
    const byTeam = new Map<string, CallRecord[]>();
    const byConsultant = new Map<string, CallRecord[]>();

    dateFilteredData.forEach(call => {
      // Index by Team
      if (call.team) {
        if (!byTeam.has(call.team)) byTeam.set(call.team, []);
        byTeam.get(call.team)!.push(call);
      }
      
      // Index by Consultant
      if (call.consultantName) {
        if (!byConsultant.has(call.consultantName)) byConsultant.set(call.consultantName, []);
        byConsultant.get(call.consultantName)!.push(call);
      }
    });

    return { byTeam, byConsultant };
  }, [dateFilteredData]);

  const filteredData = useMemo(() => {
    let res: CallRecord[] = [];

    // Busca indexada O(1)
    if (selectedConsultant !== 'Todos') {
      res = indices.byConsultant.get(selectedConsultant) || [];
    } else if (selectedTeam !== 'Todos') {
      res = indices.byTeam.get(selectedTeam) || [];
    } else {
      res = dateFilteredData;
    }

    // Filtro linear apenas para a busca textual (se hover)
    if (searchQuery !== '') {
      const lowerQuery = searchQuery.toLowerCase();
      res = res.filter(item => 
        item.consultantName?.toLowerCase().includes(lowerQuery) || 
        item.extension.includes(searchQuery)
      );
    }

    if (dateFilteredData.length > 0 && res.length === 0 && !searchQuery) {
      console.warn(`[Diagnostics] Filtros de time/consultor vazios.`);
    }

    return res;
  }, [dateFilteredData, indices, selectedTeam, selectedConsultant, searchQuery]);

  const dashboardStats = useMemo(() => {
    const activeCounts: Record<string, { name: string, count: number, team: string, extension: string, isSupervisor?: boolean }> = {};
    const successCounts: Record<string, { name: string, count: number, team: string, extension: string, isSupervisor?: boolean }> = {};
    const summary: Record<string, { 
      name: string, 
      team: string, 
      extension: string,
      total: number, 
      success: number, 
      totalDuration: number,
      isSupervisor?: boolean
    }> = {};

    // Initialize counts for all consultants in selected team
    Object.values(CONSULTANT_MAPPING).forEach(c => {
      if (selectedTeam === 'Todos' || c.team === (selectedTeam as any)) {
        // Use clean name for display
        const displayName = cleanName(c.name);
        activeCounts[c.name] = { name: displayName, count: 0, team: c.team, extension: c.extension, isSupervisor: c.isSupervisor };
        successCounts[c.name] = { name: displayName, count: 0, team: c.team, extension: c.extension, isSupervisor: c.isSupervisor };
      }
    });

    let activeCountTotal = 0;
    let successCountTotal = 0;

    filteredData.forEach(call => {
      const { consultantName, type, status, duration, team, extension, displayName } = call;
      if (!consultantName) return;

      // Use clean displayName if available, fallback to mapping name
      let display = cleanName(displayName || consultantName);
      const isSup = extension === '6005' || extension === '6038' || CONSULTANT_MAPPING[extension || ""]?.isSupervisor;
      if (isSup) {
        display = extension === '6005' ? 'Sup. Débora' : 'Sup. Marília';
      }

      // Update global KPI counters
      if (type === 'Ativa') activeCountTotal++;
      if (status === 'Atendida') successCountTotal++;

      // Volume de Chamadas
      if (activeCounts[consultantName]) {
        activeCounts[consultantName].count++;
      } else if (selectedTeam === 'Todos' || team === selectedTeam) {
          if (!activeCounts[consultantName]) {
            activeCounts[consultantName] = { 
              name: display, 
              count: 0, 
              team: team || "Inside Sales",
              extension: extension || "",
              isSupervisor: isSup
            };
          }
          activeCounts[consultantName].count++;
      }

      // Sucesso (Apenas chamadas atendidas >= 20s)
      if (successCounts[consultantName]) {
        if (status === 'Atendida') {
          successCounts[consultantName].count++;
        }
      } else if (selectedTeam === 'Todos' || team === selectedTeam) {
          if (!successCounts[consultantName]) {
            successCounts[consultantName] = { 
              name: display, 
              count: 0, 
              team: team || "Inside Sales",
              extension: extension || "",
              isSupervisor: isSup
            };
          }
          if (status === 'Atendida') successCounts[consultantName].count++;
      }

      // Update Summary table data
      if (!summary[consultantName]) {
        summary[consultantName] = {
          name: display,
          team: team || "Inside Sales",
          extension: extension,
          total: 0,
          success: 0,
          totalDuration: 0,
          isSupervisor: isSup
        };
      }
      const s = summary[consultantName];
      s.total++;
      if (status === 'Atendida') {
        s.success++;
        s.totalDuration += duration;
      }
    });

    const activeCallsByConsultant = Object.values(activeCounts).filter(a => a.count > 0).sort((a, b) => b.count - a.count);
    const successCallsByConsultant = Object.values(successCounts).filter(a => a.count > 0).sort((a, b) => b.count - a.count);
    const consultantSummary = Object.values(summary).sort((a, b) => b.total - a.total);

    const total = filteredData.length;
    const successRate = total > 0 ? (successCountTotal / total) * 100 : 0;

    return {
      activeCallsByConsultant,
      successCallsByConsultant,
      consultantSummary,
      kpis: {
        total,
        active: activeCountTotal,
        success: successCountTotal,
        successRate
      }
    };
  }, [filteredData, selectedTeam]);

  const { activeCallsByConsultant, successCallsByConsultant, consultantSummary, kpis } = dashboardStats;

  const teamComparison = useMemo(() => {
    const statsArr = {
      [TeamName.DEBORA]: { name: TeamName.DEBORA, total: 0, success: 0 },
      [TeamName.MARILIA]: { name: TeamName.MARILIA, total: 0, success: 0 }
    };
    // Use dateFilteredData to show whole team performance regardless of individual consultant filters
    dateFilteredData.forEach(d => {
      if (d.team && statsArr[d.team as keyof typeof statsArr]) {
        statsArr[d.team as keyof typeof statsArr].total++;
        if (d.status === 'Atendida') statsArr[d.team as keyof typeof statsArr].success++;
      }
    });
    return Object.values(statsArr);
  }, [dateFilteredData]);

  return (
    <div className="min-h-screen bg-offwhite dark:bg-[#05070f] flex text-graphite dark:text-slate-200 font-sans selection:bg-adarco-light selection:text-adarco-dark border-none">
      
      {/* Modal de Erro de Paginação */}
      <AnimatePresence>
        {pagError && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPagError(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-red-100"
            >
              <div className="bg-red-500 p-6 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="bg-white/20 p-2 rounded-xl">
                      <XCircle className="w-6 h-6 text-white" />
                   </div>
                   <h3 className="text-xl font-black tracking-tight uppercase">Falha na Extração</h3>
                </div>
                <button onClick={() => setPagError(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="bg-red-50 border border-red-100 p-5 rounded-2xl">
                  <p className="text-red-700 font-bold mb-2">Página de Falha: <span className="bg-red-600 text-white px-2 py-0.5 rounded text-sm">{pagError.page}</span></p>
                  <p className="text-red-600 text-sm font-medium leading-relaxed">{pagError.message}</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest text-slate-400">
                    <span>Detalhe Técnico</span>
                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded italic lowercase font-normal">{typeof pagError.detail === 'string' ? pagError.detail.substring(0, 30) : 'api_error'}...</span>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-4 font-mono text-[11px] text-red-400 overflow-x-auto max-h-[150px] custom-scrollbar border border-slate-800">
                     {pagError.detail}
                  </div>
                </div>

                <div className="flex items-center gap-4 py-4 border-t border-slate-100">
                    <div className="flex-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Itens recuperados</p>
                        <p className="text-2xl font-black text-adarco-dark">{pagError.partialCount}</p>
                    </div>
                    <button 
                      onClick={fetchDashboardData}
                      className="bg-adarco-dark text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-black transition-all shadow-lg active:scale-95 flex items-center gap-2"
                    >
                      <RefreshCcw className="w-4 h-4" /> Tentar Novamente
                    </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-adarco-dark/60 backdrop-blur-sm z-30 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 300 : 0, 
          x: isSidebarOpen ? 0 : -300,
          opacity: 1
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={cn(
          "bg-gradient-to-b from-[#00F58A]/40 via-[#004D2C]/90 to-[#003B22] text-white shadow-2xl z-40 sticky top-0 h-screen backdrop-blur-3xl border-r border-white/20 relative overflow-hidden",
          "fixed inset-y-0 left-0 md:sticky transition-width duration-300"
        )}
      >
        {/* Close button for mobile inside sidebar */}
        <button 
          onClick={() => setIsSidebarOpen(false)}
          className="absolute top-4 right-4 p-2 bg-white/10 rounded-lg md:hidden z-50"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Laminated Effect Shine */}
        <div className="absolute top-0 left-0 right-0 h-[300px] bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
        
        <div className="relative p-8 w-[300px] h-full flex flex-col z-10">
          <div className="flex items-center gap-4 mb-12">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-2xl rounded-2xl flex items-center justify-center border border-white/30 shadow-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <PhoneCall className="w-7 h-7 text-white" />
            </div>
            <div 
              onClick={() => window.location.reload()}
              className="cursor-pointer group select-none"
            >
              <h1 className="font-black text-xl tracking-tighter text-white drop-shadow-sm group-hover:text-adarco-primary transition-colors">ADARCO</h1>
              <p className="text-[10px] text-white/60 font-black uppercase tracking-widest leading-none mt-1">Inside Sales BI</p>
            </div>
          </div>

          <div className="flex-1 space-y-10">
            <div>
              <label className="text-[11px] font-black text-white/50 uppercase tracking-[0.2em] mb-4 block drop-shadow-sm">Navigation</label>
              <nav className="space-y-2">
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 text-white font-bold text-sm border border-white/20 shadow-inner backdrop-blur-md">
                  <TrendingUp className="w-4 h-4 text-white" />
                  Inside Sales
                </button>
              </nav>
            </div>

            <div className="space-y-6">
              <label className="text-[11px] font-black text-white/50 uppercase tracking-[0.2em] block drop-shadow-sm">Data Filters</label>
              
              <FilterSelect 
                label="Supervisão"
                value={selectedTeam}
                onChange={(val) => {
                  setSelectedTeam(val);
                  setSelectedConsultant('Todos');
                }}
                options={[
                  { label: 'Todos os Times', value: 'Todos' },
                  { label: 'Time Débora', value: TeamName.DEBORA },
                  { label: 'Time Marília', value: TeamName.MARILIA },
                ]}
              />

              <FilterSelect 
                label="Consultor"
                value={selectedConsultant}
                onChange={setSelectedConsultant}
                options={availableConsultants.map(c => ({ label: c, value: c }))}
                icon={Users}
              />

              <div className="space-y-4 pt-6 border-t border-white/10">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[11px] font-black text-white/50 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" /> Período
                  </label>
                  {(startDate || endDate) && (
                    <button 
                      onClick={() => { 
                        const now = new Date();
                        const year = now.getFullYear();
                        const month = String(now.getMonth() + 1).padStart(2, '0');
                        const day = String(now.getDate()).padStart(2, '0');
                        
                        setStartDate(`${year}-${month}-01`); 
                        setEndDate(`${year}-${month}-${day}`); 
                      }}
                      className="text-[10px] font-black text-white/40 hover:text-white uppercase tracking-tighter transition-colors"
                    >
                      Resetar
                    </button>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-bold text-white/30 uppercase pl-1">Data Inicial</p>
                    <input 
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-adarco-primary/30 transition-all [color-scheme:dark]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-bold text-white/30 uppercase pl-1">Data Final</p>
                    <input 
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-adarco-primary/30 transition-all [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 mt-auto opacity-40 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-adarco-light" />
              </div>
              <div>
                <p className="text-[10px] font-black text-white/60 uppercase tracking-tighter">Powered by</p>
                <p className="text-xs font-black text-white tracking-tight">Inside Sales BI</p>
              </div>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 md:px-10 py-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12">
          <div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-adarco-dark dark:text-white">Performance Inside Sales</h2>
            <div className="flex items-center gap-3 mt-2">
              {isLoading && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 px-2 py-0.5 bg-adarco-soft rounded-lg"
                >
                  <Loader2 className="w-3 h-3 text-adarco-primary animate-spin" />
                  <span className="text-[10px] font-black text-adarco-dark uppercase">Processando...</span>
                </motion.div>
              )}
              {lastUpdated && (
                <>
                  <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                    Atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </>
              )}
              <div className="w-1.5 h-1.5 bg-adarco-light rounded-full shadow-sm" />
              <p className="text-xs font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-lg uppercase tracking-widest shadow-sm">
                Foco em Resultados
              </p>
            </div>
    {/* Erro Polite Popup */}
    <AnimatePresence>
      {errorMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="mb-8 p-6 bg-white/90 backdrop-blur-xl border-2 border-adarco-soft rounded-[2rem] shadow-soft flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-adarco-soft rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
              <RefreshCcw className="w-7 h-7 text-adarco-primary animate-pulse" />
            </div>
            <div>
              <p className="font-black text-adarco-dark text-lg tracking-tight">Olá! Tivemos um pequeno imprevisto ao carregar os dados.</p>
              <p className="text-sm text-slate-500 font-bold opacity-80">Por favor, tente carregar novamente para atualizarmos seu dashboard.</p>
              <p className="text-[10px] text-slate-300 font-mono mt-1 uppercase">Motivo: {errorMsg}</p>
            </div>
          </div>
          <button 
            onClick={fetchDashboardData}
            className="bg-adarco-dark text-white px-8 py-4 rounded-[1.25rem] font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl active:scale-95 flex items-center gap-3 whitespace-nowrap group"
          >
            <RefreshCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" /> Sincronizar Agora
          </button>
        </motion.div>
      )}
    </AnimatePresence>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-4 w-full md:w-auto">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button 
                    onClick={fetchDashboardData}
                    disabled={isLoading}
                    title="Sincronizar com Bem Melhor"
                    className="flex items-center justify-center p-3 bg-adarco-dark text-white rounded-2xl hover:bg-black transition-all shadow-soft w-[48px] h-[48px] shrink-0 disabled:opacity-50 group"
                >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5 font-bold group-hover:rotate-180 transition-transform duration-700" />}
                </button>
                
                <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    title={isDarkMode ? "Modo Claro" : "Modo Escuro"}
                    className="flex items-center justify-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-adarco-dark dark:text-adarco-primary rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-soft w-[48px] h-[48px] shrink-0 group"
                >
                    {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>

                <div className="relative group flex-1 sm:flex-none">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 transition-colors group-focus-within:text-adarco-primary" />
                    <input 
                      type="text" 
                      placeholder="Pesquisar..."
                      className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-white/50 dark:border-slate-700 rounded-2xl pl-11 pr-5 py-3 text-sm font-bold focus:ring-4 focus:ring-adarco-primary/20 focus:border-adarco-primary outline-none w-full sm:w-[150px] md:w-[220px] shadow-neon transition-all placeholder:text-slate-400 dark:text-slate-200"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-soft md:hidden flex items-center justify-center min-w-[48px] h-[48px]"
                >
                    {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {isLoading && data.length === 0 ? (
            <motion.div 
              key="loading-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center min-h-[60vh]"
            >
              <div className="relative">
                <div className="w-20 h-20 bg-adarco-soft rounded-full absolute inset-0 animate-ping opacity-20" />
                <div className="w-20 h-20 bg-white border-2 border-adarco-soft rounded-full flex items-center justify-center shadow-lg relative z-10">
                  <Loader2 className="w-10 h-10 text-adarco-primary animate-spin" />
                </div>
              </div>
              <p className="mt-8 text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Sincronizando Adarco BI...</p>
            </motion.div>
          ) : (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8 pb-20"
            >
              {/* KPIs Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                  title="Total de Ligações" 
                  value={kpis.total} 
                  subtext="Volume bruto identificado"
                  icon={Phone}
                  colorClass="secondary"
                />
                <StatCard 
                  title="Ligações Ativas" 
                  value={kpis.active} 
                  subtext="Prospecção direta"
                  icon={PhoneOutgoing}
                  colorClass="secondary"
                />
                <StatCard 
                  title="Sucesso (Efetivas)" 
                  value={kpis.success} 
                  subtext="Ligações ≥ 20s"
                  icon={CheckCircle2}
                  colorClass="primary"
                />
                <StatCard 
                  title="Efetividade de Contato" 
                  value={`${kpis.successRate.toFixed(1)}%`}
                  subtext="Proporção ≥ 20s"
                  icon={TrendingUp}
                  trend={kpis.successRate > 70 ? 4 : -2}
                  colorClass="primary"
                />
              </div>

              {/* Central Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Gráfico A */}
                <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-8 rounded-3xl shadow-soft border border-white/40 dark:border-slate-700/50">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">
                        Volume de Ligações Ativas
                      </h3>
                      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Esforço por Consultor</p>
                    </div>
                    <div className="p-3 bg-adarco-soft dark:bg-adarco-dark/30 rounded-2xl">
                      <PhoneCall className="w-5 h-5 text-adarco-dark dark:text-adarco-primary" />
                    </div>
                  </div>
                  <div className="h-[300px] md:h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={activeCallsByConsultant} 
                        layout="vertical" 
                        margin={{ left: 60, right: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          axisLine={false} 
                          tickLine={false} 
                          style={{ fontSize: '11px', fontWeight: 600, fill: isDarkMode ? '#FFFFFF' : '#475569' }}
                          width={100}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(20, 61, 45, 0.05)' }} />
                        <Bar 
                          dataKey="count" 
                          name="Volume de Chamadas"
                          radius={[0, 8, 8, 0]} 
                          barSize={32}
                        >
                           {activeCallsByConsultant.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.isSupervisor ? '#3B82F6' : (entry.team === TeamName.DEBORA ? '#064E3B' : '#00F58A')} 
                              />
                           ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico B */}
                <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-8 rounded-3xl shadow-soft border border-white/40 dark:border-slate-700/50">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Contatos Efetivos (≥ 20s)</h3>
                      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Resultado por Consultor</p>
                    </div>
                    <div className="p-3 bg-adarco-light/20 dark:bg-emerald-900/30 rounded-2xl">
                      <CheckCircle2 className="w-5 h-5 text-adarco-primary" />
                    </div>
                  </div>
                  <div className="h-[300px] md:h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={successCallsByConsultant} 
                        layout="vertical" 
                        margin={{ left: 60, right: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          axisLine={false} 
                          tickLine={false} 
                          style={{ fontSize: '11px', fontWeight: 600, fill: isDarkMode ? '#FFFFFF' : '#475569' }}
                          width={100}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }} />
                        <Bar 
                          dataKey="count" 
                          name="Chamadas Efetivas"
                          radius={[0, 8, 8, 0]} 
                          barSize={32}
                        >
                           {successCallsByConsultant.map((entry, index) => {
                             if (entry.isSupervisor) {
                               return (
                                 <Cell 
                                   key={`cell-${index}`} 
                                   fill="#3B82F6" 
                                   fillOpacity={1}
                                 />
                               );
                             }
                             const isHighPerformance = entry.count >= 10; 
                             const teamColor = entry.team === TeamName.DEBORA ? '#064E3B' : '#00F58A';
                             return (
                               <Cell 
                                 key={`cell-${index}`} 
                                 fill={teamColor} 
                                 fillOpacity={isHighPerformance ? 1 : 0.6}
                               />
                             );
                           })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Performance Comparativa */}
              <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-8 rounded-3xl shadow-soft border border-white/40 dark:border-slate-700/50">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Performance Comparativa de Times</h3>
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Débora vs Marília</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {teamComparison.map(team => {
                    const pieData = [
                      { name: 'Atendidas', value: team.success },
                      { name: 'Perdidas', value: Math.max(0, team.total - team.success) }
                    ];
                    const color = team.name === TeamName.DEBORA ? "#064E3B" : "#00F58A";
                    const efficiency = team.total > 0 ? ((team.success / team.total) * 100).toFixed(1) : 0;

                    return (
                      <div key={team.name} className="flex flex-col items-center bg-white/50 dark:bg-slate-800/80 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                        <div className="h-[200px] w-full relative">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={8}
                                dataKey="value"
                                stroke="none"
                                cornerRadius={10}
                                startAngle={90}
                                endAngle={-270}
                              >
                                <Cell fill={color} className="drop-shadow-sm" />
                                <Cell fill={isDarkMode ? '#1e293b' : '#F1F5F9'} />
                              </Pie>
                              <Tooltip 
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div className="bg-white dark:bg-slate-800 px-3 py-2 rounded-lg shadow-xl border border-slate-50 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                                        <span>
                                          {payload[0].name}: {payload[0].value}
                                        </span>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tighter leading-none">{efficiency}%</span>
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Score</span>
                          </div>
                        </div>
                        <div className="mt-4 text-center">
                          <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-900 rounded-full border border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                            <h4 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">{team.name}</h4>
                          </div>
                          <p className="mt-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                            <span className="text-slate-800 dark:text-slate-200">{team.success}</span> de <span className="text-slate-600 dark:text-slate-400">{team.total}</span> <span className="ml-1 text-slate-300 dark:text-slate-500">atendidas</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Table */}
              <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg rounded-[2rem] shadow-soft border border-white/40 dark:border-slate-700/50 overflow-hidden">
                <div className="p-8 border-b border-slate-100/50 dark:border-slate-700/50 flex items-center justify-between bg-white/40 dark:bg-slate-800/40">
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">Resumo de Performance</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Métricas consolidadas por consultor no período</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                        <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Consultor</th>
                        <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Ligações</th>
                        <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Sucesso</th>
                        <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Efet. %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                      {consultantSummary.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/80 transition-colors group">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm transition-transform group-hover:scale-110",
                                item.isSupervisor 
                                  ? "bg-blue-600 dark:bg-blue-500 text-white" 
                                  : (item.team === TeamName.DEBORA ? "bg-adarco-dark text-white" : "bg-adarco-light text-adarco-dark")
                              )}>
                                {item.name[0]}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className={cn(
                                    "text-sm font-bold",
                                    item.isSupervisor 
                                      ? "text-blue-600 dark:text-blue-400 font-extrabold" 
                                      : "text-slate-700 dark:text-slate-200"
                                  )}>{item.name}</p>
                                  {item.isSupervisor && (
                                    <span className="text-[9px] font-extrabold tracking-widest uppercase bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                      Sup
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{item.team}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-center font-mono text-sm font-bold text-slate-600 dark:text-slate-300">{item.total}</td>
                          <td className="px-8 py-5 text-center">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold font-mono">
                              {item.success}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                {item.total > 0 ? ((item.success / item.total) * 100).toFixed(0) : 0}%
                              </span>
                              <div className="w-12 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full rounded-full",
                                    item.isSupervisor ? "bg-blue-500" : "bg-adarco-primary"
                                  )}
                                  style={{ width: `${item.total > 0 ? (item.success / item.total) * 100 : 0}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
