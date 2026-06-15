// Single source of truth for site navigation: drives both the header menu
// and the breadcrumb trail. Add a tool here and it shows up in both.

export interface NavLeaf {
  href: string;
  label: string;
  // Short description shown on the landing-page tool cards.
  description: string;
}

export interface NavSection {
  label: string;
  items: NavLeaf[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'XDM',
    items: [
      {
        href: '/xdm/send',
        label: 'Send Transfer',
        description: 'Move AI3 between the Consensus chain and Auto EVM via XDM.',
      },
      {
        href: '/xdm/transfers',
        label: 'Transfer Status',
        description: 'Track the progress of XDM transfers for an address.',
      },
      {
        href: '/xdm/channels',
        label: 'Channel Status',
        description: 'Inspect the state of XDM channels between domains.',
      },
    ],
  },
  {
    label: 'WAI3',
    items: [
      {
        href: '/wrap',
        label: 'Wrap & Unwrap',
        description: 'Convert between native AI3 and wrapped WAI3 on Auto EVM.',
      },
    ],
  },
];

export interface BreadcrumbTrail {
  section: string;
  label: string;
}

// Resolve a route to its section + page label for breadcrumbs. Returns null
// for routes not in the nav (e.g. the home page), which render no trail.
export function resolveTrail(pathname: string): BreadcrumbTrail | null {
  for (const section of NAV_SECTIONS) {
    const leaf = section.items.find((item) => item.href === pathname);
    if (leaf) {
      return { section: section.label, label: leaf.label };
    }
  }
  return null;
}
