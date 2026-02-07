import { Plus, Trash2 } from 'lucide-react';

interface MultiInputProps<T> {
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (item: T, index: number, onChange: (item: T) => void) => React.ReactNode;
  createEmpty: () => T;
  label: string;
  maxItems?: number;
}

export function MultiInput<T>({ 
  items, 
  onChange, 
  renderItem, 
  createEmpty, 
  label,
  maxItems = 5 
}: MultiInputProps<T>) {
  const addItem = () => {
    if (items.length < maxItems) {
      onChange([...items, createEmpty()]);
    }
  };

  const updateItem = (index: number, item: T) => {
    const newItems = [...items];
    newItems[index] = item;
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          {label}
        </label>
        {items.length < maxItems && (
          <button
            type="button"
            onClick={addItem}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <button
          type="button"
          onClick={addItem}
          className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl text-gray-500 dark:text-slate-400 hover:border-gray-400 dark:hover:border-slate-600 transition-colors text-sm"
        >
          Click to add {label.toLowerCase()}
        </button>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="flex gap-2">
              <div className="flex-1">
                {renderItem(item, index, (updated) => updateItem(index, updated))}
              </div>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="p-2.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors self-start"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}