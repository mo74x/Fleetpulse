export interface DeadLetterJobPayload {
  originalQueue: string;
  originalJobId?: string;
  jobName: string;
  payload: Record<string, any>;
  failedReason: string;
  stackTrace?: string;
  failedAt: string | Date;
  attemptsMade: number;
}
