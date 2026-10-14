import { createServer } from "node:http";
import path from "node:path";
import { createDb, migrate, resolveDbConfig } from "./db.js";
import { SqliteAICVMeasurementRepository, SqliteDay0EquipmentRepository, SqliteDay0MethodologyDecisionRepository, SqliteDay0PhysicalConfigRepository, SqliteDay0PotAllocationRepository, SqliteImageRecordRepository, SqliteManualMeasurementRepository, SqlitePlantRepository, SqlitePositionEventRepository, SqliteWaterEventRepository } from "./repositories/sqliteRepositories.js";
import { PlantsService, PlantsServiceError } from "./plantsService.js";
import { ImageUploadError, ImageUploadService, MAX_IMAGE_UPLOAD_BYTES } from "./imageUploadService.js";
import { WaterEventsService } from "./waterEventsService.js";
import { PositionEventsService } from "./positionEventsService.js";
import { ImagesService } from "./imagesService.js";
import { ManualMeasurementsService } from "./manualMeasurementsService.js";
import { AICVMeasurementsService } from "./aicvMeasurementsService.js";
import { Day0EquipmentService, Day0PhysicalConfigService, Day0PotAllocationService, Day0MethodologyDecisionService, Day0ServiceError } from "./day0Service.js";
import { createImportService, IMPORT_ENTITIES } from "./importService.js";
import type { ImportEntity, ImportFormat, ImportIssue } from "./importService.js";
import type { AICVMeasurementRepository, Day0EquipmentRepository, Day0MethodologyDecisionRepository, Day0PhysicalConfigRepository, Day0PotAllocationRepository, ImageRecordRepository, ManualMeasurementRepository, PlantRepository, PositionEventRepository, WaterEventRepository } from "./repositories/interfaces.js";
import { ServiceError } from "./serviceError.js";
import type Database from "better-sqlite3";

type JsonRecord = Record<string, unknown>;

function json(res: import("node:http").ServerResponse, status: number, body: JsonRecord) {
	res.statusCode = status;
	res.setHeader("content-type", "application/json; charset=utf-8");
	res.end(JSON.stringify(body));
}

type AppContext = {
	db: Database.Database;
	plantsRepository: PlantRepository;
	plantsService: PlantsService;
	waterEventsRepository: WaterEventRepository;
	waterEventsService: WaterEventsService;
	positionEventsRepository: PositionEventRepository;
	positionEventsService: PositionEventsService;
	imagesRepository: ImageRecordRepository;
	imagesService: ImagesService;
	imageUploadService: ImageUploadService;
	manualMeasurementsRepository: ManualMeasurementRepository;
	manualMeasurementsService: ManualMeasurementsService;
	aicvMeasurementsRepository: AICVMeasurementRepository;
	aicvMeasurementsService: AICVMeasurementsService;
	// Day 0
	day0EquipmentRepository: Day0EquipmentRepository;
	day0EquipmentService: Day0EquipmentService;
	day0PhysicalConfigRepository: Day0PhysicalConfigRepository;
	day0PhysicalConfigService: Day0PhysicalConfigService;
	day0PotAllocationRepository: Day0PotAllocationRepository;
	day0PotAllocationService: Day0PotAllocationService;
	day0MethodologyDecisionRepository: Day0MethodologyDecisionRepository;
	day0MethodologyDecisionService: Day0MethodologyDecisionService;
};

