import { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { generalSettingsApi } from '../../api/generalSettings.api';

interface CompanyInfo {
  companyName: string | null;
  tagline: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logoUrl: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  taxId: string | null;
  registrationNo: string | null;
}

interface CompanyLetterheadProps {
  compact?: boolean;
  className?: string;
}

let cachedCompany: CompanyInfo | null = null;

export function CompanyLetterhead({ compact = false, className = '' }: CompanyLetterheadProps) {
  const [company, setCompany] = useState<CompanyInfo | null>(cachedCompany);

  useEffect(() => {
    if (cachedCompany) return;
    generalSettingsApi.getCompany()
      .then((data: CompanyInfo) => {
        cachedCompany = data;
        setCompany(data);
      })
      .catch(() => {});
  }, []);

  if (!company || !company.companyName) return null;

  const addressParts = [company.address, company.city, company.state, company.postalCode, company.country]
    .filter(Boolean)
    .join(', ');

  if (compact) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        {company.logoUrl ? (
          <img src={company.logoUrl} alt={company.companyName} className="h-8 w-8 object-contain rounded" />
        ) : (
          <div className="h-8 w-8 bg-purple-100 dark:bg-purple-900/30 rounded flex items-center justify-center">
            <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{company.companyName}</p>
          {company.tagline && <p className="text-xs text-gray-500 dark:text-slate-400">{company.tagline}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={`border-b border-gray-200 dark:border-slate-700 pb-4 mb-4 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {company.logoUrl ? (
            <img src={company.logoUrl} alt={company.companyName} className="h-12 w-12 object-contain rounded-lg" />
          ) : (
            <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{company.companyName}</h2>
            {company.tagline && <p className="text-sm text-gray-500 dark:text-slate-400">{company.tagline}</p>}
          </div>
        </div>
        <div className="text-right text-xs text-gray-500 dark:text-slate-400 space-y-0.5">
          {company.website && <p>{company.website}</p>}
          {company.email && <p>{company.email}</p>}
          {company.phone && <p>{company.phone}</p>}
        </div>
      </div>
      {(addressParts || company.taxId || company.registrationNo) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 dark:text-slate-500">
          {addressParts && <span>{addressParts}</span>}
          {company.registrationNo && <span>Reg: {company.registrationNo}</span>}
          {company.taxId && <span>Tax ID: {company.taxId}</span>}
        </div>
      )}
    </div>
  );
}

export function useCompanyInfo() {
  const [company, setCompany] = useState<CompanyInfo | null>(cachedCompany);

  useEffect(() => {
    if (cachedCompany) {
      setCompany(cachedCompany);
      return;
    }
    generalSettingsApi.getCompany()
      .then((data: CompanyInfo) => {
        cachedCompany = data;
        setCompany(data);
      })
      .catch(() => {});
  }, []);

  return company;
}
