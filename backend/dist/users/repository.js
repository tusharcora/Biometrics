"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findOrCreateUserByProvider = findOrCreateUserByProvider;
const client_1 = require("../db/client");
async function findOrCreateUserByProvider(email, provider, providerUserId) {
    // Identity is the provider subject, never the email address. The stored email
    // is refreshed on each sign-in in case it changed at the provider.
    return client_1.prisma.user.upsert({
        where: { authProvider_providerUserId: { authProvider: provider, providerUserId } },
        update: { email },
        create: { email, authProvider: provider, providerUserId },
        select: { id: true },
    });
}
//# sourceMappingURL=repository.js.map