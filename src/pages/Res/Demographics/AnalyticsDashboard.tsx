import React, { useMemo } from 'react';

interface AnalyticsDashboardProps {
  residents: any[];
  filterCategory: string;
  setFilterCategory: (category: string) => void;
}

export default function AnalyticsDashboard({ 
  residents, 
  filterCategory, 
  setFilterCategory 
}: AnalyticsDashboardProps) {
  
  // 1. FILTER DATA BASED ON SELECTION
  const filteredData = useMemo(() => {
    if (filterCategory === 'All') return residents;

    return residents.filter(r => {
        const age = Number(r.age) || 0;
        
        if (filterCategory === 'Minors') return age < 18;
        if (filterCategory === 'Adults') return age >= 18 && age < 60;
        if (filterCategory === 'Seniors') return age >= 60;
        
        // --- FIX: ROBUST CHECK FOR 4Ps ---
        if (filterCategory === '4Ps') {
           // Check natin kung 'is4Ps' (capital P) o 'is4ps' (small p) ang nasa database
           const status = r.is4Ps !== undefined ? r.is4Ps : r.is4ps;
           // Tanggapin ang true (boolean) o "true" (string)
           return status === true || String(status).toLowerCase() === 'true';
        }

        // --- FIX: ROBUST CHECK FOR FARMERS ---
        if (filterCategory === 'Farmers') {
           const status = r.isFarmer;
           return status === true || String(status).toLowerCase() === 'true';
        }
        
        return true;
    });
  }, [residents, filterCategory]);

  // 2. CALCULATE STATS FROM FILTERED SUBSET
  const total = filteredData.length;
  
  // Robust gender check
  const male = filteredData.filter(r => (r.sex || r.gender || '').toLowerCase().startsWith('m')).length;
  const female = filteredData.filter(r => (r.sex || r.gender || '').toLowerCase().startsWith('f')).length;

  // Calculate percentages
  const malePercent = total ? Math.round((male / total) * 100) : 0;
  const femalePercent = total ? Math.round((female / total) * 100) : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '20px' }}>
      
      {/* CARD 1: OVERVIEW */}
      <div className="stat-card">
        <h3>SELECTED POPULATION</h3>
        <div style={{ marginTop: '20px', color: '#666', fontSize: '14px', lineHeight: '1.6' }}>
            You are viewing demographics for: <br/>
            <strong style={{ color: '#111827', fontSize: '18px' }}>
              {filterCategory === 'All' ? 'All Residents' : filterCategory}
            </strong>
        </div>
      </div>

      {/* CARD 2: DYNAMIC GENDER DISTRIBUTION */}
      <div className="stat-card">
        <h3>GENDER DISTRIBUTION</h3>
        
        {/* Male Bar */}
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '5px' }}>
            <span>Male ({male})</span>
            <strong>{malePercent}%</strong>
          </div>
          <div style={{ width: '100%', background: '#f0f0f0', height: '6px', borderRadius: '3px' }}>
            <div style={{ 
                width: `${malePercent}%`, 
                background: '#2563eb', 
                height: '100%', 
                borderRadius: '3px',
                transition: 'width 0.5s ease-in-out'
            }}></div>
          </div>
        </div>

        {/* Female Bar */}
        <div style={{ marginTop: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '5px' }}>
            <span>Female ({female})</span>
            <strong>{femalePercent}%</strong>
          </div>
          <div style={{ width: '100%', background: '#f0f0f0', height: '6px', borderRadius: '3px' }}>
            <div style={{ 
                width: `${femalePercent}%`, 
                background: '#db2777', 
                height: '100%', 
                borderRadius: '3px',
                transition: 'width 0.5s ease-in-out'
            }}></div>
          </div>
        </div>
      </div>

      {/* CARD 3: FILTER CONTROLS */}
      <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>CATEGORY FILTER</h3>
            
            <select 
                value={filterCategory} 
                onChange={(e) => setFilterCategory(e.target.value)}
                style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    cursor: 'pointer',
                    outline: 'none',
                    background: '#f9fafb',
                    color: '#374151',
                    fontWeight: 500
                }}
            >
                <option value="All">All Residents</option>
                <option value="Minors">Minors (0-17)</option>
                <option value="Adults">Adults (18-59)</option>
                <option value="Seniors">Seniors (60+)</option>
                <option value="4Ps">4Ps Beneficiaries</option>
                <option value="Farmers">Farmers</option>
            </select>
        </div>

        <div style={{ marginTop: '15px', textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: '48px', fontWeight: 800, color: '#1f1f1f', lineHeight: 1 }}>
              {total}
            </div>
            <div style={{ fontSize: '14px', color: '#666', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total {filterCategory === 'All' ? 'Residents' : filterCategory}
            </div>
        </div>
      </div>
    </div>
  );
}