# DnD interaction policy

このドキュメントは、bookmark / folder の drag and drop (DnD) で扱う操作範囲と、
drag 中の feedback 方針を明文化する。DnD の実装やテストを変更する場合は、あわせてこの
ドキュメントを更新する。

## 目的

- DnD 対象にする操作と、意図的に対象外にする操作を分ける。
- 同じ見た目の drag でも「並び替え」と「folder 移動」を混同しない。
- `すべて` 表示や deep 表示で、global order を編集しているように見える挙動を避ける。
- テストで守るべき仕様を、実装の詳細から独立して確認できるようにする。

## 操作一覧

| 操作                                                              | 現時点の DnD 対象 | drag 中 feedback                                                                                                                                                                                                                         | drop 後の意味                                                                     |
| ----------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| bookmark の同一フォルダ内ソート                                   | 対象              | bookmark card 本体は不可視 (`opacity-0`) にし、`DragOverlay` で position: fixed の最前面にサムネイルを表示する。同一 `SortableContext` 内で周囲の card を押し出して drop 後の順序を preview する                                         | 同じ `folderPath` 内の `position` を更新する                                      |
| bookmark の folder 移動                                           | 対象              | bookmark card 本体は不可視 (`opacity-0`) にし、`DragOverlay` で position: fixed の最前面にサムネイルを表示する。folder tree 側の drop target を ring / background で highlight する。bookmark list 側では reorder preview として扱わない | bookmark の `folderPath` を drop 先 folder に変更し、移動先 folder の先頭へ入れる |
| folder の同一階層内ソート                                         | 対象              | folder row を半透明にし、同じ `parentPath` の `SortableContext` 内で周囲の row を押し出して drop 後の順序を preview する                                                                                                                 | 同じ `parentPath` 内の `position` を更新する                                      |
| folder の階層移動                                                 | 対象外            | DnD feedback は出さない。階層移動は context menu の「移動」ダイアログで扱う                                                                                                                                                              | DnD では変更しない                                                                |
| `すべて` 表示での bookmark ソート                                 | 対象外            | ソート用 drag handle は表示しない。bookmark の folder 移動 DnD を許可する場合も、feedback は folder tree の drop target highlight に寄せる                                                                                               | flat list の global order は変更しない                                            |
| deep 表示かつサブフォルダあり folder での bookmark ソート         | 対象外            | ソート用 drag handle は表示しない。bookmark の folder 移動 DnD を許可する場合も、feedback は folder tree の drop target highlight に寄せる                                                                                               | 複数 folder をまたぐ flat list の順序は変更しない                                 |
| deep 表示かつ末端フォルダ（サブフォルダなし）での bookmark ソート | 対象              | bookmark card 本体は不可視 (`opacity-0`) にし、`DragOverlay` で position: fixed の最前面にサムネイルを表示する。同一 `SortableContext` 内で周囲の card を押し出して drop 後の順序を preview する                                         | 同じ `folderPath` 内の `position` を更新する                                      |

## bookmark ソート

bookmark のソートは、以下の条件をすべて満たす場合に DnD 対象にする。

- `すべて` 表示でない（`isAllBookmarks = false`）
- deep 表示でない、**または** deep 表示でもサブフォルダを持たない末端フォルダである

この条件は `resolveCanReorderBookmarks({ isAllBookmarks, deep, hasSubfolders })` に対応し、
`!isAllBookmarks && !(deep && hasSubfolders)` で評価する。

同一フォルダ内ソートでは、active bookmark と over bookmark の `folderPath` が同じ場合だけ
`position` 更新を実行する。異なる `folderPath` の bookmark 同士を over しても、ソートとしては
no-op にする。

drag 中は `@dnd-kit/sortable` の sortable feedback を使い、active な card 本体は不可視
（`opacity-0`）にして元の grid 枠だけ残す。代わりに `@dnd-kit/core` の `DragOverlay` で
viewport 基準の `position: fixed` + 高い z-index で最前面にサムネイルを描画し、サイドバー等の
stacking context に隠れないようにする。周囲の bookmark card は drop 後の順序を preview するように
移動する。

