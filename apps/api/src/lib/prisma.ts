import { PrismaClient } from '@prisma/client';

/**
 * The repository layer is the only place this client should be imported.
 * Services and controllers must never import Prisma types into their public
 * signatures - repositories translate to/from domain types.
 */
export const prisma = new PrismaClient();
