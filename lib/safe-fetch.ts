import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { AppError } from './errors'

const MAX_REDIRECTS = 5
const REQUEST_TIMEOUT_MS = 10_000

/** Parse a dotted-quad into its four octets, or null if it isn't IPv4. */
function ipv4Octets(address: string): [number, number, number, number] | null {
    const parts = address.split('.')
    if (parts.length !== 4) return null
    const octets = parts.map(p => Number(p))
    if (octets.some(o => !Number.isInteger(o) || o < 0 || o > 255)) return null
    return octets as [number, number, number, number]
}

function isPrivateIpv4(address: string): boolean {
    const octets = ipv4Octets(address)
    if (!octets) return true // unparseable: fail closed
    const [a, b] = octets

    if (a === 0) return true // "this network"
    if (a === 10) return true // RFC1918
    if (a === 127) return true // loopback
    if (a === 169 && b === 254) return true // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true // RFC1918
    if (a === 192 && b === 168) return true // RFC1918
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT, RFC6598
    if (a === 192 && b === 0) return true // IETF protocol assignments / TEST-NET-1
    if (a === 198 && (b === 18 || b === 19)) return true // benchmarking
    if (a === 198 && b === 51) return true // TEST-NET-2
    if (a === 203 && b === 0) return true // TEST-NET-3
    if (a >= 224) return true // multicast, reserved, broadcast

    return false
}

