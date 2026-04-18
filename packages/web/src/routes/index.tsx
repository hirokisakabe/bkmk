import { createRoute, useNavigate } from '@tanstack/react-router';

import { BookmarkList } from '../components/bookmark-list';
import { FolderTree } from '../components/folder-tree';
import { Layout, SearchInput } from '../components/layout';
import { SearchResults } from '../components/search-results';
import { requireAuth } from '../lib/auth-guard';
import { rootRoute } from './__root';

interface IndexSearch {
  folder: string | null;
  deep: boolean;
  q: string | null;
}

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>): IndexSearch => ({
    folder: typeof search.folder === 'string' ? search.folder : null,
    deep: search.deep === 'true' || search.deep === true,
    q: typeof search.q === 'string' && search.q.trim().length > 0 ? search.q.trim() : null,
  }),
  component: IndexPage,
});

function IndexPage() {
  const { folder, deep, q } = indexRoute.useSearch();
  const navigate = useNavigate();

  const handleSearch = (query: string) => {
    navigate({
      to: '/',
      search: {
        folder: query ? null : folder,
        deep: query ? false : deep,
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
              search: { folder: path, deep: false, q: null },
            })
          }
        />
      }
    >
      {isSearching ? (
        <SearchResults query={q} />
      ) : (
        <BookmarkList
          folderPath={folder}
          folderName={folderName}
          deep={deep}
          onToggleDeep={(newDeep) =>
            navigate({
              to: '/',
              search: { folder, deep: newDeep, q: null },
            })
          }
        />
      )}
    </Layout>
  );
}
