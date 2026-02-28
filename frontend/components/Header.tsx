import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-slate-900" aria-label="RouteIQ Home">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-white">
            R
          </span>
          <span className="text-lg font-semibold tracking-tight">RouteIQ</span>
        </Link>

        <nav className="flex items-center gap-3 text-sm font-medium text-slate-600" aria-label="Primary">
          <Link href="/simulate" className="rounded-md px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900">
            Simulate
          </Link>
          <a
            href="https://github.com/NickJuneau/gridstorm-smartroute"
            target="_blank"
            rel="noreferrer"
            className="rounded-md px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
