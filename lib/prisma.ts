import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

let prismaInstance: PrismaClient | undefined

export const prisma = new Proxy({} as PrismaClient, {
    get(_target, prop) {
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
        return Reflect.get(prismaInstance, prop)
    },
})
