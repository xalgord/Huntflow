import { BaseDB } from './baseStore';
import type { Submission, SubmissionStatus } from './schema';

class SubmissionDB extends BaseDB<Submission> {
  constructor() {
    super('submissions', 'submissions');
  }

  getByTarget(targetId: string): Promise<Submission[]> {
    return this.getByIndex('by-target', targetId);
  }

  getByStatus(status: SubmissionStatus): Promise<Submission[]> {
    return this.getByIndex('by-status', status);
  }
}

export const submissionDB = new SubmissionDB();