function createAppContext(config?: Parameters<typeof createDb>[0]): AppContext {
	const db = createDb(config);
	migrate(db);
	const plantsRepository = new SqlitePlantRepository(db);
	const waterEventsRepository = new SqliteWaterEventRepository(db);
	const positionEventsRepository = new SqlitePositionEventRepository(db);
	const imagesRepository = new SqliteImageRecordRepository(db);
	const manualMeasurementsRepository = new SqliteManualMeasurementRepository(db);
	const aicvMeasurementsRepository = new SqliteAICVMeasurementRepository(db);
	const plantsService = new PlantsService(plantsRepository, imagesRepository, manualMeasurementsRepository, waterEventsRepository, aicvMeasurementsRepository);
	const waterEventsService = new WaterEventsService(waterEventsRepository);
	const positionEventsService = new PositionEventsService(positionEventsRepository);
	const imagesService = new ImagesService(imagesRepository, resolveDbConfig(config).imagesDir);
	const imageUploadService = new ImageUploadService(db, resolveDbConfig(config).imagesDir);
	const manualMeasurementsService = new ManualMeasurementsService(manualMeasurementsRepository, imagesRepository);
	const aicvMeasurementsService = new AICVMeasurementsService(aicvMeasurementsRepository, imagesRepository);

	// Day 0
	const day0EquipmentRepository = new SqliteDay0EquipmentRepository(db);
	const day0PhysicalConfigRepository = new SqliteDay0PhysicalConfigRepository(db);
	const day0PotAllocationRepository = new SqliteDay0PotAllocationRepository(db);
	const day0MethodologyDecisionRepository = new SqliteDay0MethodologyDecisionRepository(db);
	const day0EquipmentService = new Day0EquipmentService(day0EquipmentRepository);
	const day0PhysicalConfigService = new Day0PhysicalConfigService(day0PhysicalConfigRepository);
	const day0PotAllocationService = new Day0PotAllocationService(day0PotAllocationRepository);
	const day0MethodologyDecisionService = new Day0MethodologyDecisionService(day0MethodologyDecisionRepository);

	return { db, plantsRepository, plantsService, waterEventsRepository, waterEventsService, positionEventsRepository, positionEventsService, imagesRepository, imagesService, imageUploadService, manualMeasurementsRepository, manualMeasurementsService, aicvMeasurementsRepository, aicvMeasurementsService, day0EquipmentRepository, day0EquipmentService, day0PhysicalConfigRepository, day0PhysicalConfigService, day0PotAllocationRepository, day0PotAllocationService, day0MethodologyDecisionRepository, day0MethodologyDecisionService };
}

async function readJsonBody(req: import("node:http").IncomingMessage): Promise<JsonRecord> {
	const chunks: Buffer[] = [];
	for await (const chunk of req) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}

	if (chunks.length === 0) return {};
	const raw = Buffer.concat(chunks).toString("utf8");

	try {
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error("Body must be a JSON object");
		}
		return parsed as JsonRecord;
	} catch {
		throw new PlantsServiceError("Invalid JSON body", "input.invalid_json", 400);
	}
}

