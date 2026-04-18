import { useState } from 'react';

import { useBookmarks } from '../hooks/use-bookmarks';
import type { Bookmark } from '../types';

export function BookmarkList({
  folderPath,
  folderName,
  deep,
  onToggleDeep,
}: {
  folderPath: string | null;
  folderName: string;
  deep: boolean;
  onToggleDeep: (deep: boolean) => void;
}) {
  const { data: bookmarks, isLoading } = useBookmarks(folderPath, deep);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">{folderName}</h2>
        {folderPath !== null && (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={deep}
              onChange={(e) => onToggleDeep(e.target.checked)}
              className="rounded border-gray-300"
            />
            サブフォルダを含む
          </label>
        )}
      </div>

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

      {!isLoading && bookmarks?.length === 0 && (
        <div className="py-12 text-center text-gray-400">
          <p className="text-lg">ブックマークはありません</p>
        </div>
      )}

      {!isLoading && bookmarks && bookmarks.length > 0 && (
        <div className="space-y-3">
          {bookmarks.map((bookmark) => (
            <BookmarkCard key={bookmark.id} bookmark={bookmark} />
          ))}
        </div>
      )}
    </div>
  );
}

function BookmarkCard({ bookmark }: { bookmark: Bookmark }) {
  const [imageError, setImageError] = useState(false);
  const displayTitle = bookmark.title || bookmark.url;

  return (
    <a
      href={bookmark.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-300 hover:bg-gray-50"
    >
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            {bookmark.faviconUrl && (
              <img
                src={bookmark.faviconUrl}
                alt=""
                className="h-4 w-4 shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <h3 className="truncate font-medium text-gray-900">{displayTitle}</h3>
          </div>

          {bookmark.description && (
            <p className="mb-1 line-clamp-2 text-sm text-gray-500">{bookmark.description}</p>
          )}

          <p className="truncate text-xs text-gray-400">{bookmark.url}</p>
        </div>

        {bookmark.imageUrl && !imageError && (
          <img
            src={bookmark.imageUrl}
            alt=""
            className="h-20 w-32 shrink-0 rounded object-cover"
            onError={() => setImageError(true)}
          />
        )}
      </div>
    </a>
  );
}
