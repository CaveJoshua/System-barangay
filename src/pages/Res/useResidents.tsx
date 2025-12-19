// src/pages/Residents/useResidents.ts
import { useState, useEffect, useMemo, useRef } from 'react';

// 1. UPDATED INTERFACE (Includes new fields)
export interface Resident {
  _id: string;
  firstName: string;
  lastName: string;
  name?: string;
  age: number | string;
  sex?: string;
  gender?: string; // Handle both naming conventions
  civilStatus?: string;
  zone?: string;
  status?: string;
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
  occupation?: string;
  is4Ps?: boolean;
  isFarmer?: boolean;
}

export const useResidents = (initialData: Resident[] = []) => {
  const [residents, setResidents] = useState<Resident[]>(initialData);
  const [loading, setLoading] = useState(initialData.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  
  // UI State
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = localStorage.getItem('token');

  // API Helper
  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    } as HeadersInit;

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const text = await res.text();
      try {
        const jsonErr = JSON.parse(text);
        throw new Error(jsonErr.message || `HTTP ${res.status}`);
      } catch {
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
    }
    return res.json();
  };

  // Fetch Data
  const fetchResidents = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('http://localhost:5000/api/residents');
      setResidents(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setResidents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialData.length > 0) {
      setResidents(initialData);
      setLoading(false);
    } else {
      fetchResidents();
    }
  }, [initialData]);

  // Delete
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      await apiFetch(`http://localhost:5000/api/residents/${id}`, { method: 'DELETE' });
      setResidents(prev => prev.filter(r => r._id !== id));
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  // Export
  const handleExport = () => {
    if (residents.length === 0) return alert("No data.");
    const headers = ["firstName", "lastName", "age", "sex", "civilStatus", "zone", "status", "contact", "occupation", "is4Ps", "isFarmer"];
    const csvRows = [
      headers.join(','),
      ...residents.map(row => {
        const nameParts = (row.name || "").split(" ");
        return [
          row.firstName || nameParts[0] || "",
          row.lastName || nameParts.slice(1).join(" ") || "",
          row.age || "",
          row.sex || row.gender || "N/A",
          row.civilStatus || "Single",
          row.zone || "",
          row.status || "Active",
          `"${(row.contact || row.phone || "").replace(/"/g, '""')}"`,
          row.occupation || "",
          row.is4Ps ? "Yes" : "No",
          row.isFarmer ? "Yes" : "No"
        ].join(',');
      })
    ];
    const blob = new Blob(["\uFEFF" + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `residents_export.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Import Trigger
  const triggerImport = () => fileInputRef.current?.click();

  // (The actual handleFileUpload logic is handled inside Residents.tsx via the Smart Scanner now, 
  // but we keep a basic handler here for compatibility if passed down)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     // Logic now lives in Residents.tsx for the smart scanner
  };

  // --- FILTERING LOGIC ---
  const processedResidents = useMemo(() => {
    let data = residents;
    
    // 1. Tab Filter
    if (activeTab === 'active') data = data.filter(res => res.status !== 'Archived');
    else data = data.filter(res => res.status === 'Archived');

    // 2. Search Filter
    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase();
      data = data.filter(res => {
        const fullName = `${res.firstName || res.name || ''} ${res.lastName || ''}`.toLowerCase();
        return fullName.includes(lowerQ) || (res.civilStatus || '').toLowerCase().includes(lowerQ);
      });
    }

    // 3. Category Filter
    if (filterCategory !== 'All') {
      data = data.filter(res => {
        const age = Number(res.age) || 0;
        if (filterCategory === 'Seniors') return age >= 60;
        if (filterCategory === 'Adults') return age >= 18 && age < 60;
        if (filterCategory === 'Minors') return age < 18;
        // New Filters for 4Ps and Farmers
        if (filterCategory === '4Ps') return res.is4Ps === true;
        if (filterCategory === 'Farmers') return res.isFarmer === true;
        return true;
      });
    }
    return data;
  }, [residents, activeTab, searchQuery, filterCategory]);

  // Pagination
  const totalPages = Math.ceil(processedResidents.length / itemsPerPage);
  const paginatedResidents = processedResidents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => setCurrentPage(1), [activeTab, searchQuery, filterCategory]);

  // --- UPDATED METRICS (Now dependent on processedResidents) ---
  const metrics = useMemo(() => {
    // We use processedResidents so the charts update when filters change
    const dataToAnalyze = processedResidents; 

    return {
      total: dataToAnalyze.length,
      // Count specific flags based on the filtered view
      total4Ps: dataToAnalyze.filter(r => r.is4Ps).length,
      totalFarmers: dataToAnalyze.filter(r => r.isFarmer).length,
      
      active: dataToAnalyze.filter(r => r.status !== 'Archived').length,
      archived: dataToAnalyze.filter(r => r.status === 'Archived').length,
      
      avgAge: dataToAnalyze.length 
        ? Math.round(dataToAnalyze.reduce((acc, r) => acc + (Number(r.age)||0), 0) / dataToAnalyze.length) 
        : 0,
        
      zones: dataToAnalyze.reduce((acc: any, r) => {
        const z = r.zone || 'Unassigned';
        acc[z] = (acc[z] || 0) + 1;
        return acc;
      }, {}),

      // Added Gender calc for charts
      gender: dataToAnalyze.reduce((acc: any, r) => {
        const g = (r.sex || r.gender || 'Unknown').toLowerCase();
        if(g.startsWith('m')) acc.male = (acc.male || 0) + 1;
        else if(g.startsWith('f')) acc.female = (acc.female || 0) + 1;
        else acc.unknown = (acc.unknown || 0) + 1;
        return acc;
      }, { male: 0, female: 0, unknown: 0 })
    };
  }, [processedResidents]); // <--- THIS DEPENDENCY CHANGE IS THE KEY

  return {
    residents, loading, error, importing,
    activeTab, setActiveTab,
    searchQuery, setSearchQuery,
    filterCategory, setFilterCategory,
    metrics,
    paginatedResidents, totalPages, currentPage, setCurrentPage, totalCount: processedResidents.length, itemsPerPage,
    handleDelete, handleExport, triggerImport, handleFileUpload, fetchResidents,
    fileInputRef
  };
};