/** Render two 16-bit groups as a dotted-quad. */
function groupsToIpv4(hi: number, lo: number): string {
    return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`
}

/**
 * Expand any IPv6 spelling into its eight 16-bit groups.
 *
 * Needed because `new URL()` normalises addresses: `[::ffff:127.0.0.1]` comes
 * back as `::ffff:7f00:1`, so matching on a literal dotted quad silently misses
 * IPv4-mapped loopback.
 */
function expandIpv6(address: string): number[] | null {
    let addr = address.toLowerCase().split('%')[0] // strip zone index

    // Rewrite a trailing dotted-quad into the two hex groups it represents.
    const embedded = addr.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/)
    if (embedded) {
        const octets = ipv4Octets(embedded[2])
        if (!octets) return null
        const hi = ((octets[0] << 8) | octets[1]).toString(16)
        const lo = ((octets[2] << 8) | octets[3]).toString(16)
        addr = `${embedded[1]}${hi}:${lo}`
    }

    const halves = addr.split('::')
    if (halves.length > 2) return null

    const parseGroups = (part: string) =>
        part ? part.split(':').map(g => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN)) : []

    const head = parseGroups(halves[0])
    const tail = halves.length === 2 ? parseGroups(halves[1]) : []
    if ([...head, ...tail].some(Number.isNaN)) return null

    let groups: number[]
    if (halves.length === 2) {
        const fill = 8 - head.length - tail.length
        if (fill < 0) return null
        groups = [...head, ...new Array<number>(fill).fill(0), ...tail]
    } else {
        groups = head
    }

    return groups.length === 8 ? groups : null
}

function isPrivateIpv6(address: string): boolean {
    const g = expandIpv6(address)
    if (!g) return true // unparseable: fail closed

    if (g.every(x => x === 0)) return true // :: unspecified

    // IPv4-mapped (::ffff:0:0/96) and IPv4-compatible (::/96): the embedded
    // IPv4 address decides, so ::ffff:127.0.0.1 is loopback.
    if (g.slice(0, 5).every(x => x === 0) && g[5] === 0xffff) {
        return isPrivateIpv4(groupsToIpv4(g[6], g[7]))
    }
    if (g.slice(0, 6).every(x => x === 0)) {
        return isPrivateIpv4(groupsToIpv4(g[6], g[7]))
    }

    // 6to4 tunnels carry the IPv4 address in groups 1-2.
    if (g[0] === 0x2002) {
        return isPrivateIpv4(groupsToIpv4(g[1], g[2]))
    }

    if (g[0] === 0x0064 && g[1] === 0xff9b) return true // 64:ff9b::/96 NAT64
    if (g[0] === 0x2001 && g[1] === 0x0db8) return true // 2001:db8::/32 docs

    if ((g[0] & 0xfe00) === 0xfc00) return true // fc00::/7 unique-local
    if ((g[0] & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
    if ((g[0] & 0xff00) === 0xff00) return true // ff00::/8 multicast

    return false
}

/** Exported for tests: true when an IP literal must not be fetched. */
export function isPrivateAddress(address: string): boolean {
    const version = isIP(address)
    if (version === 4) return isPrivateIpv4(address)
    if (version === 6) return isPrivateIpv6(address)
    return true // not an IP at all: fail closed
}

/**
 * Reject a URL that isn't plain http(s) pointing at a public address.
 *
 * Without this the ingest route is a server-side request forgery primitive:
 * the caller supplies any URL and the server fetches it with the server's own
 * network position, reaching localhost, RFC1918 hosts and the cloud metadata
 * endpoint at 169.254.169.254.
 */
async function assertPublicUrl(raw: string): Promise<URL> {
    let url: URL
    try {
        url = new URL(raw)
    } catch {
        throw new AppError('That does not look like a valid URL.')
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new AppError('Only http and https URLs can be imported.')
    }
    if (url.username || url.password) {
        throw new AppError('URLs with embedded credentials are not allowed.')
    }

    // A bare IP literal never needs DNS; check it directly.
    const hostname = url.hostname.replace(/^\[|\]$/g, '')
    if (isIP(hostname)) {
        if (isPrivateAddress(hostname)) {
            throw new AppError('That URL points to a private address.')
        }
        return url
    }

    let addresses
    try {
        addresses = await lookup(hostname, { all: true })
    } catch {
        throw new AppError('That host could not be resolved.')
    }

    if (addresses.length === 0 || addresses.some(a => isPrivateAddress(a.address))) {
        throw new AppError('That URL points to a private address.')
    }

    return url
}

/**
 * Fetch a user-supplied URL with SSRF, timeout and size limits.
 *
 * Redirects are followed manually so every hop is re-validated — a public host
 * that 302s to 169.254.169.254 would otherwise walk straight past the check.
 *
 * Note: this validates the address DNS reports and then lets fetch resolve the
 * name again, so a determined attacker controlling an authoritative nameserver
 * can still win a DNS-rebinding race. Closing that fully needs a pinned-IP
 * agent or an egress proxy; this covers the practical cases.
 */
export async function safeFetchText(rawUrl: string, maxBytes: number): Promise<string> {
    let current = await assertPublicUrl(rawUrl)

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const response = await fetch(current, {
            redirect: 'manual',
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            headers: { accept: 'text/html,text/plain;q=0.9,*/*;q=0.8' },
        }).catch((error: unknown) => {
            if (error instanceof Error && error.name === 'TimeoutError') {
                throw new AppError('That URL took too long to respond.', 504)
            }
            throw new AppError('That URL could not be fetched.', 502)
        })

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location')
            if (!location) {
                throw new AppError('That URL returned a redirect with no target.', 502)
            }
            current = await assertPublicUrl(new URL(location, current).toString())
            continue
        }

        if (!response.ok) {
            throw new AppError(`That URL returned HTTP ${response.status}.`, 502)
        }

        const contentType = response.headers.get('content-type') ?? ''
        if (contentType && !/^(text\/|application\/(xhtml\+xml|xml|json))/i.test(contentType)) {
            throw new AppError(`Unsupported content type: ${contentType.split(';')[0]}.`)
        }

        const declared = Number(response.headers.get('content-length'))
        if (Number.isFinite(declared) && declared > maxBytes) {
            throw new AppError('That page is too large to import.', 413)
        }

        return await readCapped(response, maxBytes)
    }

    throw new AppError('That URL redirected too many times.', 502)
}

/** Read a response body, aborting once it exceeds maxBytes. */
async function readCapped(response: Response, maxBytes: number): Promise<string> {
    if (!response.body) return ''

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const parts: string[] = []
    let total = 0

    try {
        for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            total += value.byteLength
            if (total > maxBytes) {
                throw new AppError('That page is too large to import.', 413)
            }
            parts.push(decoder.decode(value, { stream: true }))
        }
    } finally {
        await reader.cancel().catch(() => {})
    }

    parts.push(decoder.decode())
    return parts.join('')
}