衝突判定は pointer 位置ではなく、移動後の bookmark card 矩形 (`collisionRect`) の中心と各 card の
中心との距離を使う。drag handle を card のどこから掴んでも同じ card 位置なら同じ挿入先になり、
pointer が card の端を通過しただけでは preview を切り替えない。

## bookmark の folder 移動

bookmark の folder 移動は DnD 対象にする。drop target は folder tree の通常 folder と
`未分類` であり、drop 先が現在の `folderPath` と同じ場合は no-op にする。

drag 中は bookmark list 側で reorder preview を出さず、folder tree 側の hover / over feedback で
「ここに入る」ことを示す。現在の実装では drop target に ring と background を付ける。
drag 元の card 本体は不可視（`opacity-0`）にし、サムネイルは `DragOverlay` で
viewport 基準の `position: fixed` + 高い z-index で最前面に描画する。これによりカーソルが
folder tree（左 sidebar）上に移動しても、サムネイルが stacking context に隠れず常に
追従して見える。

folder drop target は、pointer、`collisionRect` の中心、card と row の重なりの順で判定する。pointer
が表示中の row 内ならユーザーの明示的な位置指定としてその row を最優先する。pointer が外でも card
中心が row 内ならその row を選び、中心も外で card だけが重なる場合は重なり面積が最大の row を選ぶ。
面積が同じなら card 中心に近い row、さらに同率なら droppable の登録順で固定する。これにより card が
複数行を覆っても pointer の意図を優先しつつ、handle を row へ厳密に重ねない操作も補助できる。card と
pointer のどちらも row に入っていない場合は folder 移動として扱わない。この基準は通常 folder と
`未分類`、desktop sidebar と mobile の overlay sidebar で共通とする。bookmark 同士と folder 同士の
ソート判定にはこの条件を広げない。
mobile sidebar を閉じている間も folder row は DOM に残るため、sidebar が `pointer-events: none` の
状態では row を folder drop 候補から除外し、背面の bookmark ソートを妨げない。

folder の同一階層ソート用 droppable は、展開した子孫を含む tree node wrapper に登録する。一方、
bookmark の folder drop 用 droppable は各 folder row だけに別 ID で登録する。bookmark の衝突判定では
row-only target のみを候補にし、展開中の親 wrapper と child row の矩形が重なることを避ける。folder
の衝突判定では逆に sortable wrapper のみを候補にし、同一階層ソートの preview と drop を維持する。

`canReorder = false` の表示でも、bookmark の folder 移動 DnD を許可してよい。ただし、この状態で
ソート用の grip handle を表示すると並び替え可能に見えるため、ソート用 drag handle は表示しない。
folder 移動 DnD の affordance が必要な場合は、card 全体を draggable にする、またはソート用とは別の
移動用 handle を用意する。

## folder ソート

folder のソートは、同じ `parentPath` を持つ folder 同士だけ DnD 対象にする。
folder tree は階層ごとに `SortableContext` を分け、drop 後は同一階層内の `position` だけを更新する。

drag 中は folder row を半透明にし、同じ `parentPath` の row だけが drop 後の順序を preview する。
別階層の folder に over した場合は、階層移動としては扱わず no-op にする。

## folder の階層移動

folder の階層移動は、現時点では DnD 対象外にする。

理由は、folder の `path` / `parentPath` だけでなく、子 folder の `path` / `parentPath` と bookmark の
`folderPath` 更新が絡むためである。誤った drop で広い範囲の path を変更すると、復旧しづらい状態に
なりやすい。階層移動は明示的な確認を挟める context menu の「移動」ダイアログで扱う。

将来 DnD で folder 階層移動を許可する場合は、このドキュメントに以下を追加してから実装する。

- folder row を drop target として扱う条件
- 自分自身、子孫、自分と同じ path への drop 禁止条件
- 子 folder と bookmark の path 更新範囲
- drag 中に「同階層ソート」と「階層移動」を区別する feedback
- API / hook / E2E のテスト方針

## `すべて` / deep 表示での bookmark ソート

