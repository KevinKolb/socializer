import Link from "next/link";

interface Props {
  title: string;
  subtitle?: React.ReactNode;
  /** Renders a gear icon linking to this page's settings. */
  settingsHref?: string;
  back?: { href: string; label: string };
}

export function PageHeader({ title, subtitle, settingsHref, back }: Props) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        {back && (
          <Link href={back.href} className="text-xs text-muted hover:underline">← {back.label}</Link>
        )}
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {settingsHref && (
        <Link
          href={settingsHref}
          aria-label={`${title} settings`}
          title="Settings"
          className="btn-secondary h-10 w-10 !p-0 text-lg"
        >
          ⚙
        </Link>
      )}
    </div>
  );
}
