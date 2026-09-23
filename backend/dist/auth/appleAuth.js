"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAppleIdentityToken = verifyAppleIdentityToken;
const jose = __importStar(require("jose"));
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
async function verifyAppleIdentityToken(identityToken) {
    const bundleId = process.env.APPLE_BUNDLE_ID;
    if (!bundleId)
        throw new Error('APPLE_BUNDLE_ID is not set');
    const jwks = jose.createRemoteJWKSet(new URL(APPLE_JWKS_URL));
    const { payload } = await jose.jwtVerify(identityToken, jwks, {
        issuer: 'https://appleid.apple.com',
    });
    // `aud` is `string | string[]` per the JWT spec, so an array containing the
    // bundle ID is a valid audience and must not be rejected.
    const audienceMatches = Array.isArray(payload.aud)
        ? payload.aud.includes(bundleId)
        : payload.aud === bundleId;
    if (!audienceMatches) {
        throw new Error('Apple identity token audience mismatch');
    }
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
        throw new Error('Apple identity token missing required claims');
    }
    // An unverified email must never be trusted as an identity signal.
    if (payload.email_verified !== true && payload.email_verified !== 'true') {
        throw new Error('Apple identity token email is not verified');
    }
    return { email: payload.email, providerUserId: payload.sub };
}
//# sourceMappingURL=appleAuth.js.map