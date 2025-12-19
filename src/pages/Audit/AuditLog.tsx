import { useState, useEffect, useMemo } from 'react';
import './AuditLog.css';

interface AuditProps {
  initialData?: any[];
}

interface LogItem {
  _id: string;
  timestamp: string;
  user: string;
  action: string;
  module: string;
  description: string;
  hash?: string;
  previousHash?: string;
}

export default function AuditLog({ initialData = [] }: AuditProps) {
  const [logs, setLogs] = useState<LogItem[]>(initialData);
  const [loading, setLoading] = useState(initialData.length === 0);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  
  // Verification State
  const [verifyRunning, setVerifyRunning] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ valid: number; invalid: number; firstInvalid?: any } | null>(null);

  // --- 1. FETCH LOGS ---
  useEffect(() => {
    if (initialData.length > 0) {
      setLogs(initialData);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchLogs = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5000/api/audit-logs', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

        const data = await res.json();
        if (!cancelled) setLogs(Array.isArray(data) ? data : []);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to fetch audit logs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLogs();
    return () => { cancelled = true; };
  }, [initialData]);

  // --- 2. FILTERING LOGIC ---
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const hay = `${l.user} ${l.action} ${l.module} ${l.description}`.toLowerCase();
      return hay.includes(q);
    });
  }, [logs, search]);

  const totalEntries = logs.length;

  // --- 3. EXPORT TO CSV ---
  const handleExport = () => {
    if (logs.length === 0) return;

    const headers = ['Timestamp', 'User', 'Action', 'Module', 'Description', 'Hash', 'Previous Hash'];
    
    const rows = filteredLogs.map(log => [
      `"${log.timestamp}"`, // Use raw ISO string for accuracy
      `"${log.user}"`,
      `"${log.action}"`,
      `"${log.module}"`,
      `"${log.description.replace(/"/g, '""')}"`,
      log.hash,
      log.previousHash
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `blockchain_audit_logs_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- 4. WEB3 / BLOCKCHAIN VERIFICATION LOGIC ---
  
  // Helper: SHA-256 Hashing Function
  async function sha256Hex(input: string): Promise<string> {
    const enc = new TextEncoder();
    const data = enc.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const verifyIntegrity = async () => {
    if (!logs || logs.length === 0) {
      alert("No logs to verify.");
      return;
    }

    setVerifyRunning(true);
    setVerifyResult(null);

    try {
      // A. SORT CHRONOLOGICALLY (Oldest -> Newest)
      // The blockchain is built forward in time, so we must verify forward.
      const sortedChain = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      let validCount = 0;
      let invalidCount = 0;
      let firstInvalidLog: any = undefined;

      // B. VERIFY THE CHAIN LOOP
      for (let i = 0; i < sortedChain.length; i++) {
        const currentBlock = sortedChain[i];
        
        // 1. Get Previous Hash (Genesis block uses 000...)
        const prevHash = currentBlock.previousHash || "00000000000000000000000000000000";

        // 2. RECONSTRUCT DATA OBJECT (STRICT ORDER)
        // This must match your Backend's `logAction` function EXACTLY.
        // We use the exact ISO String timestamp from the DB, not a new Date object.
        const dataToVerify = {
            timestamp: currentBlock.timestamp, 
            user: currentBlock.user, 
            action: currentBlock.action, 
            module: currentBlock.module, 
            description: currentBlock.description, 
            previousHash: prevHash 
        };

        // 3. RE-HASH THE DATA
        const calculatedHash = await sha256Hex(JSON.stringify(dataToVerify));
        const storedHash = (currentBlock.hash || '').toLowerCase();

        // 4. COMPARE
        if (calculatedHash === storedHash) {
          validCount++;
        } else {
          invalidCount++;
          if (!firstInvalidLog) {
            firstInvalidLog = { 
                index: i, 
                expected: calculatedHash, 
                actual: storedHash, 
                log: currentBlock 
            };
            
            // Log details to console for debugging
            console.group(`❌ Block #${i} Verification Failed`);
            console.log("Log ID:", currentBlock._id);
            console.log("Payload Hashed:", JSON.stringify(dataToVerify));
            console.log("Expected Hash:", calculatedHash);
            console.log("Stored Hash:", storedHash);
            console.groupEnd();
          }
        }
      }

      setVerifyResult({ valid: validCount, invalid: invalidCount, firstInvalid: firstInvalidLog });
      
      if (invalidCount > 0) {
        alert(`⚠️ TAMPERING DETECTED!\n\n${invalidCount} blocks in the chain are invalid.\nCheck the console (F12) to see exactly which record failed.`);
      } else {
        alert(`✅ INTEGRITY VERIFIED.\n\nSuccessfully verified ${validCount} blocks.\nThe cryptographic chain is intact.`);
      }

    } catch (err: any) {
      console.error(err);
      setError('Verification crashed: ' + err.message);
    } finally {
      setVerifyRunning(false);
    }
  };

  return (
    <div className="auditlog-body">

      {/* HEADER */}
      <div className="auditlog-header-row">
        <div>
          <h1 className="auditlog-title">Audit Log (Blockchain)</h1>
          <p className="auditlog-subtitle">
            An immutable, verifiable record of all system actions.
          </p>
        </div>

        <div className="auditlog-header-actions">
          <button
            className="auditlog-btn auditlog-btn-white"
            onClick={verifyIntegrity}
            disabled={verifyRunning || logs.length === 0}
          >
            <i className={`fas ${verifyRunning ? 'fa-spinner fa-spin' : 'fa-shield-alt'}`}></i>
            {verifyRunning ? ' Verifying Chain...' : ' Verify Integrity'}
          </button>

          <button className="auditlog-btn auditlog-btn-black" onClick={handleExport}>
            <i className="fas fa-file-export"></i> Export CSV
          </button>
        </div>
      </div>

      {/* SEARCH */}
      <div className="auditlog-filters">
           <input 
             type="text" 
             placeholder="Search user, action, or hash..." 
             value={search} 
             onChange={(e) => setSearch(e.target.value)}
             className="search-input"
             style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '300px', backgroundColor: '#f9f9f9' ,color: '#333'}}
           />
      </div>

      {/* TABLE CARD */}
      <div className="auditlog-table-card">

        <div className="auditlog-card-header">
          <h3>Audit Trail ({totalEntries} Blocks)</h3>
          {verifyResult && verifyResult.invalid > 0 && (
             <span style={{ color: '#dc2626', marginLeft: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                 <i className="fas fa-exclamation-triangle"></i> Chain Broken: {verifyResult.invalid} errors found
             </span>
          )}
          {verifyResult && verifyResult.invalid === 0 && (
             <span style={{ color: '#16a34a', marginLeft: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                 <i className="fas fa-check-circle"></i> Chain Verified
             </span>
          )}
        </div>

        <div className="auditlog-table-scroll">
          <table className="auditlog-table">
            <thead>
              <tr>
                <th className="auditlog-col-ts">TIMESTAMP</th>
                <th className="auditlog-col-user">USER</th>
                <th className="auditlog-col-action">ACTION</th>
                <th className="auditlog-col-module">MODULE</th>
                <th>DESCRIPTION</th>
                <th className="auditlog-col-hash">HASH (SHA-256)</th>
              </tr>
            </thead>

            <tbody>
              {loading && totalEntries === 0 ? (
                <tr><td colSpan={6} className="auditlog-empty">Loading chain from server...</td></tr>
              ) : filteredLogs.length > 0 ? (
                filteredLogs.map(log => {
                   // Check if this specific log failed verification
                   const isInvalid = verifyResult?.firstInvalid?.log._id === log._id;

                   return (
                      <tr key={log._id} style={isInvalid ? { backgroundColor: '#fee2e2' } : {}}>
                        <td className="auditlog-col-ts text-muted">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="auditlog-col-user fw-bold">{log.user}</td>
                        <td className="auditlog-col-action">
                          <span className={`auditlog-badge ${String(log.action || '').toLowerCase()}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="auditlog-col-module">{log.module}</td>
                        <td className="auditlog-col-desc">{log.description}</td>
                        <td className="auditlog-col-hash" style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>
                           {isInvalid ? (
                               <span style={{color: '#dc2626', fontWeight: 'bold'}}>
                                   <i className="fas fa-times-circle"></i> HASH MISMATCH
                               </span>
                           ) : (
                               <>
                                 <div title={log.hash}>Curr: {(log.hash || '').substring(0, 16)}...</div>
                                 <div title={log.previousHash} style={{fontSize: 9, color: '#9ca3af'}}>Prev: {(log.previousHash || '').substring(0, 16)}...</div>
                               </>
                           )}
                        </td>
                      </tr>
                   );
                })
              ) : (
                <tr><td colSpan={6} className="auditlog-empty">No audit logs found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}