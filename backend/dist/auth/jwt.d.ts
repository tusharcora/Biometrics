import { SessionTokens } from '../types';
export declare function issueSessionTokens(userId: string): Promise<SessionTokens>;
export declare function verifyAccessToken(token: string): {
    userId: string;
};
export declare function refreshSession(refreshToken: string): Promise<SessionTokens>;
export declare function revokeRefreshToken(refreshToken: string): Promise<void>;
//# sourceMappingURL=jwt.d.ts.map