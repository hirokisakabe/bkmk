export interface Folder {
  id: string;
  userId: string;
  name: string;
  path: string;
  parentPath: string | null;
  position: number;
  deletedAt: string | null;
  createdAt: string;
}

export interface Bookmark {
  id: string;
  userId: string;
  folderPath: string | null;
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
  position: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult extends Bookmark {
  folder: {
    id: string;
    name: string;
    path: string;
    parentPath: string | null;
  } | null;
}