function buildApp(context?: AppContext) {
  const appContext = context ?? createAppContext();
  const { db, plantsService, waterEventsService, positionEventsService, imagesService, imageUploadService, manualMeasurementsService, aicvMeasurementsService, day0EquipmentService, day0PhysicalConfigService, day0PotAllocationService, day0MethodologyDecisionService } = appContext;

  const importService = createImportService(db);

  const server = createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", "http://localhost");
      const pathname = url.pathname;

      if (method === "DELETE" && /^\/api\/plants\/.+/.test(pathname)) {
        return json(res, 405, {
          error: {
            code: "method.not_allowed",
            message: "Physical delete is not available for plant records",
          },
        });
      }

      if (method === "POST" && pathname === "/api/import/csv") {
        const contentType = req.headers["content-type"] ?? "";
        if (!contentType.includes("multipart/form-data")) {
          return json(res, 400, {
            error: {
              code: "import.invalid_content_type",
              message: "Content-Type must be multipart/form-data",
            },
          });
        }

        const boundary = contentType.split("boundary=")[1];
        if (!boundary) {
          return json(res, 400, {
            error: {
              code: "import.missing_boundary",
              message: "Missing multipart boundary",
            },
          });
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const body = Buffer.concat(chunks);

        const parts = parseMultipart(body, boundary);
        const filePart = parts.find((p) => p.name === "file");
        const entityParam = fieldValue(parts, "entity");
        const formatVersionParam = fieldValue(parts, "format_version") ?? "current";

        if (!filePart) {
          return json(res, 400, {
            error: {
              code: "import.missing_file",
              message: "Missing file part in multipart request",
            },
          });
        }

        // Only the basename is ever used (entity detection / error messages);
        // uploads are never written to disk and never executed.
        const filename = path.basename(filePart.filename ?? "import.csv");
        const csvContent = filePart.content.toString("utf8");

        const entityValue = entityParam ?? detectEntityFromFilename(filename);

        if (!entityValue) {
          return json(res, 400, {
            error: {
              code: "import.unknown_entity",
              message:
                "Could not determine CSV entity. Provide an explicit 'entity' form field: " +
                IMPORT_ENTITIES.join(", "),
            },
          });
        }

        if (!(IMPORT_ENTITIES as readonly string[]).includes(entityValue)) {
          return json(res, 400, {
            error: {
              code: "import.unknown_entity",
              message: "Invalid entity type",
            },
          });
        }
        const entity = entityValue as ImportEntity;

        let formatVersion: ImportFormat;
        if (formatVersionParam === "current" || formatVersionParam === "legacy") {
          formatVersion = formatVersionParam;
        } else {
          return json(res, 400, {
            error: {
              code: "import.invalid_format",
              message: "format_version must be 'current' or 'legacy'",
            },
          });
        }

        if (formatVersion === "legacy" && entity !== "manual_measurements") {
          return json(res, 400, {
            error: {
              code: "import.invalid_format",
              message: "format_version=legacy is only supported for entity 'manual_measurements'",
            },
          });
        }

        try {
          const result = importService.importEntity({
            entity,
            filename,
            content: csvContent,
            formatVersion,
          });
          return json(res, 200, { data: result });
        } catch (error) {
          if (error && typeof error === "object" && "code" in error) {
            const importError = error as { code: string; message: string; issues?: ImportIssue[] };
            if (
              importError.code === "import.validation_failed" ||
              importError.code === "import.failed"
            ) {
              return json(res, 400, {
                error: {
                  code: importError.code,
                  message: importError.message,
                  issues: importError.issues ?? [],
                },
              });
            }
          }
          return json(res, 400, {
            error: {
              code: "import.failed",
              message: "Import failed; no rows were committed",
              issues: [],
            },
          });
        }
      }

      if (method === "GET" && pathname === "/api/plants") {
        return json(res, 200, { data: plantsService.listPlants() });
      }

			if (method === "GET" && pathname === "/api/water-events") {
				return json(res, 200, { data: waterEventsService.listWaterEvents() });
			}

			if (method === "POST" && pathname === "/api/water-events") {
				const body = await readJsonBody(req);
				const created = waterEventsService.create(body as never);
				return json(res, 201, { data: created });
			}

			if (method === "GET" && pathname === "/api/position-events") {
				return json(res, 200, { data: positionEventsService.listPositionEvents() });
			}

			if (method === "POST" && pathname === "/api/position-events") {
				const body = await readJsonBody(req);
				const created = positionEventsService.create(body as never);
				return json(res, 201, { data: created });
			}
      if (method === "POST" && pathname === "/api/images/upload") {
        const contentType = req.headers["content-type"] ?? "";
        if (!contentType.includes("multipart/form-data")) {
          return json(res, 400, {
            error: {
              code: "image.invalid_content_type",
              message: "Content-Type must be multipart/form-data",
            },
          });
        }

        const boundary = contentType.split("boundary=")[1];
        if (!boundary) {
          return json(res, 400, {
            error: {
              code: "image.missing_boundary",
              message: "Missing multipart boundary",
            },
          });
        }

        const declaredLength = Number(req.headers["content-length"] ?? 0);
        if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_UPLOAD_BYTES + 1024 * 1024) {
          return json(res, 413, {
            error: {
              code: "image.too_large",
              message: `Upload exceeds the maximum allowed size of ${Math.floor(MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024))} MB`,
            },
          });
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const body = Buffer.concat(chunks);
        const parts = parseMultipart(body, boundary);
        const filePart = parts.find((p) => p.name === "file" && p.filename !== undefined);

        if (!filePart) {
          return json(res, 400, {
            error: {
              code: "image.missing_file",
              message: "Missing file part in multipart request",
            },
          });
        }

        const metadata = {
          image_id: fieldValue(parts, "image_id"),
          plant_id: fieldValue(parts, "plant_id"),
          timestamp: fieldValue(parts, "timestamp"),
          experiment_day: fieldValue(parts, "experiment_day"),
          camera_id: fieldValue(parts, "camera_id"),
          image_quality_status: fieldValue(parts, "image_quality_status"),
          calibration_status: fieldValue(parts, "calibration_status"),
          cal_ref_id: fieldValue(parts, "cal_ref_id"),
          failure_code: fieldValue(parts, "failure_code"),
          notes: fieldValue(parts, "notes"),
        };

        try {
          const image = imageUploadService.upload({
            content: filePart.content,
            declaredContentType: filePart.contentType,
            originalFilename: filePart.filename,
            metadata,
          });
          return json(res, 201, { data: image });
        } catch (error) {
          if (error instanceof ImageUploadError) {
            return json(res, error.status, {
              error: {
                code: error.code,
                message: error.message,
              },
            });
          }
          return json(res, 500, {
            error: {
              code: "internal.error",
              message: "Internal server error",
            },
          });
        }
      }

      if (method === "GET" && pathname === "/api/images") {
        return json(res, 200, { data: imagesService.listImages() });
      }

			if (method === "GET" && pathname === "/api/manual-measurements") {
				return json(res, 200, { data: manualMeasurementsService.listManualMeasurements() });
			}

			if (method === "POST" && pathname === "/api/manual-measurements") {
				const body = await readJsonBody(req);
				const created = manualMeasurementsService.create(body as never);
				return json(res, 201, { data: created });
			}


			if (method === "GET" && pathname === "/api/aicv-measurements") {
				return json(res, 200, { data: aicvMeasurementsService.listAICVMeasurements() });
			}

			if (method === "POST" && pathname === "/api/aicv-measurements") {
				const body = await readJsonBody(req);
				const created = aicvMeasurementsService.create(body as never);
				return json(res, 201, { data: created });
			}


			const aicvMeasurementMatch = pathname.match(/^\/api\/aicv-measurements\/([^/]+)$/);
			if (aicvMeasurementMatch && method === "GET") {
				const measurementId = decodeURIComponent(aicvMeasurementMatch[1]);
				const measurement = aicvMeasurementsService.getAICVMeasurementById(measurementId);
				if (!measurement) {
					return json(res, 404, {
						error: {
							code: "aicv_measurement.not_found",
							message: "AICV measurement not found",
						},
					});
				}
				return json(res, 200, { data: measurement });
			}

			const manualMeasurementMatch = pathname.match(/^\/api\/manual-measurements\/([^/]+)$/);
			if (manualMeasurementMatch && method === "GET") {
				const measurementId = decodeURIComponent(manualMeasurementMatch[1]);
				const measurement = manualMeasurementsService.getManualMeasurementById(measurementId);
				if (!measurement) {
					return json(res, 404, {
						error: {
							code: "manual_measurement.not_found",
							message: "Manual measurement not found",
						},
					});
				}
				return json(res, 200, { data: measurement });
			}

			// Minimal RAW image verification route: image_id -> ImageRecord ->
			// stored file. Only well-formed IMG ids are accepted and the file is
			// resolved exclusively from the persisted record (never from client
			// input); unknown/malformed/out-of-root cases respond 404 and no
			// filesystem path is ever exposed.
			const imageFileMatch = pathname.match(/^\/api\/images\/([^/]+)\/file$/);
			if (imageFileMatch && method === "GET") {
				const imageId = decodeURIComponent(imageFileMatch[1]);
				const file = imagesService.getImageFile(imageId);
				if (!file) {
					return json(res, 404, {
						error: {
							code: "image.not_found",
							message: "Image file not found",
						},
					});
				}
				res.statusCode = 200;
				res.setHeader("content-type", file.contentType);
				res.setHeader("content-length", String(file.content.length));
				res.end(file.content);
				return;
			}

			const imageMatch = pathname.match(/^\/api\/images\/([^/]+)$/);
			if (imageMatch && method === "GET") {
				const imageId = decodeURIComponent(imageMatch[1]);
				const image = imagesService.getImageById(imageId);
				if (!image) {
					return json(res, 404, {
						error: {
							code: "image.not_found",
							message: "Image not found",
						},
					});
				}
				return json(res, 200, { data: image });
			}

			if (method === "POST" && pathname === "/api/plants") {
				const body = await readJsonBody(req);
				const created = plantsService.createPlant(body as never);
				return json(res, 201, { data: created });
			}

			const plantMatch = pathname.match(/^\/api\/plants\/([^/]+)$/);
			if (plantMatch) {
				const plantId = decodeURIComponent(plantMatch[1]);

				if (method === "GET") {
					return json(res, 200, { data: plantsService.getPlantById(plantId) });
				}

				if (method === "PATCH") {
					const body = await readJsonBody(req);
					return json(res, 200, { data: plantsService.patchPlant(plantId, body as never) });
				}
			}

			const dayContextMatch = pathname.match(/^\/api\/plants\/([^/]+)\/day-context$/);
			if (dayContextMatch && method === "GET") {
				const plantId = decodeURIComponent(dayContextMatch[1]);
				const context = plantsService.getDayContext(plantId);
				if (!context) {
					return json(res, 404, {
						error: {
							code: "plant.not_found",
							message: "Plant not found",
						},
					});
				}
				return json(res, 200, { data: context });
			}

			const deactivateMatch = pathname.match(/^\/api\/plants\/([^/]+)\/deactivate$/);
			if (deactivateMatch && (method === "POST" || method === "PATCH")) {
				const plantId = decodeURIComponent(deactivateMatch[1]);
				const body = await readJsonBody(req);
				return json(res, 200, {
					data: plantsService.deactivatePlant(plantId, body as never),
				});
			}

			// Day 0 Equipment
			if (method === "GET" && pathname === "/api/day0/equipment") {
				return json(res, 200, { data: day0EquipmentService.list() });
			}
			if (method === "POST" && pathname === "/api/day0/equipment") {
				const body = await readJsonBody(req);
				const created = day0EquipmentService.create(body as never);
				return json(res, 201, { data: created });
			}
			const equipmentMatch = pathname.match(/^\/api\/day0\/equipment\/([^/]+)$/);
			if (equipmentMatch) {
				const id = decodeURIComponent(equipmentMatch[1]);
				if (method === "GET") {
					const item = day0EquipmentService.getById(id);
					if (!item) return json(res, 404, { error: { code: "equipment.not_found", message: "Equipment not found" } });
					return json(res, 200, { data: item });
				}
				if (method === "PATCH") {
					const body = await readJsonBody(req);
					return json(res, 200, { data: day0EquipmentService.update(id, body as never) });
				}
			}

			// Day 0 Physical Config
			if (method === "GET" && pathname === "/api/day0/physical-config") {
				const config = day0PhysicalConfigService.get();
				if (!config) return json(res, 404, { error: { code: "config.not_found", message: "Physical config not found" } });
				return json(res, 200, { data: config });
			}
			if (method === "POST" && pathname === "/api/day0/physical-config") {
				const body = await readJsonBody(req);
				const created = day0PhysicalConfigService.create(body as never);
				return json(res, 201, { data: created });
			}
			if (method === "PATCH" && pathname === "/api/day0/physical-config") {
				const body = await readJsonBody(req);
				return json(res, 200, { data: day0PhysicalConfigService.update(body as never) });
			}

			// Day 0 Pot Allocation
			if (method === "GET" && pathname === "/api/day0/pot-allocation") {
				return json(res, 200, { data: day0PotAllocationService.list() });
			}
			if (method === "POST" && pathname === "/api/day0/pot-allocation") {
				const body = await readJsonBody(req);
				const created = day0PotAllocationService.create(body as never);
				return json(res, 201, { data: created });
			}
			const allocationMatch = pathname.match(/^\/api\/day0\/pot-allocation\/([^/]+)$/);
			if (allocationMatch) {
				const id = decodeURIComponent(allocationMatch[1]);
				if (method === "GET") {
					const item = day0PotAllocationService.getById(id);
					if (!item) return json(res, 404, { error: { code: "allocation.not_found", message: "Allocation not found" } });
					return json(res, 200, { data: item });
				}
				if (method === "PATCH") {
					const body = await readJsonBody(req);
					return json(res, 200, { data: day0PotAllocationService.update(id, body as never) });
				}
			}

			// Day 0 Methodology Decisions
			if (method === "GET" && pathname === "/api/day0/methodology-decisions") {
				return json(res, 200, { data: day0MethodologyDecisionService.list() });
			}
			if (method === "POST" && pathname === "/api/day0/methodology-decisions") {
				const body = await readJsonBody(req);
				const created = day0MethodologyDecisionService.create(body as never);
				return json(res, 201, { data: created });
			}
			const decisionMatch = pathname.match(/^\/api\/day0\/methodology-decisions\/([^/]+)$/);
			if (decisionMatch) {
				const id = decodeURIComponent(decisionMatch[1]);
				if (method === "GET") {
					const item = day0MethodologyDecisionService.getById(id);
					if (!item) return json(res, 404, { error: { code: "decision.not_found", message: "Decision not found" } });
					return json(res, 200, { data: item });
				}
				if (method === "PATCH") {
					const body = await readJsonBody(req);
					return json(res, 200, { data: day0MethodologyDecisionService.update(id, body as never) });
				}
			}

			return json(res, 404, {
				error: {
					code: "route.not_found",
					message: "Route not found",
				},
			});
		} catch (error) {
			if (error instanceof ServiceError) {
				return json(res, error.status, {
					error: {
						code: error.code,
						message: error.message,
						issues: error.issues ?? [],
					},
				});
			}

			if (error instanceof PlantsServiceError) {
				return json(res, error.status, {
					error: {
						code: error.code,
						message: error.message,
					},
				});
			}

			if (error instanceof Day0ServiceError) {
				return json(res, error.status, {
					error: {
						code: error.code,
						message: error.message,
					},
				});
			}

			return json(res, 500, {
				error: {
					code: "internal.error",
					message: "Internal server error",
				},
			});
		}
	});

	return { server, db };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3001);
  const context = createAppContext();
  const { server, db } = buildApp(context);

  server.listen(port, () => {
    console.log(`Backend server listening on http://localhost:${port}`);
  });

  process.on("SIGINT", () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}

