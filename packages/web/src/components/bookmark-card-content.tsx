import { useState, type ReactNode } from 'react';

import type { Bookmark } from '../types';

type BookmarkCardBookmark = Pick<
  Bookmark,
  'url' | 'title' | 'description' | 'imageUrl' | 'faviconUrl'
>;

export function BookmarkCardContent({
  bookmark,
  metadata,
}: {
  bookmark: BookmarkCardBookmark;
  metadata?: ReactNode;
}) {
  const [imageError, setImageError] = useState(false);
  const displayTitle = bookmark.title || bookmark.url;
  const showImage = bookmark.imageUrl && !imageError;

  return (
    <>
      <div className="aspect-[1.91/1] w-full overflow-hidden bg-gray-100">
        {showImage ? (
          <img
            src={bookmark.imageUrl!}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-gray-300"
            data-testid="bookmark-image-placeholder"
          >
            <ImagePlaceholderIcon />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <div className="mb-1 flex min-h-[2.5rem] items-center gap-1.5">
          {bookmark.faviconUrl && (
            <img
              src={bookmark.faviconUrl}
              alt=""
              className="h-4 w-4 shrink-0"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          )}
          <h3 className="line-clamp-2 text-sm font-medium text-gray-900">{displayTitle}</h3>
        </div>
        {bookmark.description && (
          <p className="line-clamp-2 text-xs text-gray-500">{bookmark.description}</p>
        )}
        <p className="mt-auto truncate text-xs text-gray-400">{bookmark.url}</p>
        {metadata}
      </div>
    </>
  );
}

export function BookmarkCardSkeleton({ testId }: { testId?: string }) {
  return (
    <div
      className="animate-pulse overflow-hidden rounded-lg border border-gray-200"
      data-testid={testId}
    >
      <div className="aspect-[1.91/1] overflow-hidden bg-gray-200" />
      <div className="space-y-2 p-3">
        <div className="min-h-[2.5rem]">
          <div className="h-4 w-3/4 rounded bg-gray-200" />
        </div>
        <div className="h-3 w-full rounded bg-gray-200" />
      </div>
    </div>
  );
}

function ImagePlaceholderIcon() {
  return (
    <svg className="h-10 w-10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
    </svg>
  );
}
