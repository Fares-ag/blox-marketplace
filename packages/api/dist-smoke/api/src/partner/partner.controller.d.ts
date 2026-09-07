import { ApplicationStatus, User } from '@prisma/client';
import type { Response } from 'express';
import { PaginationQueryDto } from '../common/pagination.dto';
import { PartnerService } from './partner.service';
declare class PartnerApplicationsQueryDto extends PaginationQueryDto {
    status?: ApplicationStatus;
}
export declare class PartnerController {
    private readonly partner;
    constructor(partner: PartnerService);
    list(user: User, query: PartnerApplicationsQueryDto): Promise<import("./partner.service").PartnerListResponse>;
    summary(user: User): Promise<import("./partner-logic").PartnerSummary>;
    detail(user: User, id: string): Promise<import("@drivemarket/shared/src/types/customer-platform").PartnerApplicationDto>;
    documentFile(user: User, id: string, docId: string, res: Response): Promise<void>;
}
export {};
