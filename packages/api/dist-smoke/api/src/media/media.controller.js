"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaController = void 0;
const common_1 = require("@nestjs/common");
const guards_1 = require("../auth/guards");
const storage_service_1 = require("../storage/storage.service");
const listing_image_handler_1 = require("./listing-image.handler");
let MediaController = class MediaController {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    async serveListingImage(req, res) {
        if (!(0, listing_image_handler_1.listingImageKeyFromRequest)(req))
            throw new common_1.NotFoundException();
        await (0, listing_image_handler_1.serveListingImageRequest)(this.storage, req, res);
    }
};
exports.MediaController = MediaController;
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Get)('listings/*path'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "serveListingImage", null);
exports.MediaController = MediaController = __decorate([
    (0, common_1.Controller)('media'),
    __metadata("design:paramtypes", [storage_service_1.StorageService])
], MediaController);
//# sourceMappingURL=media.controller.js.map