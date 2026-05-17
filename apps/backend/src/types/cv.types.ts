export interface CVProfile {
  name: string;
  currentRole: string;
  yearsExperience: number;
  skills: string[];
  companies: Array<{
    name: string;
    role: string;
    duration: string;
    achievements: string[];
  }>;
  projects: Array<{
    name: string;
    description: string;
    stack: string[];
    impact: string;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    year: string;
  }>;
  certifications: string[];
  summary?: string;
}
