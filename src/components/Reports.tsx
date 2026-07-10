import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  Calendar,
  Users,
  Stethoscope,
  Receipt,
  Pill,
  Beaker,
  Package,
  Download,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  Filter,
  CheckCircle,
  Clock,
  Briefcase,
  DollarSign
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';

type ReportType = 'patient' | 'doctor' | 'appointment' | 'billing' | 'pharmacy' | 'lab' | 'inventory';

const COLORS = ['#0d9488', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'];

export default function Reports() {
  const { token } = useAuth();
  const [reportType, setReportType] = useState<ReportType>('patient');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Pre-sets for quick filtering
  const handleQuickPreset = (preset: 'today' | 'week' | 'month' | 'year' | 'all') => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (preset) {
      case 'today':
        start = today;
        end = today;
        break;
      case 'week':
        start.setDate(today.getDate() - 7);
        break;
      case 'month':
        start.setMonth(today.getMonth() - 1);
        break;
      case 'year':
        start.setFullYear(today.getFullYear() - 1);
        break;
      case 'all':
        setStartDate('');
        setEndDate('');
        return;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  // Queries
  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ['report', reportType, startDate, endDate],
    queryFn: async () => {
      let url = `/api/reports/${reportType}`;
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const queryStr = params.toString();
      if (queryStr) url += `?${queryStr}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Could not pull report data');
      return res.json();
    },
    enabled: !!token
  });

  // Export functions
  const exportCSV = () => {
    if (!data || !data.rows || data.rows.length === 0) return;
    const headers = Object.keys(data.rows[0]);
    const csvRows = [
      headers.join(','), // Header row
      ...data.rows.map((row: any) =>
        headers
          .map(fieldName => {
            const val = row[fieldName];
            const cleanVal = typeof val === 'string' ? val.replace(/"/g, '""') : val;
            return typeof cleanVal === 'string' && (cleanVal.includes(',') || cleanVal.includes('\n'))
              ? `"${cleanVal}"`
              : cleanVal;
          })
          .join(',')
      )
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportType}_report_${startDate || 'all'}_to_${endDate || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportExcel = () => {
    if (!data || !data.rows || data.rows.length === 0) return;
    // We will generate an HTML table format that Excel parses beautifully and retains gridlines.
    const headers = Object.keys(data.rows[0]);
    let tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8">
        <style>
          table { border-collapse: collapse; font-family: sans-serif; }
          th { background-color: #0d9488; color: white; font-weight: bold; padding: 8px; border: 1px solid #cbd5e1; }
          td { padding: 8px; border: 1px solid #cbd5e1; }
          .title-row { font-size: 18px; font-weight: bold; text-align: center; color: #0f172a; padding: 15px; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="${headers.length}" class="title-row">${reportType.toUpperCase()} CLINICAL REPORT</td></tr>
          <tr><td colspan="${headers.length}">Generated on: ${new Date().toLocaleDateString()} | Date Range: ${startDate || 'All Time'} to ${endDate || 'All Time'}</td></tr>
          <tr></tr>
          <tr>
            ${headers.map(h => `<th>${h.toUpperCase()}</th>`).join('')}
          </tr>
          ${data.rows
            .map(
              (row: any) => `
            <tr>
              ${headers.map(h => `<td>${row[h] !== null && row[h] !== undefined ? row[h] : ''}</td>`).join('')}
            </tr>`
            )
            .join('')}
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportType}_report_${startDate || 'all'}_to_${endDate || 'all'}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    if (!data) return;

    // Create a printable clean pop-up window
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const headers = data.rows && data.rows.length > 0 ? Object.keys(data.rows[0]) : [];

    printWindow.document.write(`
      <html>
      <head>
        <title>CareSync Clinical Report: ${reportType.toUpperCase()}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          body {
            font-family: 'Inter', sans-serif;
            color: #1e293b;
            padding: 40px;
            margin: 0;
            background-color: white;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-b: 2px solid #e2e8f0;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .brand {
            font-size: 24px;
            font-weight: 700;
            color: #0d9488;
          }
          .report-title {
            font-size: 18px;
            font-weight: 600;
            color: #334155;
            margin: 5px 0 0 0;
          }
          .meta-info {
            font-size: 12px;
            color: #64748b;
            text-align: right;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
          }
          .summary-card {
            background-color: #f8fafc;
            border: 1px solid #f1f5f9;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
          }
          .summary-label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            font-weight: 600;
            margin-bottom: 5px;
          }
          .summary-value {
            font-size: 20px;
            font-weight: 700;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 11px;
          }
          th {
            background-color: #f1f5f9;
            color: #475569;
            font-weight: 600;
            text-align: left;
            padding: 10px;
            border-bottom: 1px solid #cbd5e1;
          }
          td {
            padding: 10px;
            border-bottom: 1px solid #e2e8f0;
            color: #334155;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">CareSync</div>
            <h1 class="report-title">${reportType.toUpperCase()} CLINICAL REPORT</h1>
          </div>
          <div class="meta-info">
            <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
            <div><strong>Date Filter:</strong> ${startDate || 'All'} to ${endDate || 'All'}</div>
          </div>
        </div>

        <div class="summary-grid">
          ${Object.entries(data.summary || {})
            .map(
              ([key, val]: any) => `
            <div class="summary-card">
              <div class="summary-label">${key.replace(/([A-Z])/g, ' $1')}</div>
              <div class="summary-value">${typeof val === 'number' && key.toLowerCase().includes('revenue') ? '$' + val.toLocaleString() : val}</div>
            </div>`
            )
            .join('')}
        </div>

        <h3>REPORT DETAIL RECORDS</h3>
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h.replace(/([A-Z])/g, ' $1').toUpperCase()}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.rows
              .map(
                (row: any) => `
              <tr>
                ${headers.map(h => `<td>${row[h] !== null && row[h] !== undefined ? row[h] : ''}</td>`).join('')}
              </tr>`
              )
              .join('')}
          </tbody>
        </table>

        <div class="footer">
          CareSync Clinical Suite &copy; 2026. This is an official clinical document generated for administrative review.
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
  };

  const getReportIcon = (type: ReportType) => {
    switch (type) {
      case 'patient':
        return <Users className="w-5 h-5 text-teal-600" />;
      case 'doctor':
        return <Stethoscope className="w-5 h-5 text-teal-600" />;
      case 'appointment':
        return <Calendar className="w-5 h-5 text-teal-600" />;
      case 'billing':
        return <Receipt className="w-5 h-5 text-teal-600" />;
      case 'pharmacy':
        return <Pill className="w-5 h-5 text-teal-600" />;
      case 'lab':
        return <Beaker className="w-5 h-5 text-teal-600" />;
      case 'inventory':
        return <Package className="w-5 h-5 text-teal-600" />;
    }
  };

  const formatHeader = (header: string) => {
    return header
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };

  const reportOptions: { id: ReportType; label: string; icon: React.ReactNode }[] = [
    { id: 'patient', label: 'Patient Report', icon: <Users className="w-4 h-4" /> },
    { id: 'doctor', label: 'Doctor Report', icon: <Stethoscope className="w-4 h-4" /> },
    { id: 'appointment', label: 'Appointment Report', icon: <Calendar className="w-4 h-4" /> },
    { id: 'billing', label: 'Billing Report', icon: <Receipt className="w-4 h-4" /> },
    { id: 'pharmacy', label: 'Pharmacy Report', icon: <Pill className="w-4 h-4" /> },
    { id: 'lab', label: 'Lab Report', icon: <Beaker className="w-4 h-4" /> },
    { id: 'inventory', label: 'Inventory Report', icon: <Package className="w-4 h-4" /> }
  ];

  return (
    <div id="reports_module" className="space-y-6 font-sans">
      {/* Upper Module Intro banner */}
      <div className="bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-700 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full w-max">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Real-time Clinical Auditing</span>
            </div>
            <h3 className="text-2xl font-display font-bold">Reports & Intelligence Analytics</h3>
            <p className="text-xs text-teal-50/80 max-w-2xl">
              Construct high-fidelity compliance intelligence from CareSync. Seamlessly execute complex audit logs, trend dashboards, and export raw registers in PDF, CSV, or formatted Excel.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all self-start md:self-auto shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Intelligence</span>
          </button>
        </div>
      </div>

      {/* Selector & Filters Segment */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
        {/* Step 1: Report Categories selection */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">1. Select Audit category</label>
          <div className="flex flex-wrap gap-2">
            {reportOptions.map(opt => {
              const active = reportType === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setReportType(opt.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    active
                      ? 'bg-teal-500 border-teal-500 text-white shadow-sm shadow-teal-500/10'
                      : 'bg-white border-slate-100 hover:border-slate-300 text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Date Filters */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end pt-2 border-t border-slate-50">
          <div className="lg:col-span-3 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Start Date Filter</label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-600 focus:outline-none focus:border-teal-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="lg:col-span-3 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">End Date Filter</label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-600 focus:outline-none focus:border-teal-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="lg:col-span-6 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quick Presets</label>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => handleQuickPreset('today')}
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-600 cursor-pointer"
              >
                Today
              </button>
              <button
                onClick={() => handleQuickPreset('week')}
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-600 cursor-pointer"
              >
                7 Days
              </button>
              <button
                onClick={() => handleQuickPreset('month')}
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-600 cursor-pointer"
              >
                30 Days
              </button>
              <button
                onClick={() => handleQuickPreset('year')}
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-600 cursor-pointer"
              >
                1 Year
              </button>
              <button
                onClick={() => handleQuickPreset('all')}
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-600 cursor-pointer"
              >
                All Time
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Reporting Hub & Loading States */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white border border-slate-100 rounded-2xl p-16 text-center space-y-4 shadow-sm"
          >
            <div className="w-10 h-10 border-4 border-slate-100 border-t-teal-500 rounded-full animate-spin mx-auto" />
            <p className="text-xs font-semibold text-slate-500">Compiling multi-dimensional data structure...</p>
          </motion.div>
        ) : isError ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white border border-slate-100 rounded-2xl p-16 text-center space-y-3 shadow-sm"
          >
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700">Failed to Compile Report</h4>
            <p className="text-xs text-slate-400">
              An error occurred while running the database aggregation script. Ensure dates are valid.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="space-y-6"
          >
            {/* Quick Summary Cards (Bento style) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(data.summary || {}).map(([key, value]: any) => {
                const isAmount = key.toLowerCase().includes('revenue') || key.toLowerCase().includes('amount') || key.toLowerCase().includes('invoiced') || key.toLowerCase().includes('collected') || key.toLowerCase().includes('outstanding');
                return (
                  <div key={key} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </span>
                    <h3 className="text-xl font-display font-bold text-slate-800">
                      {isAmount ? `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : value}
                    </h3>
                  </div>
                );
              })}
            </div>

            {/* Visualizer Charts Hub */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart A */}
              {reportType === 'patient' && data.charts?.gender && (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">Patient Gender Demographic Distribution</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.charts.gender}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={3}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {data.charts.gender.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {reportType === 'patient' && data.charts?.ageBrackets && (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">Patient Demographics Age Brackets</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.charts.ageBrackets}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#0d9488" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Doctors Charts */}
              {reportType === 'doctor' && data.charts?.specializations && (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">Clinical Specialization Capacity</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.charts.specializations}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name }) => name}
                        >
                          {data.charts.specializations.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {reportType === 'doctor' && data.charts?.doctorAppointments && (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">Consultation Volume per Doctor</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.charts.doctorAppointments}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Appointments charts */}
              {reportType === 'appointment' && data.charts?.status && (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">Appointment Consultation Statuses</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.charts.status}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={3}
                          label={({ name }) => name}
                        >
                          {data.charts.status.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {reportType === 'appointment' && data.charts?.dailyTrend && (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">Scheduled Visit Frequency Trends</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.charts.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="count" stroke="#0d9488" fill="#ccfbf1" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Billing charts */}
              {reportType === 'billing' && data.charts?.invoiceStatuses && (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">Billing Portfolio Invoices Statuses</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.charts.invoiceStatuses}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name }) => name}
                        >
                          {data.charts.invoiceStatuses.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {reportType === 'billing' && data.charts?.dailyTrend && (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">Revenue Flow: Invoiced vs Collected</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.charts.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend />
                        <Area type="monotone" dataKey="invoiced" name="Invoiced ($)" stroke="#3b82f6" fill="#dbeafe" />
                        <Area type="monotone" dataKey="collected" name="Collected ($)" stroke="#10b981" fill="#d1fae5" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Pharmacy Charts */}
              {reportType === 'pharmacy' && data.charts?.stockStatus && (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">Medicine Stock Level Distribution</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.charts.stockStatus}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={3}
                          label={({ name }) => name}
                        >
                          {data.charts.stockStatus.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {reportType === 'pharmacy' && data.charts?.topMedicines && (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">Top Dispensed Medications (Revenue)</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.charts.topMedicines}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="value" name="Revenue ($)" fill="#0d9488" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Lab Charts */}
              {reportType === 'lab' && data.charts?.statuses && (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">Lab Diagnostic Order Statuses</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.charts.statuses}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name }) => name}
                        >
                          {data.charts.statuses.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {reportType === 'lab' && data.charts?.topTests && (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">Diagnostic Volume High-Demand Tests</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.charts.topTests}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="value" name="Orders Count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Inventory Charts */}
              {reportType === 'inventory' && data.charts?.stockStatus && (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">Medical Supplies Stock Level Portions</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.charts.stockStatus}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={3}
                          label={({ name }) => name}
                        >
                          {data.charts.stockStatus.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {reportType === 'inventory' && data.charts?.categories && (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">Product Portfolio distribution by Category</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.charts.categories}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="value" name="Items Count" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Audit Rows Register list */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                    {getReportIcon(reportType)}
                    <span>Tabular Audit Register ({data.rows?.length || 0} rows)</span>
                  </h4>
                  <p className="text-[10px] text-slate-400">Detailed line items matching selected parameters.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={exportPDF}
                    disabled={!data?.rows || data.rows.length === 0}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-300 text-slate-600 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print PDF</span>
                  </button>

                  <button
                    onClick={exportCSV}
                    disabled={!data?.rows || data.rows.length === 0}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-300 text-slate-600 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    onClick={exportExcel}
                    disabled={!data?.rows || data.rows.length === 0}
                    className="flex items-center gap-1.5 bg-teal-50 hover:bg-teal-100 disabled:bg-slate-50 disabled:text-slate-300 text-teal-700 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Export Excel</span>
                  </button>
                </div>
              </div>

              {/* Responsive Scrollable Container */}
              {data.rows && data.rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {Object.keys(data.rows[0]).map(h => (
                          <th key={h} className="p-4 font-semibold">
                            {formatHeader(h)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.rows.map((row: any, rIdx: number) => (
                        <tr key={rIdx} className="hover:bg-slate-50/50 transition-colors">
                          {Object.keys(data.rows[0]).map((h, cIdx) => {
                            const val = row[h];
                            const isAmount = h.toLowerCase().includes('revenue') || h.toLowerCase().includes('amount') || h.toLowerCase().includes('price') || h.toLowerCase().includes('cost') || h.toLowerCase().includes('total') || h.toLowerCase().includes('paid') || h.toLowerCase().includes('discount') || h.toLowerCase().includes('subtotal');
                            return (
                              <td key={cIdx} className="p-4 font-medium text-slate-600">
                                {isAmount && typeof val === 'number' ? `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : val !== null && val !== undefined ? String(val) : 'N/A'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-16 text-center space-y-2">
                  <FileText className="w-10 h-10 text-slate-200 mx-auto" />
                  <h5 className="font-bold text-slate-700 text-xs">No Records Located</h5>
                  <p className="text-[10px] text-slate-400">There are no records in the active clinic database matching these date intervals.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
