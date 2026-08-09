// stand-in for the Confluence content API until we wire up the real REST calls.
// each page lists the accountIds allowed to view it so the resolver can filter
// the same way Confluence permission checks will later.

export const mockPages = [
  {
    id: '1001',
    title: 'Team Handbook',
    space: 'TEAM',
    body: 'Standup happens every weekday at 9:30am in the main channel.',
    accessibleTo: ['user-alice', 'user-bob', 'user-carol'],
  },
  {
    id: '1002',
    title: 'Onboarding Guide',
    space: 'TEAM',
    body: 'New starters should request access to the shared drive on day one.',
    accessibleTo: ['user-alice', 'user-bob', 'user-carol'],
  },
  {
    id: '1003',
    title: 'Q3 Financials',
    space: 'FINANCE',
    body: 'Revenue grew 12% quarter on quarter.',
    accessibleTo: ['user-alice'],
  },
  {
    id: '1004',
    title: 'Security Incident Postmortem',
    space: 'SECURITY',
    body: 'Root cause was a leaked API token committed to a public repo.',
    accessibleTo: ['user-carol'],
  },
];
