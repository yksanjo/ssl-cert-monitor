'use client';

import { useState } from 'react';
import { Shield, CheckCircle, XCircle, AlertTriangle, Calendar, Building, Lock, Globe, Info } from 'lucide-react';

interface CertInfo {
  domain: string;
  issuer: string;
  subject: string;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  validPercent: number;
  serialNumber: string;
  signatureAlgorithm: string;
  status: 'valid' | 'expiring' | 'expired' | 'error';
}

async function getCertificateInfo(domain: string): Promise<CertInfo> {
  // Using ssllabs-style API through a proxy or directly fetching
  // We'll use a simpler approach: extract from DNS TLSA records
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  
  try {
    // First get the IP
    const ipResponse = await fetch(
      `https://dns.google/resolve?name=${cleanDomain}&type=A`,
      { headers: { Accept: 'application/dns-json' } }
    );
    const ipData = await ipResponse.json();
    
    if (!ipData.Answer) {
      throw new Error('Domain not found');
    }
    
    const ip = ipData.Answer[0].data;
    
    // Use crt.sh API to get certificate info
    const certResponse = await fetch(
      `https://crt.sh/?q=${encodeURIComponent(cleanDomain)}&output=json`
    );
    
    if (!certResponse.ok) {
      throw new Error('Failed to fetch certificate data');
    }
    
    const certs = await certResponse.json();
    
    if (!certs || certs.length === 0) {
      throw new Error('No certificates found');
    }
    
    // Get the most recent certificate
    const latestCert = certs.reduce((a: any, b: any) => 
      new Date(a.not_after) > new Date(b.not_after) ? a : b
    );
    
    const validFrom = new Date(latestCert.not_before);
    const validTo = new Date(latestCert.not_after);
    const now = new Date();
    const totalDays = (validTo.getTime() - validFrom.getTime()) / (1000 * 60 * 60 * 24);
    const daysRemaining = (validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    const validPercent = Math.max(0, Math.min(100, (daysRemaining / totalDays) * 100));
    
    let status: 'valid' | 'expiring' | 'expired' = 'valid';
    if (daysRemaining < 0) {
      status = 'expired';
    } else if (daysRemaining < 30) {
      status = 'expiring';
    }
    
    return {
      domain: cleanDomain,
      issuer: latestCert.issuer_name?.replace(/,/g, ', ') || 'Unknown',
      subject: latestCert.common_name || cleanDomain,
      validFrom: validFrom.toISOString().split('T')[0],
      validTo: validTo.toISOString().split('T')[0],
      daysRemaining: Math.floor(daysRemaining),
      validPercent,
      serialNumber: latestCert.serial_num || 'N/A',
      signatureAlgorithm: latestCert.sig_alg || 'SHA256withRSA',
      status,
    };
    
  } catch (error: any) {
    throw new Error(error.message || 'Failed to fetch certificate info');
  }
}

export default function Home() {
  const [domain, setDomain] = useState('');
  const [result, setResult] = useState<CertInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async () => {
    if (!domain.trim()) {
      setError('Please enter a domain');
      return;
    }
    
    const cleanDomain = domain.trim().toLowerCase();
    setError('');
    setLoading(true);
    setResult(null);

    try {
      const data = await getCertificateInfo(cleanDomain);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch certificate info');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid': return <CheckCircle className="text-green-500" size={32} />;
      case 'expiring': return <AlertTriangle className="text-yellow-500" size={32} />;
      case 'expired': return <XCircle className="text-red-500" size={32} />;
      default: return <AlertTriangle className="text-gray-500" size={32} />;
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'valid': return 'bg-green-500';
      case 'expiring': return 'bg-yellow-500';
      case 'expired': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Shield size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#f4f4f5]">SSL Certificate Monitor</h1>
              <p className="text-sm text-[#71717a]">Check SSL certificate status and expiration</p>
            </div>
          </div>
        </header>

        <div className="card mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
              placeholder="Enter domain (e.g., example.com)"
              className="flex-1 px-4 py-2.5 bg-[#1a1a24] border border-[#27272a] rounded-lg text-[#f4f4f5] placeholder-[#71717a] font-mono text-sm"
            />
            <button
              onClick={handleCheck}
              disabled={loading}
              className="btn-primary flex items-center justify-center gap-2 min-w-[140px]"
            >
              {loading ? <div className="spinner" /> : <><Shield size={16} /> Check</>}
            </button>
          </div>
          {error && <p className="mt-2 text-red-400 text-sm">{error}</p>}
        </div>

        {result && (
          <div className="card animate-fade-in">
            <div className="flex items-center gap-4 mb-6">
              {getStatusIcon(result.status)}
              <div>
                <h3 className="font-semibold text-lg text-[#f4f4f5]">{result.domain}</h3>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  result.status === 'valid' ? 'status-valid' :
                  result.status === 'expiring' ? 'status-warning' :
                  'status-expired'
                }`}>
                  {result.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Days Remaining */}
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[#a1a1aa]">Certificate Validity</span>
                <span className={result.status === 'expired' ? 'text-red-400' : 
                  result.status === 'expiring' ? 'text-yellow-400' : 'text-green-400'}>
                  {result.daysRemaining} days remaining
                </span>
              </div>
              <div className="progress-bar">
                <div 
                  className={`progress-fill ${getProgressColor(result.status)}`}
                  style={{ width: `${result.validPercent}%` }}
                />
              </div>
            </div>

            {/* Certificate Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[#1a1a24] rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={16} className="text-blue-400" />
                  <span className="font-medium">Validity Period</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#71717a]">From</span>
                    <span className="font-mono text-[#a1a1aa]">{result.validFrom}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#71717a]">To</span>
                    <span className="font-mono text-[#a1a1aa]">{result.validTo}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[#1a1a24] rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Building size={16} className="text-purple-400" />
                  <span className="font-medium">Issuer</span>
                </div>
                <p className="text-sm text-[#a1a1aa] break-all">{result.issuer}</p>
              </div>

              <div className="p-4 bg-[#1a1a24] rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Lock size={16} className="text-green-400" />
                  <span className="font-medium">Subject</span>
                </div>
                <p className="text-sm text-[#a1a1aa]">{result.subject}</p>
              </div>

              <div className="p-4 bg-[#1a1a24] rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Globe size={16} className="text-cyan-400" />
                  <span className="font-medium">Technical Details</span>
                </div>
                <div className="space-y-1 text-xs">
                  <p className="text-[#71717a] font-mono">Algorithm: {result.signatureAlgorithm}</p>
                  <p className="text-[#71717a] font-mono">Serial: {result.serialNumber.slice(0, 20)}...</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Info size={16} className="text-[#7c3aed]" />
            About SSL Certificates
          </h3>
          <p className="text-sm text-[#a1a1aa] mb-4">
            SSL certificates encrypt data in transit between your browser and the server. 
            They should be regularly monitored and renewed before expiration to maintain security.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-[#1a1a24] rounded-lg text-center">
              <CheckCircle size={20} className="mx-auto text-green-500 mb-2" />
              <span className="text-sm font-medium">Valid</span>
              <p className="text-xs text-[#71717a]">30+ days remaining</p>
            </div>
            <div className="p-3 bg-[#1a1a24] rounded-lg text-center">
              <AlertTriangle size={20} className="mx-auto text-yellow-500 mb-2" />
              <span className="text-sm font-medium">Expiring</span>
              <p className="text-xs text-[#71717a]">Less than 30 days</p>
            </div>
            <div className="p-3 bg-[#1a1a24] rounded-lg text-center">
              <XCircle size={20} className="mx-auto text-red-500 mb-2" />
              <span className="text-sm font-medium">Expired</span>
              <p className="text-xs text-[#71717a]">Past expiration date</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
