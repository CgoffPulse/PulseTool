'use server';

import { revalidatePath } from 'next/cache';
import { pollAllProjects } from './monitors/github';
import { pollAllDeploys } from './monitors/deploy';

export async function refreshAllMonitors() {
  const [gh, vc] = await Promise.allSettled([
    pollAllProjects(),
    pollAllDeploys(),
  ]);

  revalidatePath('/');
  revalidatePath('/projects');

  return {
    github:
      gh.status === 'fulfilled'
        ? gh.value
        : { error: (gh.reason as Error).message },
    vercel:
      vc.status === 'fulfilled'
        ? vc.value
        : { error: (vc.reason as Error).message },
  };
}