flat な `すべて` 表示では、異なる `folderPath` の bookmark 同士を自由にソートしない。
この表示で自由ソートを許可すると、global order を編集しているのか、folder 内 order を編集しているのかが
曖昧になるためである。

deep 表示でサブフォルダが存在する場合も同様で、flat list の bookmark ソートは許可しない。deep 表示は
複数 folder の bookmark を同じ list に混ぜて表示するため、異なる folder グループ間の drag を
folder 内 `position` 更新として表現できない。

ただし、deep 表示でもサブフォルダを持たない末端フォルダの場合は、API が返す bookmark がすべて
同じ `folderPath` に属するため、同一フォルダ内ソートとして扱うことができる。この場合は
ソート用 drag handle を表示し、DnD ソートを許可する。

将来 `すべて` / deep 表示で bookmark ソートを許可する場合は、global order ではなく folder グループ内
order として扱う。つまり表示を folder ごとの group に寄せ、同一 group 内の DnD だけを各 folder の
`position` 更新として処理する。group をまたいだ drag は、ソートではなく bookmark の folder 移動として扱うか、
明示的に禁止する。

## drag handle / move handle

ソート可能な表示では、bookmark / folder ともに grip handle を表示し、handle から DnD を開始する。
handle の `aria-label` と `data-testid` は、ユーザーの affordance と E2E locator の両方に使う。

`canReorder = false` の bookmark 表示では、ソート用 grip handle を表示しない。bookmark の folder 移動を
DnD で許可する場合も、ソート用 handle を流用しない。必要なら以下のどちらかに分ける。

- card 全体を folder 移動用の draggable surface にする。
- ソート用 grip handle とは別に、folder 移動用 handle を用意する。

folder tree の folder row は、現時点では folder ソート handle と bookmark drop target を同じ row 内に持つ。
bookmark を drag している間は folder row / `未分類` row の hover feedback を優先し、folder ソート中は
同一階層内の sortable preview を優先する。

folder 名の省略表示に付随する tooltip は、bookmark / folder のどちらかが active な DnD 中は表示しない。
drag 開始前に開いていた tooltip も閉じ、folder row の drop target highlight と sortable preview を
遮らないようにする。

## 意図的に対象外にする操作

- `すべて` 表示の flat list で、異なる `folderPath` の bookmark 同士を自由にソートすること。
- deep 表示かつサブフォルダあり folder の flat list で、異なる `folderPath` の bookmark 同士を自由にソートすること。
- DnD による folder の階層移動。
- bookmark を bookmark 上へ drop したときに、異なる `folderPath` への移動として扱うこと。
- folder を bookmark 上へ drop して folder 階層や bookmark 所属を変更すること。

## DnD テスト方針との対応

DnD のテストは、以下の層でこの policy を守る。

- `packages/web/src/lib/dnd-reorder.test.ts`: 純粋ロジックを検証する。bookmark は同じ `folderPath`
  だけが変化すること、folder は同じ `parentPath` だけが変化すること、順方向 / 逆方向 / no-op を確認する。
- `packages/web/src/hooks/dnd-mutations.test.tsx`: React Query cache の楽観的更新、rollback、query
  invalidation を検証する。bookmark move は移動元 / 移動先 / `すべて` query の整合性を確認する。
- API route tests: `position` 更新が別ユーザー、別 folder / parentPath、削除済みデータを巻き込まないことを確認する。
- `packages/web/e2e/dnd.spec.ts`: 実ブラウザで代表操作を確認する。DnD 後は API request だけでなく、
  DOM 上の表示順や移動後の表示状態も確認する。
- `packages/web/src/lib/dnd-collision.test.ts`: pointer、bookmark card 中心、card との重なりの優先順位で
  単一の folder target を選ぶこと、card が folder と重ならなければ bookmark card 同士の中心距離で
  判定すること、bookmark / folder のソート判定には folder drop 条件を広げないことを確認する。

DnD の操作範囲、feedback、handle 表示、テスト対象を変更する場合は、実装・テストと一緒にこの
`docs/dnd.md` を更新する。
