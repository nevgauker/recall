import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

let prismaInstance: PrismaClient | undefined

function getPrisma(): PrismaClient {
    // Reuse the client stashed on globalThis. In dev, HMR re-evaluates this
    // module on every edit; without the read below each reload built a fresh
    // client and leaked its connection pool.
    prismaInstance ??= globalForPrisma.prisma

    if (!prismaInstance) {
        const databaseUrl = process.env.DATABASE_URL
        if (!databaseUrl) {
            throw new Error('DATABASE_URL is not set')
        }
        prismaInstance = new PrismaClient({
            adapter: new PrismaPg({ connectionString: databaseUrl }),
        })
        if (process.env.NODE_ENV !== 'production') {
            globalForPrisma.prisma = prismaInstance
        }
    }

    return prismaInstance
}

// Construction is deferred until first property access so that importing this
// module during the build (where DATABASE_URL may be absent) cannot throw.
export const prisma = new Proxy({} as PrismaClient, {
    get(_target, prop) {
        // Two-arg Reflect.get on purpose: passing the proxy as the receiver
        // would make Prisma's internal `this` re-enter this trap.
        return Reflect.get(getPrisma(), prop)
    },
})
