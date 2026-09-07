import { ConsentCode, DataRightsRequestKind, DataRightsRequestStatus, User } from '@prisma/client';
import { DataRightsService } from './data-rights.service';
declare class CreateDataRightsRequestDto {
    kind: DataRightsRequestKind;
    details?: string;
    consent_code?: ConsentCode;
}
declare class TransitionDataRightsRequestDto {
    status: DataRightsRequestStatus;
    resolution_note?: string;
}
declare class DataRightsQueueQueryDto {
    status?: DataRightsRequestStatus;
}
export declare class DataRightsController {
    private readonly dataRights;
    constructor(dataRights: DataRightsService);
    listMine(user: User): Promise<import("@drivemarket/shared/src/types/customer-platform").DataRightsRequestDto[]>;
    create(user: User, dto: CreateDataRightsRequestDto): Promise<import("@drivemarket/shared/src/types/customer-platform").DataRightsRequestDto>;
    exportMine(user: User): Promise<import("./data-rights.service").CustomerDataExport>;
    queue(query: DataRightsQueueQueryDto): Promise<import("@drivemarket/shared/src/types/customer-platform").DataRightsRequestDto[]>;
    transition(actor: User, id: string, dto: TransitionDataRightsRequestDto): Promise<import("@drivemarket/shared/src/types/customer-platform").DataRightsRequestDto>;
}
export {};
