import { useEffect, useState } from 'react';
import { leadSettingsApi } from '../../../../api/leads.api';
import type { Pipeline, LeadStage, LeadPriority } from '../../../../api/leads.api';
import { teamsApi } from '../../../../api/teams.api';
import type { TeamLookupItem } from '../../../../api/teams.api';
import { COUNTRIES } from '../../../../data/countries';

interface ImportSettings {
  duplicateStrategy: 'skip' | 'update' | 'import';
  assignmentStrategy: 'specific_user' | 'unassigned';
  ownerId: string;
  countryCode: string;
  pipelineId: string;
  stageId: string;
  source: string;
  priorityId: string;
  teamId: string;
  tags: string[];
}

interface StepSettingsProps {
  settings: ImportSettings;
  onSettingsChange: (settings: ImportSettings) => void;
}

export default function StepSettings({ settings, onSettingsChange }: StepSettingsProps) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<LeadStage[]>([]);
  const [priorities, setPriorities] = useState<LeadPriority[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<TeamLookupItem[]>([]);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    loadOptions();
  }, []);

  useEffect(() => {
    if (settings.pipelineId) {
      leadSettingsApi.getStages(settings.pipelineId).then(setStages).catch(() => {});
    }
  }, [settings.pipelineId]);

  const loadOptions = async () => {
    try {
      const [pipelinesData, prioritiesData, sourcesData] = await Promise.all([
        leadSettingsApi.getPipelines(),
        leadSettingsApi.getPriorities(),
        leadSettingsApi.getSources(),
      ]);
      setPipelines(pipelinesData);
      setPriorities(prioritiesData);
      setSources(sourcesData);

      // Load stages for default pipeline
      const defaultPipeline = pipelinesData.find(p => p.isDefault) || pipelinesData[0];
      if (defaultPipeline) {
        if (!settings.pipelineId) {
          update('pipelineId', defaultPipeline.id);
        }
        const stagesData = await leadSettingsApi.getStages(settings.pipelineId || defaultPipeline.id);
        setStages(stagesData);
      }
    } catch {
      // ignore
    }

    // Load users for assignment
    try {
      const { api } = await import('../../../../api/contacts.api');
      const { data } = await api.get('/users');
      setUsers(data.data || data || []);
    } catch {
      // ignore
    }

    // Load teams
    try {
      const teamsData = await teamsApi.getLookup();
      setTeams(teamsData.filter(t => t.isActive));
    } catch {
      // ignore
    }
  };

  const update = (key: keyof ImportSettings, value: any) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !settings.tags.includes(tag)) {
      update('tags', [...settings.tags, tag]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    update('tags', settings.tags.filter(t => t !== tag));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Import Settings</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Configure how your leads should be imported.
        </p>
      </div>

      {/* Duplicate Strategy */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Duplicate Handling
        </label>
        <div className="space-y-2">
          {[
            { value: 'skip', label: 'Skip duplicates', desc: 'Do not import leads that match existing records by email or phone' },
            { value: 'update', label: 'Update existing', desc: 'If a duplicate is found, update the existing lead with new data' },
            { value: 'import', label: 'Import anyway', desc: 'Import all leads regardless of duplicates' },
          ].map(opt => (
            <label key={opt.value} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer">
              <input
                type="radio"
                name="duplicateStrategy"
                value={opt.value}
                checked={settings.duplicateStrategy === opt.value}
                onChange={() => update('duplicateStrategy', opt.value)}
                className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Assignment Strategy */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Lead Assignment
        </label>
        <div className="space-y-2">
          {[
            { value: 'specific_user', label: 'Assign to specific user', desc: 'All imported leads will be assigned to the selected user' },
            { value: 'unassigned', label: 'Leave unassigned', desc: 'Import leads without an owner' },
          ].map(opt => (
            <label key={opt.value} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer">
              <input
                type="radio"
                name="assignmentStrategy"
                value={opt.value}
                checked={settings.assignmentStrategy === opt.value}
                onChange={() => update('assignmentStrategy', opt.value)}
                className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
        {settings.assignmentStrategy === 'specific_user' && (
          <select
            value={settings.ownerId}
            onChange={e => update('ownerId', e.target.value)}
            className="mt-2 w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          >
            <option value="">Select user...</option>
            {users.map((u: any) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
            ))}
          </select>
        )}
      </div>

      {/* Country Code */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Default Country Code (for phone normalization)
        </label>
        <select
          value={settings.countryCode}
          onChange={e => update('countryCode', e.target.value)}
          className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
        >
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>{c.name} ({c.dialCode})</option>
          ))}
        </select>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Used when phone numbers don't include a country code prefix
        </p>
      </div>

      {/* Pipeline & Stage */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pipeline</label>
          <select
            value={settings.pipelineId}
            onChange={e => update('pipelineId', e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          >
            <option value="">Default Pipeline</option>
            {pipelines.filter(p => p.isActive).map(p => (
              <option key={p.id} value={p.id}>{p.name}{p.isDefault ? ' (Default)' : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Stage</label>
          <select
            value={settings.stageId}
            onChange={e => update('stageId', e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          >
            <option value="">Default (First Stage)</option>
            {stages.filter(s => s.isActive).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Source & Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Lead Source</label>
          <select
            value={settings.source}
            onChange={e => update('source', e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          >
            <option value="">None</option>
            {sources.map((s: any) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Priority</label>
          <select
            value={settings.priorityId}
            onChange={e => update('priorityId', e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          >
            <option value="">Default</option>
            {priorities.filter(p => p.isActive).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Team */}
      {teams.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Default Team</label>
          <select
            value={settings.teamId}
            onChange={e => update('teamId', e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          >
            <option value="">No team</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Used when the Excel file doesn't have a team column or the team name doesn't match
          </p>
        </div>
      )}

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add tag and press Enter"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          />
          <button
            onClick={addTag}
            className="px-3 py-2 text-sm bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700"
          >
            Add
          </button>
        </div>
        {settings.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {settings.tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs rounded-full">
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-red-500">&times;</button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
