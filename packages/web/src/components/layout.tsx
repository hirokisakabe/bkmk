import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  PointerSensor,
  useDndContext,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Link, useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { collisionDetection } from '../lib/dnd-collision';
import type { Bookmark } from '../types';
import { BookmarkCardPreview } from './bookmark-list';
import { FolderTree } from './folder-tree';

export function Layout({
  children,
  onDragEnd,
}: {
  children: ReactNode;
  onDragEnd?: (event: DragEndEvent) => void;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const location = useRouterState({ select: (s) => s.location });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const search = location.search as Record<string, unknown>;
  const isOnIndex = location.pathname === '/';
  const folder = typeof search.folder === 'string' ? search.folder : undefined;
  const q =
    typeof search.q === 'string' && search.q.trim().length > 0 ? search.q.trim() : undefined;
  const isSearching = !!q;
  const urlSearchValue = isOnIndex ? (q ?? '') : '';
  const [searchValue, setSearchValue] = useState(urlSearchValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const searchRevisionRef = useRef(0);
  const isHistoryNavigationRef = useRef(false);
  const submittedRevision = (location.state as unknown as Record<string, unknown>)
    .bkmkSearchRevision;

  useEffect(() => {
    return router.history.subscribe(({ action }) => {
      if (action.type === 'BACK' || action.type === 'FORWARD' || action.type === 'GO') {
        isHistoryNavigationRef.current = true;
      }
    });
  }, [router]);

  useEffect(() => {
    const isHistoryNavigation = isHistoryNavigationRef.current;
    isHistoryNavigationRef.current = false;

    if (
      !isHistoryNavigation &&
      typeof submittedRevision === 'number' &&
      submittedRevision <= searchRevisionRef.current
    ) {
      return;
    }

    searchRevisionRef.current += 1;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    // URL/history is external state; an external navigation intentionally replaces local input.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchValue(urlSearchValue);
  }, [submittedRevision, urlSearchValue]);

  useEffect(() => {
    return () => {
      searchRevisionRef.current += 1;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const handleSearchChange = (input: string) => {
    setSearchValue(input);
    searchRevisionRef.current += 1;
    const revision = searchRevisionRef.current;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (revision !== searchRevisionRef.current) return;

      const query = input.trim();
      setSearchValue(query);
      void navigate({
        to: '/',
        search: {
          folder: query ? undefined : isOnIndex ? folder : undefined,
          q: query || undefined,
        },
        state: (previous) => ({ ...previous, bkmkSearchRevision: revision }),
      });
      setSidebarOpen(false);
      debounceRef.current = null;
    }, 300);
  };

  const handleSelectFolder = (path: string | null) => {
    navigate({
      to: '/',
      search: { folder: path ?? undefined, q: undefined },
    });
    setSidebarOpen(false);
  };

  const selectedFolder = isOnIndex && !isSearching ? (folder ?? null) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragEnd={onDragEnd ?? (() => {})}
    >
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex h-dvh">
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-gray-50 p-4 transition-transform duration-300 md:static md:translate-x-0 ${
            sidebarOpen
              ? 'translate-x-0'
              : '-translate-x-full pointer-events-none md:pointer-events-auto'
          }`}
        >
          <div className="mb-4 flex items-center justify-between">
            <Link to="/" onClick={() => setSidebarOpen(false)}>
              <h1 className="text-lg font-bold">bkmk</h1>
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="flex h-11 w-11 items-center justify-center rounded text-gray-500 hover:bg-gray-200 md:hidden"
              aria-label="サイドバーを閉じる"
            >
              <CloseIcon />
            </button>
          </div>
          <FolderTree selectedFolder={selectedFolder} onSelectFolder={handleSelectFolder} />
          <div className="mt-auto space-y-1">
            <Link
              to="/trash"
              onClick={() => setSidebarOpen(false)}
              className="flex min-h-[44px] items-center gap-2 rounded px-2 text-sm text-gray-500 hover:bg-gray-200 hover:text-gray-700"
            >
              <TrashIcon />
              ゴミ箱
            </Link>
            <Link
              to="/settings"
              onClick={() => setSidebarOpen(false)}
              className="flex min-h-[44px] items-center gap-2 rounded px-2 text-sm text-gray-500 hover:bg-gray-200 hover:text-gray-700"
            >
              <SettingsIcon />
              設定
            </Link>
            <a
              href="https://github.com/hirokisakabe/bkmk"
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[44px] items-center gap-2 rounded px-2 text-sm text-gray-500 hover:bg-gray-200 hover:text-gray-700"
            >
              <GitHubIcon />
              GitHub
            </a>
          </div>
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-gray-50 px-2 md:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded text-gray-600 hover:bg-gray-200"
              aria-label="メニューを開く"
            >
              <HamburgerIcon />
            </button>
            {mobileSearchOpen || q ? (
              <SearchInput
                value={searchValue}
                onChange={handleSearchChange}
                ariaLabel="モバイルでブックマークを検索"
                className="min-w-0 flex-1"
                autoFocus={mobileSearchOpen}
              />
            ) : (
              <>
                <Link to="/" className="mr-auto">
                  <span className="text-base font-bold">bkmk</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileSearchOpen(true)}
                  className="flex h-11 w-11 items-center justify-center rounded text-gray-600 hover:bg-gray-200"
                  aria-label="検索を開く"
                >
                  <SearchGlyph className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
          <main className="flex-1 overflow-y-auto p-4">
            <SearchInput
              value={searchValue}
              onChange={handleSearchChange}
              ariaLabel="ブックマークを検索"
              className="float-right mb-4 ml-4 hidden w-full max-w-[22rem] md:block"
            />
            {children}
          </main>
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        <BookmarkDragOverlayContent />
      </DragOverlay>
    </DndContext>
  );
}

function BookmarkDragOverlayContent() {
  // useDndContext で active 情報を取り、bookmark drag のときだけ overlay を出す。
  // state を別途持たないことで onDragEnd 後の余計な再 render を避ける。
  const { active } = useDndContext();
  const data = active?.data.current;
  if (!data || data.type !== 'bookmark') return null;
  // DragOverlay は position: fixed + 高い z-index で viewport 基準描画されるため、
  // 元の grid のサイズ計算が効かない。active 要素の初期 rect の width を渡して
  // 元のカードと同じ幅で表示する。
  const width = active?.rect.current.initial?.width;
  return (
    <div style={width ? { width } : undefined}>
      <BookmarkCardPreview bookmark={data.bookmark as Bookmark} />
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  ariaLabel,
  className,
  autoFocus = false,
}: {
  value: string;
  onChange: (query: string) => void;
  ariaLabel: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={`relative ${className ?? ''}`}>
      <SearchGlyph className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        placeholder="ブックマークを検索..."
        className="w-full rounded-md border border-gray-300 py-1.5 pr-2 pl-8 text-sm placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
      />
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SearchGlyph({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}
