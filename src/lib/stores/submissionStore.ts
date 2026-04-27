import { submissionDB } from '$lib/db/submissions';
import type { Submission, SubmissionStatus } from '$lib/types';
import { createPersistedArrayStore } from './persistedArrayStore';

export const submissionStore = createPersistedArrayStore<Submission>(submissionDB, {
  sort: (a, b) => {
    const aDate = a.submittedAt ?? a.updatedAt;
    const bDate = b.submittedAt ?? b.updatedAt;
    return bDate - aDate;
  }
});

export async function getSubmissionsByTarget(targetId: string): Promise<Submission[]> {
  await submissionStore.load();
  return submissionDB.getByTarget(targetId);
}

export async function getSubmissionsByStatus(status: SubmissionStatus): Promise<Submission[]> {
  await submissionStore.load();
  return submissionDB.getByStatus(status);
}
