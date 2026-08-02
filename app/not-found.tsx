import Link from "next/link";

export default function NotFound() {
  return (
    <div className="stack">
      <h2>Not found</h2>
      <p className="meta">That tune or set isn&rsquo;t here. It may have been renamed or deleted.</p>
      <Link href="/" className="btn btn-secondary btn-block">
        Back to all tunes
      </Link>
    </div>
  );
}
