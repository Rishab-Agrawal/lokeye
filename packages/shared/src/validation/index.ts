import { z } from 'zod';
import { TASK_TYPES } from '../constants';

export const TaskTypeSchema = z.enum(TASK_TYPES);
export const TaskStatusSchema = z.enum(['pending', 'assigned', 'in_progress', 'submitted', 'completed', 'expired', 'cancelled']);

export const CreateTaskSchema = z.object({
  type: TaskTypeSchema,
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(2000),
  instructions: z.string().max(5000).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  bounty_rupees: z.number().int().min(10).max(1000), // ₹10 to ₹1,000
  deadline: z.string().datetime(),
});

export const UpdateHumanProfileSchema = z.object({
  display_name: z.string().min(2).max(100).optional(),
  upi_vpa: z.string().regex(/^[\w.-]+@[\w]+$/, 'Invalid UPI VPA format').optional(),
}).refine(data => data.display_name || data.upi_vpa, {
  message: 'At least one field must be provided',
});

export const UpdateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const UpdatePushTokenSchema = z.object({
  expo_push_token: z.string().startsWith('ExponentPushToken['),
});

export const SubmitTaskSchema = z.object({
  text_response: z.string().max(10000).optional(),
  media_urls: z.array(z.string().url()).max(10).optional(),
  capture_latitude: z.number().min(-90).max(90).optional(),
  capture_longitude: z.number().min(-180).max(180).optional(),
  capture_metadata: z.record(z.unknown()).optional(),
}).refine(data => data.text_response || (data.media_urls && data.media_urls.length > 0), {
  message: 'Either text_response or media_urls must be provided',
});

export const RejectTaskSchema = z.object({
  reason: z.string().min(5).max(500),
});

export const ListTasksQuerySchema = z.object({
  status: TaskStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const NearbyTasksQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
