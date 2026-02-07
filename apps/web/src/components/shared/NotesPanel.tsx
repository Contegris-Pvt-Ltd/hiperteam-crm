import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Send, Pin, Trash2, User } from 'lucide-react';

interface Note {
  id: string;
  content: string;
  isPinned: boolean;
  createdBy: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

interface NotesPanelProps {
  notes: Note[];
  loading?: boolean;
  onAddNote: (content: string) => Promise<void>;
  onDeleteNote?: (id: string) => Promise<void>;
  onTogglePin?: (id: string) => Promise<void>;
}

export function NotesPanel({ notes, loading, onAddNote, onDeleteNote, onTogglePin }: NotesPanelProps) {
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || submitting) return;

    setSubmitting(true);
    try {
      await onAddNote(newNote.trim());
      setNewNote('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add Note Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note..."
          rows={2}
          className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <button
          type="submit"
          disabled={!newNote.trim() || submitting}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed self-end"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Notes List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-slate-400">No notes yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`p-4 rounded-xl border ${
                note.isPinned
                  ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                  : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap flex-1">
                  {note.content}
                </p>
                <div className="flex items-center gap-1">
                  {onTogglePin && (
                    <button
                      onClick={() => onTogglePin(note.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        note.isPinned
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'
                      }`}
                    >
                      <Pin className="w-4 h-4" />
                    </button>
                  )}
                  {onDeleteNote && (
                    <button
                      onClick={() => onDeleteNote(note.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                <User className="w-3 h-3" />
                <span>{note.createdBy.firstName} {note.createdBy.lastName}</span>
                <span>•</span>
                <time>{formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}</time>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}