import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, FolderKanban, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { projectsApi } from '../../api/projects.api';
import type { Project, PortalToken } from '../../api/projects.api';

export function ClientPortalPage() {
  const { tenantSlug, token } = useParams<{ tenantSlug: string; token: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [permissions, setPermissions] = useState<PortalToken['permissions'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!tenantSlug || !token) { setError(true); setLoading(false); return; }
    projectsApi.getPortalView(tenantSlug, token)
      .then(res => {
        setProject(res.project);
        setPermissions(res.permissions);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin mb-3" />
        <p className="text-sm text-gray-500 dark:text-slate-400">Loading project...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950">
        <AlertCircle className="w-12 h-12 text-gray-300 dark:text-slate-600 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Invalid Link</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">This link is invalid or has expired.</p>
      </div>
    );
  }

  const taskTotal = project.taskCount || 0;
  const taskDone = project.completedTaskCount || 0;
  const pct = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;
  const phases = project.phases || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-6 py-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <FolderKanban className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
              {project.statusName && (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full mt-0.5"
                  style={{
                    backgroundColor: `${project.statusColor || '#6b7280'}20`,
                    color: project.statusColor || '#6b7280',
                  }}
                >
                  {project.statusName}
                </span>
              )}
            </div>
          </div>
          {project.description && (
            <p className="text-sm text-gray-600 dark:text-slate-400">{project.description}</p>
          )}
          {/* Progress bar */}
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-purple-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{pct}%</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">({taskDone}/{taskTotal} tasks)</span>
          </div>
        </div>
      </div>

      {/* Phases + Tasks */}
      {permissions?.view_tasks !== false && (
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
          {phases.length > 0 ? (
            phases.map(phase => (
              <div
                key={phase.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden"
              >
                {/* Phase header */}
                <div className="flex items-center gap-2.5 px-5 py-3 border-b border-gray-100 dark:border-slate-700">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: phase.color || '#6366f1' }}
                  />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{phase.name}</h3>
                  <span className="text-xs text-gray-400 dark:text-slate-500">
                    {phase.tasks.length} task{phase.tasks.length !== 1 ? 's' : ''}
                  </span>
                  {phase.isComplete && (
                    <span className="ml-auto text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Complete
                    </span>
                  )}
                </div>

                {/* Tasks list */}
                {phase.tasks.length > 0 ? (
                  <ul className="divide-y divide-gray-100 dark:divide-slate-700">
                    {phase.tasks.map(task => (
                      <li key={task.id} className="flex items-center gap-3 px-5 py-2.5">
                        {task.isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-gray-300 dark:text-slate-600 flex-shrink-0" />
                        )}
                        <span className={`text-sm flex-1 ${
                          task.isDone
                            ? 'text-gray-400 dark:text-slate-500 line-through'
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {task.title}
                        </span>
                        {task.dueDate && (
                          <span className="text-xs text-gray-400 dark:text-slate-500">
                            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-3 text-xs text-gray-400 dark:text-slate-500">No tasks in this phase</p>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400 dark:text-slate-500">No phases to display</p>
            </div>
          )}

          {/* Unassigned tasks */}
          {project.unassignedTasks && project.unassignedTasks.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-3 border-b border-gray-100 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Other Tasks</h3>
                <span className="text-xs text-gray-400 dark:text-slate-500">{project.unassignedTasks.length}</span>
              </div>
              <ul className="divide-y divide-gray-100 dark:divide-slate-700">
                {project.unassignedTasks.map(task => (
                  <li key={task.id} className="flex items-center gap-3 px-5 py-2.5">
                    {task.isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-300 dark:text-slate-600 flex-shrink-0" />
                    )}
                    <span className={`text-sm flex-1 ${
                      task.isDone ? 'text-gray-400 dark:text-slate-500 line-through' : 'text-gray-900 dark:text-white'
                    }`}>
                      {task.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="max-w-4xl mx-auto px-6 py-6 text-center">
        <p className="text-xs text-gray-400 dark:text-slate-600">Powered by HiperTeam CRM</p>
      </div>
    </div>
  );
}
