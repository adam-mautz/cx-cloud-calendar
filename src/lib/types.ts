export interface Account {
  id: string;
  label: string;
  username: string;
  password: string;
  loginUrl: string;
}

export interface DataConfig {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  token: string;
}

export interface Vault {
  people: string[];
  accounts: Account[];
  data: DataConfig;
}

export const PURPOSES = ['Demo', 'Testing', 'Build', 'Training', 'Other'] as const;
export type Purpose = (typeof PURPOSES)[number];

export interface Booking {
  id: string;
  accountId: string;
  person: string;
  purpose: Purpose;
  note?: string;
  /** ISO 8601 in UTC. Shown in each viewer's own time zone. */
  start: string;
  end: string;
  createdAt: string;
}

export interface Slot {
  accountId: string;
  start: Date;
  end: Date;
}
