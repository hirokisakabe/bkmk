import { Link } from '@tanstack/react-router';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2';

export function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-white text-gray-950">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link to="/" search={{}} className={`text-lg font-bold tracking-tight ${focusRing}`}>
            bkmk
          </Link>
          <nav aria-label="アカウント" className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/login"
              search={{}}
              className={`rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 ${focusRing}`}
            >
              ログイン
            </Link>
            <Link
              to="/login"
              search={{ mode: 'signup' }}
              className={`rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${focusRing}`}
            >
              アカウント作成
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-7xl gap-14 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[minmax(0,0.85fr)_minmax(34rem,1.15fr)] lg:items-center lg:gap-12 lg:px-8 lg:py-28">
          <div>
            <h1 className="max-w-2xl text-[clamp(1.75rem,8.5vw,3rem)] leading-[1.12] font-black tracking-[-0.04em] text-balance sm:text-5xl">
              <span className="whitespace-nowrap">気になったページを、</span>
              <br />
              すぐ保存。
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-gray-600 sm:text-lg">
              URLを放り込むだけで、ページの内容がひと目でわかるブックマークに。フォルダと検索で、必要なときに迷わず見つけられます。
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/login"
                search={{ mode: 'signup' }}
                className={`inline-flex min-h-12 items-center justify-center rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700 ${focusRing}`}
              >
                無料でアカウント作成
              </Link>
              <Link
                to="/login"
                search={{}}
                className={`inline-flex min-h-12 items-center justify-center rounded-lg border border-gray-300 px-6 text-sm font-semibold text-gray-800 hover:bg-gray-50 ${focusRing}`}
              >
                ログイン
              </Link>
            </div>
          </div>

          <div className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-[0_18px_50px_-28px_rgba(17,24,39,0.35)]">
              <img
                src="/app-screenshot.png"
                alt="フォルダ、検索、ブックマークカードが表示された bkmk の実際の管理画面"
                width={1280}
                height={720}
                className="block h-72 w-full object-cover object-left sm:h-auto"
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
