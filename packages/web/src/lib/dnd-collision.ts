import { closestCenter, type CollisionDetection, pointerWithin } from '@dnd-kit/core';

// カード右端から何 px 以内へのドロップを「このアイテムの後ろ」と解釈するか。
// ドラッグハンドルはカード右上隅にあるため、ハンドル中心(desktop:right-16px / mobile:right-22px)
// より右側にドロップした場合は「後ろに置く」意図として扱う。15px はその中間値。
const RIGHT_EDGE_THRESHOLD_PX = 15;

export const collisionDetection: CollisionDetection = (args) => {
  const activeType = args.active.data.current?.type;

  if (activeType === 'bookmark') {
    const bookmarkOnly = args.droppableContainers.filter(
      (c) => c.data.current?.type === 'bookmark',
    );
    const nonBookmarkContainers = args.droppableContainers.filter(
      (c) => c.data.current?.type !== 'bookmark',
    );

    // ポインタがブックマークカード上にある場合を先に確認する。
    // モバイルではサイドバーがオーバーレイするため、フォルダより先にブックマークを優先する。
    if (bookmarkOnly.length > 0) {
      const pointerHits = pointerWithin({ ...args, droppableContainers: bookmarkOnly });
      if (pointerHits.length > 0) {
        const hitId = pointerHits[0].id;
        const rect = args.droppableRects?.get(hitId);
        const px = args.pointerCoordinates?.x;

        // ポインタがカード右端付近 → 「このアイテムの後ろ」の意図 → 次のアイテムを返す
        if (rect != null && px != null && px > rect.right - RIGHT_EDGE_THRESHOLD_PX) {
          const sorted = bookmarkOnly
            .filter((c) => args.droppableRects?.get(c.id) != null)
            .sort((a, b) => {
              const aR = args.droppableRects.get(a.id)!;
              const bR = args.droppableRects.get(b.id)!;
              if (Math.abs(aR.top - bR.top) > aR.height / 2) return aR.top - bR.top;
              return aR.left - bR.left;
            });
          const idx = sorted.findIndex((c) => c.id === hitId);
          const next = sorted[idx + 1];
          if (next) return [{ id: next.id }];
        }
        return pointerHits;
      }
    }

    // ブックマーク上になければフォルダドロップターゲットを確認（フォルダ移動）
    if (nonBookmarkContainers.length > 0) {
      const folderCollisions = pointerWithin({
        ...args,
        droppableContainers: nonBookmarkContainers,
      });
      if (folderCollisions.length > 0) return folderCollisions;
    }

    // どこにも乗っていない場合は最近傍のブックマークへ
    if (bookmarkOnly.length > 0) {
      return closestCenter({ ...args, droppableContainers: bookmarkOnly });
    }
    return [];
  }

  return closestCenter(args);
};
