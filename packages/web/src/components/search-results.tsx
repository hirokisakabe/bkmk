import { useState } from 'react';

import { useSearch } from '../hooks/use-search';
import type { SearchResult } from '../types';

export function SearchResults({ query }: { query: string }) {
  const { data: results, isLoading } = useSearch(query);

  return (
    <div>
      {isLoading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-gray-200 p-4">
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-gray-200" />
                  <div className="h-3 w-full rounded bg-gray-200" />
                  <div className="h-3 w-1/2 rounded bg-gray-200" />
                </div>
                <div className="h-20 w-32 shrink-0 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && results?.length === 0 && (
        <div className="py-12 text-center text-gray-400">
          <p className="text-lg">検索結果はありません</p>
        </div>
      )}

      {!isLoading && results && results.length > 0 && (
        <div className="space-y-3">
          {results.map((result) => (
            <SearchResultCard key={result.id} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const [imageError, setImageError] = useState(false);
  const displayTitle = result.title || result.url;
  const folderLabel = result.folder ? result.folder.path : 'ルート';

  return (
    <a
      href={result.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-300 hover:bg-gray-50"
    >
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            {result.faviconUrl && (
              <img
                src={result.faviconUrl}
                alt=""
                className="h-4 w-4 shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <h3 className="truncate font-medium text-gray-900">{displayTitle}</h3>
          </div>

          {result.description && (
            <p className="mb-1 line-clamp-2 text-sm text-gray-500">{result.description}</p>
          )}

          <p className="truncate text-xs text-gray-400">{result.url}</p>

          <p className="mt-1 text-xs text-blue-500">
            <FolderIcon />
            <span className="ml-1">{folderLabel}</span>
          </p>
        </div>

        {result.imageUrl && !imageError && (
          <img
            src={result.imageUrl}
            alt=""
            className="h-20 w-32 shrink-0 rounded object-cover"
            onError={() => setImageError(true)}
          />
        )}
      </div>
    </a>
  );
}

function FolderIcon() {
  return (
    <svg className="inline-block h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  );
}
