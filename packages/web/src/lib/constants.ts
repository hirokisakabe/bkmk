export const UNCATEGORIZED_VIEW = 'uncategorized' as const;
export type BookmarkView = typeof UNCATEGORIZED_VIEW;

// 後方互換の URL 入力を解釈するためだけに使用する。
export const LEGACY_UNCATEGORIZED_FOLDER = '__uncategorized__';
