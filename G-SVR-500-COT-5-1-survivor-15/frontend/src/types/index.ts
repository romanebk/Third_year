export type Role = 'candidate' | 'employer' | 'admin';

export type UserStatus = 'pending' | 'active' | 'suspended';

export type ContractType = 'CDI' | 'CDD' | 'Intérim' | 'Extra' | 'Alternance' | 'Stage';

export type OfferStatus = 'draft' | 'pending' | 'published' | 'unpublished' | 'reported';

export type ApplicationStatus = 'sent' | 'viewed' | 'interview' | 'accepted' | 'rejected';

export type SalaryKind = 'brut' | 'net';

export type Sector =
  | 'Restauration'
  | 'Logistique'
  | 'Santé'
  | 'Commerce'
  | 'Bâtiment'
  | 'Tech'
  | 'Services';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Experience {
  id: string;
  title: string;
  company: string;
  start: string;
  end?: string;
  description?: string;
}

export interface Education {
  id: string;
  school: string;
  diploma: string;
  year: string;
}

export interface CvFile {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
}

export interface User {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  defaultRadiusKm?: number;
  jobTitle?: string;
  contracts?: ContractType[];
  availableFrom?: string;
  skills?: string[];
  experiences?: Experience[];
  education?: Education[];
  mobility?: string;
  profileVisible?: boolean;
  geoConsent?: boolean;
  alertsConsent?: boolean;
  cv?: CvFile;
  companyName?: string;
  siret?: string;
  sector?: Sector | string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface Offer {
  id: string;
  title: string;
  description: string;
  company: string;
  employerId: string;
  sector: Sector;
  /** @deprecated Afficher SectorIcon, conservé pour compat API mock. */
  emoji?: string;
  contract: ContractType;
  tags: string[];
  salaryMin?: number;
  salaryMax?: number;
  salaryKind?: SalaryKind;
  workTime?: string;
  experienceLevel?: string;
  requiredSkills?: string[];
  address: string;
  lat: number;
  lng: number;
  radiusKm: number;
  isNew: boolean;
  createdAt: string;
  endsAt: string;
  status: OfferStatus;
  views: number;
  approaches: number;
  applicationsCount: number;
}

export interface Application {
  id: string;
  offerId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  offerTitle: string;
  company: string;
  status: ApplicationStatus;
  message?: string;
  cvId?: string;
  createdAt: string;
}

export interface OfferReport {
  id: string;
  offerId: string;
  offerTitle: string;
  reason: string;
  comment?: string;
  reporterId: string;
  createdAt: string;
  status: 'open' | 'resolved';
}

export interface EmployerStats {
  views: number;
  approaches: number;
  applications: number;
  peakHours: { hour: string; count: number }[];
}

export interface AdminMetricsSeriesPoint {
  label: string;
  applications: number;
  offers: number;
}

export interface AdminMetrics {
  activeOffers: number;
  publishedToday: number;
  candidates: number;
  employers: number;
  applicationsToday: number;
  reportsOpen: number;
  /** Activité des 7 derniers jours (candidatures + offres créées). */
  weeklyActivity?: AdminMetricsSeriesPoint[];
}

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  status: number;
  code: string;
  message: string;
  fields?: ApiFieldError[];
}

export type PendingAction =
  | { type: 'apply'; offerId: string }
  | { type: 'view'; offerId: string };

export interface OfferFilters {
  q?: string;
  contract?: ContractType;
  sector?: Sector;
  salaryMin?: number;
  radius?: number;
  onlyNew?: boolean;
  sort?: 'distance' | 'date' | 'salary';
}

export const CONTRACTS: ContractType[] = [
  'CDI',
  'CDD',
  'Intérim',
  'Extra',
  'Alternance',
  'Stage',
];

export const SECTORS: Sector[] = [
  'Restauration',
  'Logistique',
  'Santé',
  'Commerce',
  'Bâtiment',
  'Tech',
  'Services',
];

export const EXPERIENCE_LEVELS = ['Débutant accepté', '1-3 ans', '3-5 ans', '5 ans et plus'];
