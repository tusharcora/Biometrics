import { Request, Response, NextFunction } from 'express';
export interface AuthedRequest extends Request {
    userId?: string;
}
export declare function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=middleware.d.ts.map