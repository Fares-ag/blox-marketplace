"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_1 = require("better-auth/node");
const node_path_1 = __importDefault(require("node:path"));
const app_module_1 = require("./app.module");
const auth_constants_1 = require("./auth/auth.constants");
const security_middleware_1 = require("./common/security-middleware");
const request_id_1 = require("./common/request-id");
const multer_error_middleware_1 = require("./common/multer-error.middleware");
const sentry_1 = require("./observability/sentry");
const app_config_service_1 = require("./config/app-config.service");
const storage_service_1 = require("./storage/storage.service");
const listing_image_handler_1 = require("./media/listing-image.handler");
const catalog_image_handler_1 = require("./media/catalog-image.handler");
(0, sentry_1.initApiSentry)();
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bodyParser: false });
    const appConfig = app.get(app_config_service_1.AppConfigService);
    const config = app.get(config_1.ConfigService);
    app.enableCors({
        origin: appConfig.corsOrigins,
        credentials: true,
    });
    const auth = app.get(auth_constants_1.AUTH_INSTANCE);
    const expressApp = app.getHttpAdapter().getInstance();
    if (process.env.NODE_ENV === 'production') {
        expressApp.set('trust proxy', 1);
    }
    (0, request_id_1.applyRequestIdMiddleware)(expressApp);
    await (0, security_middleware_1.applySecurityMiddleware)(expressApp, config);
    const handler = (0, node_1.toNodeHandler)(auth);
    expressApp.all('/api/auth/*path', (req, res) => handler(req, res));
    const storage = app.get(storage_service_1.StorageService);
    expressApp.get('/api/v1/media/listings/*path', (req, res, next) => {
        void (0, listing_image_handler_1.serveListingImageRequest)(storage, req, res).catch(next);
    });
    expressApp.get('/api/v1/media/catalog/:filename', (req, res, next) => {
        void (0, catalog_image_handler_1.serveCatalogImageRequest)(req, res).catch(next);
    });
    const express = require('express');
    const multer = require('multer');
    expressApp.use(express.json({
        limit: '10mb',
        verify: (req, _res, buf) => {
            req.rawBody = buf.toString('utf8');
        },
    }));
    expressApp.use(express.urlencoded({ extended: true }));
    expressApp.use('/uploads', express.static(node_path_1.default.join(process.cwd(), '.uploads')));
    (0, multer_error_middleware_1.applyMulterErrorMiddleware)(expressApp, multer);
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    app.setGlobalPrefix('api', { exclude: [] });
    app.enableVersioning({
        type: common_1.VersioningType.URI,
        defaultVersion: '1',
    });
    app.useLogger(new request_id_1.RequestIdLogger());
    const port = appConfig.apiPort;
    await app.listen(port);
    console.log(`DriveMarket API http://localhost:${port}`);
    console.log(`Better Auth   http://localhost:${port}/api/auth`);
}
void bootstrap();
//# sourceMappingURL=main.js.map