type MultipartPart = {
  name: string;
  filename?: string;
  contentType?: string;
  content: Buffer;
};

function fieldValue(parts: MultipartPart[], name: string): string | undefined {
  const part = parts.find((p) => p.name === name && p.filename === undefined);
  if (!part) return undefined;
  return part.content.toString("utf8").trim();
}

/** Binary-safe multipart/form-data parser (file bytes are preserved exactly). */
function parseMultipart(body: Buffer, boundary: string): MultipartPart[] {
  const parts: MultipartPart[] = [];
  const delimiter = Buffer.from(`--${boundary}`);
  let searchFrom = 0;

  while (true) {
    const start = body.indexOf(delimiter, searchFrom);
    if (start === -1) break;

    let pos = start + delimiter.length;
    // Closing delimiter `--boundary--`.
    if (body[pos] === 0x2d && body[pos + 1] === 0x2d) break;

    // Skip the CRLF after the boundary.
    if (body[pos] === 0x0d) pos++;
    if (body[pos] === 0x0a) pos++;

    const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), pos);
    if (headerEnd === -1) break;
    const headerText = body.subarray(pos, headerEnd).toString("utf8");
    const contentStart = headerEnd + 4;

    const nextDelimiter = body.indexOf(delimiter, contentStart);
    if (nextDelimiter === -1) break;

    let contentEnd = nextDelimiter;
    // Strip the CRLF that precedes the next boundary.
    if (contentEnd - contentStart >= 2 && body[contentEnd - 2] === 0x0d && body[contentEnd - 1] === 0x0a) {
      contentEnd -= 2;
    }

    const nameMatch = /name="([^"]*)"/.exec(headerText);
    if (!nameMatch) {
      searchFrom = nextDelimiter;
      continue;
    }

    const part: MultipartPart = {
      name: nameMatch[1],
      content: Buffer.from(body.subarray(contentStart, contentEnd)),
    };
    const filenameMatch = /filename="([^"]*)"/.exec(headerText);
    if (filenameMatch) part.filename = filenameMatch[1];
    const contentTypeMatch = /content-type:\s*([^\s;]+)/i.exec(headerText);
    if (contentTypeMatch) part.contentType = contentTypeMatch[1];

    parts.push(part);
    searchFrom = nextDelimiter;
  }

  return parts;
}

/**
 * Entity detection is restricted to a validated registry of canonical file
 * names (measurements_schema.md) and repository templates (data/templates/).
 * Arbitrary filenames are never guessed: they require an explicit entity field.
 */
const ENTITY_FILENAMES: Record<string, ImportEntity> = {
  "plants.csv": "plants",
  "plants_template.csv": "plants",
  "water_log.csv": "water_events",
  "water_log_template.csv": "water_events",
  "positions_log.csv": "position_events",
  "positions_log_template.csv": "position_events",
  "positions_template.csv": "position_events",
  "images_log.csv": "image_records",
  "images_log_template.csv": "image_records",
  "images_template.csv": "image_records",
  "manual_measurements.csv": "manual_measurements",
  "manual_measurements_template.csv": "manual_measurements",
  "ai_measurements.csv": "aicv_measurements",
  "ai_measurements_template.csv": "aicv_measurements",
};

function detectEntityFromFilename(filename: string): ImportEntity | null {
  return ENTITY_FILENAMES[path.basename(filename).toLowerCase()] ?? null;
}

export { buildApp, createAppContext };
