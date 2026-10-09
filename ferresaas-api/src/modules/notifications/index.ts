// API pública de notifications: encolado durable de emails y envío directo transaccional-externo.
export { EmailJobStore } from './infrastructure/email-job-store';
export { EmailSender } from './infrastructure/email/email-sender';
export { processEmailJobs } from './application/process-email-jobs';
