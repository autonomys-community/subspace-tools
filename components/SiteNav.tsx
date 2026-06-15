import Link from 'next/link';
import { useRouter } from 'next/router';
import { Nav, NavDropdown } from 'react-bootstrap';
import { NAV_SECTIONS } from '../config/navigation';

// Header navigation derived from NAV_SECTIONS. A section with multiple tools
// renders as a dropdown; a single-tool section renders as a direct link.
export default function SiteNav() {
  const { pathname } = useRouter();

  return (
    <Nav className="me-auto">
      {NAV_SECTIONS.map((section) => {
        if (section.items.length === 1) {
          const item = section.items[0];
          return (
            <Nav.Link
              key={item.href}
              as={Link}
              href={item.href}
              active={pathname === item.href}
            >
              {item.label}
            </Nav.Link>
          );
        }

        const sectionActive = section.items.some((item) => item.href === pathname);
        return (
          <NavDropdown key={section.label} title={section.label} active={sectionActive}>
            {section.items.map((item) => (
              <NavDropdown.Item
                key={item.href}
                as={Link}
                href={item.href}
                active={pathname === item.href}
              >
                {item.label}
              </NavDropdown.Item>
            ))}
          </NavDropdown>
        );
      })}
    </Nav>
  );
}
