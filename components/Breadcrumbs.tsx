import Link from 'next/link';
import { useRouter } from 'next/router';
import { resolveTrail } from '../config/navigation';

// Route-driven breadcrumb trail (Home / Section / Page). Renders nothing on
// routes that aren't in the nav, such as the home page itself.
export default function Breadcrumbs() {
  const { pathname } = useRouter();
  const trail = resolveTrail(pathname);

  if (!trail) {
    return null;
  }

  return (
    <nav aria-label="breadcrumb" className="container pt-3">
      <ol className="breadcrumb mb-0">
        <li className="breadcrumb-item">
          <Link href="/">Home</Link>
        </li>
        <li className="breadcrumb-item">{trail.section}</li>
        <li className="breadcrumb-item active" aria-current="page">
          {trail.label}
        </li>
      </ol>
    </nav>
  );
}
