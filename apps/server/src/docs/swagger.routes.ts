import { Router, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiSpec } from "./openapi";

const router = Router();

// Raw JSON spec endpoint
router.get("/openapi.json", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  res.status(200).send(openApiSpec);
});

// Interactive Swagger UI documentation
router.use("/", swaggerUi.serve);
router.get("/", swaggerUi.setup(openApiSpec, {
  customSiteTitle: "CivicTrack API Documentation",
  customCss: `
    .swagger-ui .topbar { background-color: #0d1117; border-bottom: 1px solid #30363d; }
    .swagger-ui .info .title { color: #14b8a6; }
  `,
}));

export const docsRoutes = router;
