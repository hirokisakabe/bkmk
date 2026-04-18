import { createRoute, useNavigate } from '@tanstack/react-router';

import { BookmarkList } from '../components/bookmark-list';
import { FolderTree } from '../components/folder-tree';
import { Layout } from '../components/layout';
import { requireAuth } from '../lib/auth-guard';
import { rootRoute } from './__root';

interface IndexSearch {
  folder: string | null;
  deep: boolean;
}

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>): IndexSearch => ({
    folder: typeof search.folder === 'string' ? search.folder : null,
    deep: search.deep === 'true' || search.deep === true,
  }),
  component: IndexPage,
});

function IndexPage() {
  const { folder, deep } = indexRoute.useSearch();
  const navigate = useNavigate();

  const folderName = folder ? folder.split('/').pop() || folder : 'すべて';

  return (
    <Layout
      sidebar={
        <FolderTree
          selectedFolder={folder}
          onSelectFolder={(path) =>
            navigate({
              to: '/',
              search: { folder: path, deep: false },
            })
          }
        />
      }
    >
      <BookmarkList
        folderPath={folder}
        folderName={folderName}
        deep={deep}
        onToggleDeep={(newDeep) =>
          navigate({
            to: '/',
            search: { folder, deep: newDeep },
          })
        }
      />
    </Layout>
  );
}
