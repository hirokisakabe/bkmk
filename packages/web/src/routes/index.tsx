import { createRoute, useNavigate } from '@tanstack/react-router';

import { BookmarkList } from '../components/bookmark-list';
import { FolderTree } from '../components/folder-tree';
import { Layout, SearchInput } from '../components/layout';
import { SearchResults } from '../components/search-results';
import { requireAuth } from '../lib/auth-guard';
import { rootRoute } from './__root';

interface IndexSearch {
  folder: string | null;
  q: string | null;
}

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>): IndexSearch => ({
    folder: typeof search.folder === 'string' ? search.folder : null,
    q: typeof search.q === 'string' && search.q.trim().length > 0 ? search.q.trim() : null,
  }),
  component: IndexPage,
});

function IndexPage() {
  const { folder, q } = indexRoute.useSearch();
  const navigate = useNavigate();

  const handleSearch = (query: string) => {
    navigate({
      to: '/',
      search: {
        folder: query ? null : folder,
        q: query || null,
      },
    });
  };

  const folderName = folder ? folder.split('/').pop() || folder : 'すべて';
  const isSearching = !!q;

  return (
    <Layout
      searchInput={<SearchInput key={q ?? ''} defaultValue={q ?? ''} onSearch={handleSearch} />}
      sidebar={
        <FolderTree
          selectedFolder={isSearching ? null : folder}
          onSelectFolder={(path) =>
            navigate({
              to: '/',
              search: { folder: path, q: null },
            })
          }
        />
      }
    >
      {isSearching ? (
        <SearchResults query={q} />
      ) : (
        <BookmarkList folderPath={folder} folderName={folderName} />
      )}
    </Layout>
  );
}
