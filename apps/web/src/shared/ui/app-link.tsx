import { Link } from '@tanstack/react-router';
import type { ComponentProps, ReactNode } from 'react';

type LinkProps = ComponentProps<typeof Link>;
type AppLinkProps = Omit<LinkProps, 'to'> & { to: string; children?: ReactNode };

/**
 * Thin wrapper around TanStack Router's `Link` for cases where the destination is a runtime
 * string (e.g. generated from the navigation config) rather than a statically-known route.
 * Isolates the single unavoidable cast so call sites stay clean and type-safe elsewhere.
 */
export function AppLink({ to, children, ...props }: AppLinkProps) {
  return (
    <Link to={to as never} {...props}>
      {children}
    </Link>
  );
}
