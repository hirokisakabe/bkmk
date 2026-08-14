import { useSearch } from '../hooks/use-search';
import type { SearchResult } from '../types';
import { BookmarkCardContent, BookmarkCardSkeleton } from './bookmark-card-content';

export function SearchResults({ query }: { query: string }) {
  const { data: results, isLoading } = useSearch(query);

  return (
    <div>
      {isLoading && (
        <div
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
          data-testid="search-results-grid"
        >
          {[...Array(6)].map((_, i) => (
            <BookmarkCardSkeleton key={i} testId="search-result-loading-skeleton" />
          ))}
        </div>
      )}

      {!isLoading && results?.length === 0 && (
        <div className="py-12 text-center text-gray-400">
          <p className="text-lg">検索結果はありません</p>
        </div>
      )}

      {!isLoading && results && results.length > 0 && (
        <div
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
          data-testid="search-results-grid"
        >
          {results.map((result) => (
            <SearchResultCard key={result.id} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const folderLabel = result.folder?.path ?? '未分類';

  return (
    <a
      href={result.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-colors hover:border-gray-300 hover:bg-gray-50"
      data-testid={`search-result-card-${result.id}`}
    >
      <BookmarkCardContent
        bookmark={result}
        metadata={
          <p className="mt-2 flex min-w-0 items-center gap-1 text-xs text-blue-500">
            <FolderIcon />
            <span className="truncate">{folderLabel}</span>
          </p>
        }
      />
    </a>
  );
}

function FolderIcon() {
  return (
    <svg className="h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  );
}
