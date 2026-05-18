import { type FormEvent, useState } from 'react';

import { useCreateBookmark } from '../hooks/use-create-bookmark';

export function AddBookmarkForm({ folderPath }: { folderPath: string | null }) {
  const [url, setUrl] = useState('');
  const { mutate, isPending, error, reset } = useCreateBookmark();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    mutate(
      { url: trimmed, folderPath },
      {
        onSuccess: () => {
          setUrl('');
          reset();
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) reset();
          }}
          placeholder="URLを入力してブックマークを追加"
          required
          disabled={isPending}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 md:py-2"
        />
        <button
          type="submit"
          disabled={isPending || !url.trim()}
          className="shrink-0 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 md:py-2"
        >
          {isPending ? (
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              追加中
            </span>
          ) : (
            '追加'
          )}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error.message}</p>}
    </form>
  );
}
