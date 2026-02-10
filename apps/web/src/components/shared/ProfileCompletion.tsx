import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, AlertCircle } from 'lucide-react';

export interface ProfileCompletionData {
  percentage: number;
  filledFields: string[];
  missingFields: { key: string; label: string; weight: number }[];
  totalWeight: number;
  earnedWeight: number;
}

interface ProfileCompletionProps {
  completion: ProfileCompletionData;
  showDetails?: boolean;
}

export function ProfileCompletion({ completion, showDetails = true }: ProfileCompletionProps) {
  const [expanded, setExpanded] = useState(false);

  const { percentage, missingFields } = completion;

  // Determine color based on percentage
  const getColor = () => {
    if (percentage >= 80) return { bg: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-100 dark:bg-emerald-900/30' };
    if (percentage >= 50) return { bg: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-100 dark:bg-amber-900/30' };
    return { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-100 dark:bg-red-900/30' };
  };

  const color = getColor();

  // Calculate circle progress
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
      <div className="flex items-center gap-4">
        {/* Circular Progress */}
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-24 h-24 transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-gray-200 dark:text-slate-700"
            />
            {/* Progress circle */}
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              className={color.text}
              style={{
                strokeDasharray: circumference,
                strokeDashoffset,
                transition: 'stroke-dashoffset 0.5s ease',
              }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-2xl font-bold ${color.text}`}>{percentage}%</span>
          </div>
        </div>

        {/* Text Content */}
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
            Profile Completion
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {percentage >= 80 ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="w-4 h-4" /> Great! Profile is well filled
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                {missingFields.length} field{missingFields.length !== 1 ? 's' : ''} to complete
              </span>
            )}
          </p>

          {showDetails && missingFields.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1"
            >
              {expanded ? (
                <>Hide details <ChevronUp className="w-4 h-4" /></>
              ) : (
                <>Show missing fields <ChevronDown className="w-4 h-4" /></>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expandable Missing Fields */}
      {expanded && missingFields.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase mb-2">
            Missing Fields (by priority)
          </p>
          <div className="space-y-2">
            {missingFields.slice(0, 5).map((field) => (
              <div
                key={field.key}
                className={`flex items-center justify-between px-3 py-2 rounded-lg ${color.light}`}
              >
                <span className="text-sm text-gray-700 dark:text-slate-300">{field.label}</span>
                <span className="text-xs text-gray-500 dark:text-slate-400">+{field.weight} pts</span>
              </div>
            ))}
            {missingFields.length > 5 && (
              <p className="text-xs text-gray-400 dark:text-slate-500 text-center">
                +{missingFields.length - 5} more field{missingFields.length - 5 !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}