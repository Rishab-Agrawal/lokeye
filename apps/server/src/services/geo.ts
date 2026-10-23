import { FastifyInstance } from 'fastify';
import { Task, LOCATION_STALENESS_MINUTES, MAX_HUMANS_TO_NOTIFY, TASK_RADIUS_METERS } from '@lokeye/shared';

interface NearbyHuman {
  id: string;
  expo_push_token: string | null;
  distance_meters: number;
}

export class GeoService {
  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  // Find humans near a task's location
  async findNearbyHumans(taskId: string): Promise<NearbyHuman[]> {
    const { rows } = await this.fastify.db.query(
      `SELECT h.id, h.expo_push_token,
              ST_Distance(h.last_location, t.location) AS distance_meters
       FROM humans h, tasks t
       WHERE t.id = $1
         AND h.is_active = true
         AND h.current_task_id IS NULL
         AND h.last_location IS NOT NULL
         AND h.last_location_at > NOW() - INTERVAL '${LOCATION_STALENESS_MINUTES} minutes'
         AND ST_DWithin(h.last_location, t.location, t.radius_meters)
       ORDER BY distance_meters ASC
       LIMIT $2`,
      [taskId, MAX_HUMANS_TO_NOTIFY]
    );

    return rows;
  }

  // Count available humans near a location
  async countNearbyHumans(latitude: number, longitude: number): Promise<{ count: number }> {
    const { rows } = await this.fastify.db.query(
      `SELECT COUNT(*) AS count
       FROM humans h
       WHERE h.is_active = true
         AND h.last_location IS NOT NULL
         AND h.last_location_at > NOW() - INTERVAL '${LOCATION_STALENESS_MINUTES} minutes'
         AND ST_DWithin(
           h.last_location,
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           $3
         )`,
      [longitude, latitude, TASK_RADIUS_METERS]
    );

    return { count: parseInt(rows[0].count) };
  }

  // Get all active human locations (anonymized - coordinates only, capped at 500)
  async getHumanLocations(): Promise<{ latitude: number; longitude: number }[]> {
    const { rows } = await this.fastify.db.query(
      `SELECT ST_Y(h.last_location::geometry) AS latitude,
              ST_X(h.last_location::geometry) AS longitude
       FROM humans h
       WHERE h.is_active = true
         AND h.last_location IS NOT NULL
         AND h.last_location_at > NOW() - INTERVAL '${LOCATION_STALENESS_MINUTES} minutes'
       LIMIT 500`
    );

    return rows;
  }

  // Find pending tasks near a location
  async findNearbyTasks(
    latitude: number,
    longitude: number,
    limit: number,
    offset: number
  ): Promise<Task[]> {
    const { rows } = await this.fastify.db.query(
      `SELECT t.*,
              ST_Distance(
                t.location,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
              ) AS distance_meters
       FROM tasks t
       WHERE t.status = 'pending'
         AND t.deadline > NOW()
         AND ST_DWithin(
           t.location,
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           $3
         )
       ORDER BY distance_meters ASC
       LIMIT $4 OFFSET $5`,
      [longitude, latitude, TASK_RADIUS_METERS, limit, offset]
    );

    return rows;
  }
}

