import Link from "next/link";

interface Props {
  title: string;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
}

export function PageHeader({ title, subtitle, back }: Props) {
  return (
    <div>
      {back && (
        <Link href={back.href} className="text-xs text-muted hover:underline">← {back.label}</Link>
      )}
      <h1 className="text-2xl font-semibold">{title}</h1>
      {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
    </div>
  );
}
