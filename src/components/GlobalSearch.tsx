import { useState, useEffect, useRef, MouseEvent, KeyboardEvent } from 'react';
import { useAuth } from './AuthContext.tsx';
import { 
  Search, 
  X, 
  Clock, 
  User, 
  Stethoscope, 
  Pill, 
  Calendar, 
  FileText, 
  CreditCard, 
  Activity, 
  ChevronRight, 
  Loader2,
  Trash2,
  ArrowRightLeft
} from 'lucide-react';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
}

interface SearchResults {
  patients: any[];
  doctors: any[];
  medicines: any[];
  appointments: any[];
  bills: any[];
  reports: any[];
  labTests: any[];
}

const FILTER_OPTIONS = [
  { id: 'all', label: 'All Results' },
  { id: 'patients', label: 'Patients' },
  { id: 'doctors', label: 'Doctors' },
  { id: 'medicines', label: 'Medicines' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'bills', label: 'Bills (Invoices)' },
  { id: 'reports', label: 'Reports & EMR' },
  { id: 'labTests', label: 'Lab Tests' },
];

export default function GlobalSearch({ isOpen, onClose, setActiveTab }: GlobalSearchProps) {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults>({
    patients: [],
    doctors: [],
    medicines: [],
    appointments: [],
    bills: [],
    reports: [],
    labTests: []
  });
  
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Load recent searches on mount
  useEffect(() => {
    const saved = localStorage.getItem('sanctuary-recent-searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        setRecentSearches([]);
      }
    }
  }, []);

  // Save recent searches when updated
  const saveRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    
    setRecentSearches((prev) => {
      const filtered = prev.filter((x) => x.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 6); // Limit to 6 recent items
      localStorage.setItem('sanctuary-recent-searches', JSON.stringify(updated));
      return updated;
    });
  };

  const clearRecentSearches = () => {
    localStorage.removeItem('sanctuary-recent-searches');
    setRecentSearches([]);
  };

  const removeRecentSearchItem = (e: MouseEvent, item: string) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((x) => x !== item);
      localStorage.setItem('sanctuary-recent-searches', JSON.stringify(updated));
      return updated;
    });
  };

  // Focus input when open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
      setResults({
        patients: [],
        doctors: [],
        medicines: [],
        appointments: [],
        bills: [],
        reports: [],
        labTests: []
      });
    }
  }, [isOpen]);

  // Debounced query searching
  useEffect(() => {
    if (!query.trim()) {
      setResults({
        patients: [],
        doctors: [],
        medicines: [],
        appointments: [],
        bills: [],
        reports: [],
        labTests: []
      });
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        const typeQuery = selectedFilter === 'all' ? 'all' : selectedFilter;
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${typeQuery}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setResults(data);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error('Error conducting global search query:', err);
      } finally {
        setLoading(false);
      }
    }, 250); // 250ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [query, selectedFilter, token]);

  // Flatten results for keyboard navigation
  const getFlatItems = () => {
    const flat: any[] = [];
    
    if (results.patients?.length) {
      results.patients.forEach(item => flat.push({ ...item, searchType: 'patient', tab: 'patients' }));
    }
    if (results.doctors?.length) {
      results.doctors.forEach(item => flat.push({ ...item, searchType: 'doctor', tab: 'doctors' }));
    }
    if (results.medicines?.length) {
      results.medicines.forEach(item => flat.push({ ...item, searchType: 'medicine', tab: 'pharmacy' }));
    }
    if (results.appointments?.length) {
      results.appointments.forEach(item => flat.push({ ...item, searchType: 'appointment', tab: 'appointments' }));
    }
    if (results.bills?.length) {
      results.bills.forEach(item => flat.push({ ...item, searchType: 'bill', tab: 'billing' }));
    }
    if (results.reports?.length) {
      results.reports.forEach(item => flat.push({ ...item, searchType: 'report', tab: 'reports' }));
    }
    if (results.labTests?.length) {
      results.labTests.forEach(item => flat.push({ ...item, searchType: 'labTest', tab: 'laboratory' }));
    }

    return flat;
  };

  const flatItems = getFlatItems();

  // Keyboard navigation control
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(flatItems.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + flatItems.length) % Math.max(flatItems.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItems[selectedIndex]) {
        handleItemClick(flatItems[selectedIndex]);
      } else if (query.trim()) {
        saveRecentSearch(query);
      }
    }
  };

  const handleItemClick = (item: any) => {
    saveRecentSearch(query || item.name || item.title || item.invoiceNumber);
    setActiveTab(item.tab);
    onClose();
  };

  const handleRecentClick = (term: string) => {
    setQuery(term);
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-20 px-4 transition-all"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] max-w-2xl w-full border border-slate-100 overflow-hidden max-h-[75vh] flex flex-col transform transition-all animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Box */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patients, doctors, medicines, bills, reports, lab tests..."
            className="w-full text-sm text-slate-800 placeholder-slate-400 bg-transparent border-0 outline-none focus:ring-0 focus:outline-none"
          />
          {loading ? (
            <Loader2 className="w-4 h-4 text-teal-500 animate-spin shrink-0" />
          ) : query ? (
            <button 
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              className="p-1 hover:bg-slate-50 rounded-full transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
            </button>
          ) : (
            <span className="text-[10px] text-slate-400 font-mono border border-slate-200 px-1.5 py-0.5 rounded shadow-sm shrink-0 uppercase">ESC</span>
          )}
        </div>

        {/* Filter Badges Strip */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-50/50 border-b border-slate-100 overflow-x-auto scrollbar-none">
          {FILTER_OPTIONS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setSelectedFilter(filter.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer border ${
                selectedFilter === filter.id
                  ? 'bg-teal-500 border-teal-500 text-white shadow-sm shadow-teal-500/10'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Dynamic Display Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5" ref={resultsRef}>
          {/* 1. Show Recent Searches & Basic Suggestions when there's no query */}
          {!query.trim() && (
            <div className="space-y-4">
              {recentSearches.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recent Searches</span>
                    <button 
                      onClick={clearRecentSearches}
                      className="text-[10px] font-semibold text-rose-500 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear All</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {recentSearches.map((term, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleRecentClick(term)}
                        className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-100 rounded-xl text-xs text-slate-600 font-medium cursor-pointer transition-colors group"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{term}</span>
                        </span>
                        <button
                          onClick={(e) => removeRecentSearchItem(e, term)}
                          className="p-0.5 hover:bg-slate-200 rounded-full transition-colors opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
                        >
                          <X className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* General Helpful Navigation Suggestions */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Jump Shortcuts</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Register Patient', tab: 'patients', desc: 'Add a new patient record' },
                    { label: 'Book Appointment', tab: 'appointments', desc: 'Schedule new consultations' },
                    { label: 'Pharmacy Medicine', tab: 'pharmacy', desc: 'Check or sell drugs' },
                    { label: 'EMR Records', tab: 'emr', desc: 'Consultation SOAP logs' },
                    { label: 'Lab Laboratory', tab: 'laboratory', desc: 'Check test results' },
                    { label: 'Billing Invoices', tab: 'billing', desc: 'Generate hospital bills' }
                  ].map((sh, idx) => (
                    <div
                      key={idx}
                      onClick={() => { setActiveTab(sh.tab); onClose(); }}
                      className="p-3 bg-white hover:bg-teal-50/20 border border-slate-100 hover:border-teal-100 rounded-xl text-left cursor-pointer transition-all duration-150 shadow-sm"
                    >
                      <span className="text-xs font-semibold text-slate-800 block">{sh.label}</span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">{sh.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. Show No Results Found Indicator */}
          {query.trim() && flatItems.length === 0 && !loading && (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-2.5">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                <Search className="w-5 h-5 animate-bounce" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-800">No results found for "{query}"</p>
                <p className="text-[10px] text-slate-400 max-w-sm">
                  We couldn't find any patients, doctors, medicines, appointments, bills, reports, or lab tests matching your keyword.
                </p>
              </div>
            </div>
          )}

          {/* 3. Render Categorized & Grouped Search Results */}
          {query.trim() && flatItems.length > 0 && (
            <div className="space-y-4">
              {/* Patients List section */}
              {results.patients?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    <User className="w-3 h-3 text-teal-500" />
                    <span>Patients ({results.patients.length})</span>
                  </div>
                  <div className="space-y-1">
                    {results.patients.map((item, idx) => {
                      const flatIndex = flatItems.findIndex(x => x.id === item.id && x.searchType === 'patient');
                      const isSelected = selectedIndex === flatIndex;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleItemClick({ ...item, tab: 'patients' })}
                          onMouseEnter={() => setSelectedIndex(flatIndex)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                            isSelected 
                              ? 'bg-teal-50/50 border-teal-200/60 shadow-sm' 
                              : 'bg-white border-slate-100 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono">PT</div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-800 block truncate">{item.name}</span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                {item.email || 'No email'} • {item.phone || 'No phone'} • DOB: {item.dob}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Doctors List section */}
              {results.doctors?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    <Stethoscope className="w-3 h-3 text-indigo-500" />
                    <span>Doctors ({results.doctors.length})</span>
                  </div>
                  <div className="space-y-1">
                    {results.doctors.map((item, idx) => {
                      const flatIndex = flatItems.findIndex(x => x.id === item.id && x.searchType === 'doctor');
                      const isSelected = selectedIndex === flatIndex;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleItemClick({ ...item, tab: 'doctors' })}
                          onMouseEnter={() => setSelectedIndex(flatIndex)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                            isSelected 
                              ? 'bg-teal-50/50 border-teal-200/60 shadow-sm' 
                              : 'bg-white border-slate-100 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono">DR</div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-800 block truncate">{item.name}</span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                {item.doctorProfile?.specialization || 'General'} • {item.email}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Medicines List section */}
              {results.medicines?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    <Pill className="w-3 h-3 text-emerald-500" />
                    <span>Pharmacy Medicines ({results.medicines.length})</span>
                  </div>
                  <div className="space-y-1">
                    {results.medicines.map((item, idx) => {
                      const flatIndex = flatItems.findIndex(x => x.id === item.id && x.searchType === 'medicine');
                      const isSelected = selectedIndex === flatIndex;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleItemClick({ ...item, tab: 'pharmacy' })}
                          onMouseEnter={() => setSelectedIndex(flatIndex)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                            isSelected 
                              ? 'bg-teal-50/50 border-teal-200/60 shadow-sm' 
                              : 'bg-white border-slate-100 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono">RX</div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-800 block truncate">{item.name}</span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                Code: {item.code} • Category: {item.category} • Price: ${item.unitPrice}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${item.stock <= item.minStockAlert ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-50 text-slate-600'}`}>
                              Stock: {item.stock}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Appointments List section */}
              {results.appointments?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    <Calendar className="w-3 h-3 text-pink-500" />
                    <span>Appointments ({results.appointments.length})</span>
                  </div>
                  <div className="space-y-1">
                    {results.appointments.map((item, idx) => {
                      const flatIndex = flatItems.findIndex(x => x.id === item.id && x.searchType === 'appointment');
                      const isSelected = selectedIndex === flatIndex;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleItemClick({ ...item, tab: 'appointments' })}
                          onMouseEnter={() => setSelectedIndex(flatIndex)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                            isSelected 
                              ? 'bg-teal-50/50 border-teal-200/60 shadow-sm' 
                              : 'bg-white border-slate-100 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 bg-pink-50 text-pink-600 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono">AP</div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-800 block truncate">
                                Patient: {item.patient?.name} with Dr. {item.doctor?.name}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                Date: {item.date} at {item.time} {item.notes ? `• "${item.notes}"` : ''}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                              item.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                              item.status === 'scheduled' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-600'
                            }`}>
                              {item.status}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bills List section */}
              {results.bills?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    <CreditCard className="w-3 h-3 text-sky-500" />
                    <span>Invoices & Bills ({results.bills.length})</span>
                  </div>
                  <div className="space-y-1">
                    {results.bills.map((item, idx) => {
                      const flatIndex = flatItems.findIndex(x => x.id === item.id && x.searchType === 'bill');
                      const isSelected = selectedIndex === flatIndex;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleItemClick({ ...item, tab: 'billing' })}
                          onMouseEnter={() => setSelectedIndex(flatIndex)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                            isSelected 
                              ? 'bg-teal-50/50 border-teal-200/60 shadow-sm' 
                              : 'bg-white border-slate-100 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 bg-sky-50 text-sky-600 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono">BL</div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-800 block truncate">
                                Bill {item.invoiceNumber} — {item.patient?.name}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                Date: {item.date} • Total: ${item.totalAmount} • Paid: ${item.amountPaid}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                              item.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                              item.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-slate-50 text-slate-600'
                            }`}>
                              {item.status}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Reports List section */}
              {results.reports?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    <FileText className="w-3 h-3 text-amber-500" />
                    <span>EMR Records & Lab Reports ({results.reports.length})</span>
                  </div>
                  <div className="space-y-1">
                    {results.reports.map((item, idx) => {
                      const flatIndex = flatItems.findIndex(x => x.id === item.id && x.searchType === 'report');
                      const isSelected = selectedIndex === flatIndex;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleItemClick({ ...item, tab: 'reports' })}
                          onMouseEnter={() => setSelectedIndex(flatIndex)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                            isSelected 
                              ? 'bg-teal-50/50 border-teal-200/60 shadow-sm' 
                              : 'bg-white border-slate-100 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono">RP</div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-800 block truncate">{item.title}</span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                Patient: {item.patientName} • Doctor/Validator: {item.doctorName} • Date: {item.date}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium block truncate mt-0.5">
                                "{item.summary}"
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              {item.type}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Lab Tests List section */}
              {results.labTests?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    <Activity className="w-3 h-3 text-rose-500" />
                    <span>Laboratory Tests ({results.labTests.length})</span>
                  </div>
                  <div className="space-y-1">
                    {results.labTests.map((item, idx) => {
                      const flatIndex = flatItems.findIndex(x => x.id === item.id && x.searchType === 'labTest');
                      const isSelected = selectedIndex === flatIndex;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleItemClick({ ...item, tab: 'laboratory' })}
                          onMouseEnter={() => setSelectedIndex(flatIndex)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                            isSelected 
                              ? 'bg-teal-50/50 border-teal-200/60 shadow-sm' 
                              : 'bg-white border-slate-100 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono">LB</div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-800 block truncate">{item.name}</span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                Code: {item.code} • Category: {item.category} • Turnaround: {item.turnaroundTime}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700">${item.price}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search Modal Footer Helpful Shortcuts Indicator */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 select-none">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="border border-slate-200 bg-white px-1.5 py-0.5 rounded font-mono shadow-sm">↑↓</span> Navigate
            </span>
            <span className="flex items-center gap-1.5">
              <span className="border border-slate-200 bg-white px-1.5 py-0.5 rounded font-mono shadow-sm">Enter</span> Select
            </span>
          </div>
          <span className="font-semibold text-teal-600/80">Sanctuary Global search</span>
        </div>
      </div>
    </div>
  );
}
