import { Request, Response, NextFunction } from "express";
import {
  ReverseGeocodeQuerySchema,
  ForwardGeocodeQuerySchema,
  DirectionsRequestSchema,
  ApiResponse,
  GeocodeResult,
  RouteCalculationResult,
} from "@civictrack/contracts";
import { MapsService } from "./maps.service.js";

export class MapsController {
  /**
   * GET /api/v1/maps/reverse-geocode?lng=77.5946&lat=12.9716
   */
  public static async reverseGeocode(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { lng, lat } = ReverseGeocodeQuerySchema.parse(req.query);
      const result = await MapsService.reverseGeocode([lng, lat]);

      const response: ApiResponse<GeocodeResult> = {
        success: true,
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/maps/geocode?query=MG Road Bangalore
   */
  public static async forwardGeocode(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { query } = ForwardGeocodeQuerySchema.parse(req.query);
      const results = await MapsService.forwardGeocode(query);

      const response: ApiResponse<GeocodeResult[]> = {
        success: true,
        data: results,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/maps/directions
   * Body: { origin: [lng, lat], destination: [lng, lat] }
   */
  public static async getDirections(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const dto = DirectionsRequestSchema.parse(req.body);
      const result = await MapsService.calculateDirections({
        origin: dto.origin as [number, number],
        destination: dto.destination as [number, number],
      });

      const response: ApiResponse<RouteCalculationResult> = {
        success: true,
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/maps/status
   */
  public static async getStatus(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const status = MapsService.getStatus();
      const response: ApiResponse<{ isConfigured: boolean; provider: string }> = {
        success: true,
        data: status,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}
