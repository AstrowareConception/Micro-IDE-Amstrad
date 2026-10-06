import type { ProjectSnapshot } from './project.ts';

export interface RecentProject { id: string; name: string; path: string; lastOpenedAt: string; available: boolean }
export interface RecentProjectsPort {
  list(): Promise<RecentProject[] | { error: string }>;
  open(id: string): Promise<ProjectSnapshot | { error: string } | null>;
  remove(id: string): Promise<RecentProject[] | { error: string }>;
  clear(): Promise<RecentProject[] | { error: string }>;
}
