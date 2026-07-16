import { Link } from "@/lib/i18n-navigation";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-5xl tracking-[0.1em]">404</h1>
      <p className="text-sm text-muted">The page you are looking for could not be found.</p>
      <Link href="/" className="btn-brand">
        Home
      </Link>
    </div>
  );
}
