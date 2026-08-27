'use server';

import { requireCoach } from '@/lib/auth';
import { getRepo } from '@/lib/data';

/** The templates a coach can pick from in the batch bar. Names and shape only. */
export async function listAssignableTemplates(): Promise<
  { id: string; name: string; weeks: number; goalType: string; description: string }[]
> {
  await requireCoach();
  const repo = await getRepo();
  const templates = await repo.listProgramTemplates({ includeArchived: false });

  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    weeks: t.weeks,
    goalType: t.goalType,
    description: t.description,
  }));
}
