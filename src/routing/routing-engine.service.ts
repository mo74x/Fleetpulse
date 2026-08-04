/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LocationCoordinates {
  lat: number;
  lng: number;
}

export interface RouteWaypoint {
  id: string;
  location: LocationCoordinates;
  address?: string;
  details?: Record<string, any>;
}

export interface RouteLeg {
  fromId: string;
  toId: string;
  distanceKm: number;
  durationMinutes: number;
  estimatedArrival: Date;
}

export interface OptimizedRouteResult {
  origin: LocationCoordinates;
  orderedWaypoints: RouteWaypoint[];
  legs: RouteLeg[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
}

@Injectable()
export class RoutingEngineService {
  private readonly logger = new Logger(RoutingEngineService.name);
  private readonly googleMapsApiKey?: string;
  private readonly osrmApiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.googleMapsApiKey = this.configService.get<string>(
      'GOOGLE_MAPS_API_KEY',
    );
    this.osrmApiUrl =
      this.configService.get<string>('OSRM_API_URL') ||
      'http://router.project-osrm.org';
  }

  /**
   * Calculate distance (km) and duration (minutes) between two points
   */
  async calculateDistanceAndDuration(
    origin: LocationCoordinates,
    destination: LocationCoordinates,
  ): Promise<{ distanceKm: number; durationMinutes: number }> {
    // 1. Try Google Maps API if configured
    if (this.googleMapsApiKey) {
      try {
        const googleResult = await this.queryGoogleMapsDirections(
          origin,
          destination,
        );
        if (googleResult) return googleResult;
      } catch (err: any) {
        this.logger.warn(
          `Google Maps API error: ${err?.message}. Falling back to OSRM.`,
        );
      }
    }

    // 2. Try OSRM API
    try {
      const osrmResult = await this.queryOsrmRoute(origin, destination);
      if (osrmResult) return osrmResult;
    } catch (err: any) {
      this.logger.warn(
        `OSRM API error: ${err?.message}. Falling back to Haversine calculation.`,
      );
    }

    // 3. Fallback to Haversine calculation with average urban traffic speed (30 km/h)
    return this.calculateHaversineRoute(origin, destination);
  }

  /**
   * Solve Travelling Salesperson Problem (TSP) using Nearest Neighbor heuristic
   */
  async optimizeMultiStopRoute(
    origin: LocationCoordinates,
    waypoints: RouteWaypoint[],
    startTime: Date = new Date(),
  ): Promise<OptimizedRouteResult> {
    if (!waypoints || waypoints.length === 0) {
      return {
        origin,
        orderedWaypoints: [],
        legs: [],
        totalDistanceKm: 0,
        totalDurationMinutes: 0,
      };
    }

    const unvisited = [...waypoints];
    const orderedWaypoints: RouteWaypoint[] = [];
    const legs: RouteLeg[] = [];

    let currentPoint = origin;
    let currentId = 'ORIGIN';
    let currentTime = new Date(startTime);
    let totalDistanceKm = 0;
    let totalDurationMinutes = 0;

    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let minDistance = Infinity;
      let minDuration = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const candidate = unvisited[i];
        const distAndDur = await this.calculateDistanceAndDuration(
          currentPoint,
          candidate.location,
        );

        if (distAndDur.distanceKm < minDistance) {
          minDistance = distAndDur.distanceKm;
          minDuration = distAndDur.durationMinutes;
          nearestIndex = i;
        }
      }

      const nextWaypoint = unvisited.splice(nearestIndex, 1)[0];
      orderedWaypoints.push(nextWaypoint);

      totalDistanceKm += minDistance;
      totalDurationMinutes += minDuration;

      currentTime = new Date(currentTime.getTime() + minDuration * 60 * 1000);

      legs.push({
        fromId: currentId,
        toId: nextWaypoint.id,
        distanceKm: Math.round(minDistance * 100) / 100,
        durationMinutes: Math.round(minDuration * 10) / 10,
        estimatedArrival: new Date(currentTime),
      });

      currentPoint = nextWaypoint.location;
      currentId = nextWaypoint.id;
    }

    return {
      origin,
      orderedWaypoints,
      legs,
      totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
      totalDurationMinutes: Math.round(totalDurationMinutes * 10) / 10,
    };
  }

  /**
   * Haversine Distance calculation with urban traffic speed fallback (30 km/h)
   */
  public calculateHaversineRoute(
    origin: LocationCoordinates,
    destination: LocationCoordinates,
    avgSpeedKmH = 30,
  ): { distanceKm: number; durationMinutes: number } {
    const R = 6371; // Earth radius in km
    const dLat = this.toRadians(destination.lat - origin.lat);
    const dLon = this.toRadians(destination.lng - origin.lng);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(origin.lat)) *
        Math.cos(this.toRadians(destination.lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightDistance = R * c;

    // Multiply by 1.3 to account for road curvature (road multiplier)
    const roadDistance = straightDistance * 1.3;
    const durationMinutes = (roadDistance / avgSpeedKmH) * 60;

    return {
      distanceKm: Math.round(roadDistance * 100) / 100,
      durationMinutes: Math.round(durationMinutes * 10) / 10,
    };
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  private async queryOsrmRoute(
    origin: LocationCoordinates,
    destination: LocationCoordinates,
  ): Promise<{ distanceKm: number; durationMinutes: number } | null> {
    const url = `${this.osrmApiUrl}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`;
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;

    const data = await response.json();
    if (data?.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const distanceKm = route.distance / 1000;
      const durationMinutes = route.duration / 60;
      return {
        distanceKm: Math.round(distanceKm * 100) / 100,
        durationMinutes: Math.round(durationMinutes * 10) / 10,
      };
    }
    return null;
  }

  private async queryGoogleMapsDirections(
    origin: LocationCoordinates,
    destination: LocationCoordinates,
  ): Promise<{ distanceKm: number; durationMinutes: number } | null> {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${this.googleMapsApiKey}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;

    const data = await response.json();
    if (
      data?.routes &&
      data.routes.length > 0 &&
      data.routes[0].legs.length > 0
    ) {
      const leg = data.routes[0].legs[0];
      const distanceKm = leg.distance.value / 1000;
      const durationMinutes = leg.duration.value / 60;
      return {
        distanceKm: Math.round(distanceKm * 100) / 100,
        durationMinutes: Math.round(durationMinutes * 10) / 10,
      };
    }
    return null;
  }
}
