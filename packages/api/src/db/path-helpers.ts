import { type Column, sql } from 'drizzle-orm';

/** LIKE 演算子で使用する特殊文字をエスケープする */
export function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** 指定パス配下のレコードを絞り込む LIKE 条件を生成する */
export function childPathCondition(column: Column, parentPath: string) {
  const escaped = escapeLike(parentPath);
  return sql`${column} LIKE ${escaped + '/%'} ESCAPE '\\'`;
}

/** 指定パス自身と配下のレコードを絞り込む条件を生成する */
export function selfOrChildPathCondition(column: Column, parentPath: string) {
  const escaped = escapeLike(parentPath);
  return sql`(${column} = ${parentPath} OR ${column} LIKE ${escaped + '/%'} ESCAPE '\\')`;
}

/** パスプレフィックスを書き換える SQL 式を生成する */
export function rebasePath(column: Column, oldPrefix: string, newPrefix: string) {
  return sql`${newPrefix} || substr(${column}, ${oldPrefix.length + 1})`;
}
