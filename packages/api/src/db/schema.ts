import { integer, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';

export const folders = pgTable(
  'folders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    name: varchar('name').notNull(),
    path: varchar('path').notNull(),
    parentPath: varchar('parent_path'),
    position: integer('position').notNull().default(0),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('folders_user_id_path_unique').on(table.userId, table.path)],
);

export const bookmarks = pgTable(
  'bookmarks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    folderPath: varchar('folder_path'),
    url: text('url').notNull(),
    title: varchar('title'),
    description: text('description'),
    imageUrl: text('image_url'),
    faviconUrl: text('favicon_url'),
    position: integer('position').notNull().default(0),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [unique('bookmarks_user_id_url_unique').on(table.userId, table.url)],
);
