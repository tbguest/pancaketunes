/**
 * A file in /data that fails validation is skipped rather than crashing the
 * app, but it is never hidden — a hand-edit that broke the JSON should be
 * obvious the next time someone opens the site.
 */
export function DataProblems({ problems }: { problems: string[] }) {
  if (problems.length === 0) return null;

  return (
    <div className="notice" role="alert" style={{ marginBottom: "1rem" }}>
      <strong>Some files could not be read</strong>
      <ul style={{ margin: "0.375rem 0 0", paddingLeft: "1.25rem" }}>
        {problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
    </div>
  );
}
