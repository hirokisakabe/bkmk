import { http, HttpResponse } from 'msw';

import type { Bookmark, Folder, SearchResult } from '../types';

const mockFolders: Folder[] = [
  {
    id: 'folder-1',
    userId: 'test-user',
    name: 'work',
    path: '/work',
    parentPath: null,
    position: 0,
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
];

export const mockBookmarks: Bookmark[] = [
  {
    id: 'bk-1',
    userId: 'test-user',
    url: 'https://example.com',
    title: 'Example Site',
    description: 'An example website',
    imageUrl: null,
    faviconUrl: 'https://example.com/favicon.ico',
    folderPath: null,
    position: 0,
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'bk-2',
    userId: 'test-user',
    url: 'https://example.org',
    title: 'Another Site',
    description: null,
    imageUrl: null,
    faviconUrl: 'https://example.org/favicon.ico',
    folderPath: null,
    position: 1,
    deletedAt: null,
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
  {
    id: 'bk-3',
    userId: 'test-user',
    url: 'https://work.example.com',
    title: 'Work Site',
    description: null,
    imageUrl: null,
    faviconUrl: 'https://work.example.com/favicon.ico',
    folderPath: '/work',
    position: 0,
    deletedAt: null,
    createdAt: '2024-01-03T00:00:00.000Z',
    updatedAt: '2024-01-03T00:00:00.000Z',
  },
];

const mockSearchResults: SearchResult[] = [
  {
    ...mockBookmarks[0],
    folder: null,
  },
];

const mockTrashData = {
  folders: [
    {
      ...mockFolders[0],
      deletedAt: '2024-06-01T00:00:00.000Z',
    },
  ],
  bookmarks: [
    {
      ...mockBookmarks[0],
      deletedAt: '2024-06-01T00:00:00.000Z',
    },
  ],
};

export const handlers = [
  // Bookmarks
  http.get('/api/bookmarks', ({ request }) => {
    const url = new URL(request.url);
    const folder = url.searchParams.get('folder');
    const deep = url.searchParams.get('deep') === 'true';
    const limit = url.searchParams.get('limit');

    let filtered: Bookmark[];
    if (!folder && deep) {
      filtered = mockBookmarks;
    } else if (!folder && !deep) {
      filtered = mockBookmarks.filter((b) => b.folderPath === null);
    } else if (folder && deep) {
      filtered = mockBookmarks.filter(
        (b) => b.folderPath === folder || b.folderPath?.startsWith(folder + '/'),
      );
    } else {
      filtered = mockBookmarks.filter((b) => b.folderPath === folder);
    }

    if (limit) {
      return HttpResponse.json({ data: filtered, nextCursor: null });
    }
    return HttpResponse.json(filtered);
  }),

  http.post('/api/bookmarks', async ({ request }) => {
    const body = (await request.json()) as { url: string };
    const created: Bookmark = {
      id: 'bk-new',
      userId: 'test-user',
      url: body.url,
      title: 'New Bookmark',
      description: null,
      imageUrl: null,
      faviconUrl: null,
      folderPath: null,
      position: mockBookmarks.length,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json(created, { status: 201 });
  }),

  http.delete('/api/bookmarks/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  // Folders
  http.get('/api/folders', ({ request }) => {
    const url = new URL(request.url);
    const all = url.searchParams.get('all');
    if (all === 'true') {
      return HttpResponse.json(mockFolders);
    }
    const parent = url.searchParams.get('parent');
    if (parent) {
      return HttpResponse.json(mockFolders.filter((f) => f.parentPath === parent));
    }
    return HttpResponse.json(mockFolders.filter((f) => f.parentPath === null));
  }),

  // Search
  http.get('/api/search', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q');
    if (!q) return HttpResponse.json([]);
    return HttpResponse.json(mockSearchResults);
  }),

  // Trash
  http.get('/api/trash', () => {
    return HttpResponse.json(mockTrashData);
  }),

  http.post('/api/trash/:id/restore', () => {
    return HttpResponse.json({ success: true });
  }),

  http.delete('/api/trash/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  http.delete('/api/trash', () => {
    return HttpResponse.json({ success: true });
  }),

  // User
  http.delete('/api/user', () => {
    return HttpResponse.json({ success: true });
  }),

  // Auth session
  http.get('/auth/get-session', () => {
    return HttpResponse.json({
      session: {
        id: 'test-session',
        userId: 'test-user',
        token: 'test-token',
        expiresAt: '2099-01-01T00:00:00.000Z',
      },
      user: {
        id: 'test-user',
        name: 'Test User',
        email: 'test@example.com',
        emailVerified: true,
        image: null,
      },
    });
  }),
];
