import test from 'node:test'
import assert from 'node:assert/strict'
import { isPrivateAddress, safeFetchText } from '../lib/safe-fetch'
import { AppError } from '../lib/errors'

/** Assert that a URL is rejected before any request leaves the process. */
async function assertRejected(url: string, expected: RegExp) {
    await assert.rejects(
        () => safeFetchText(url, 1024),
        (error: unknown) => {
            assert.ok(error instanceof AppError, `expected AppError, got ${error}`)
            assert.match(error.message, expected)
            return true
        },
        `expected ${url} to be rejected`
    )
}

test('rejects non-http schemes', async () => {
    await assertRejected('file:///etc/passwd', /http and https/)
    await assertRejected('gopher://example.com/', /http and https/)
    await assertRejected('data:text/plain,hi', /http and https/)
})

test('rejects embedded credentials', async () => {
    await assertRejected('http://user:pass@example.com/', /credentials/)
})

test('rejects loopback', async () => {
    await assertRejected('http://127.0.0.1/', /private address/)
    await assertRejected('http://127.1.2.3:8080/admin', /private address/)
    await assertRejected('http://localhost:3000/', /private address/)
    await assertRejected('http://[::1]/', /private address/)
})

test('rejects the cloud metadata endpoint', async () => {
    await assertRejected('http://169.254.169.254/latest/meta-data/', /private address/)
    await assertRejected('http://169.254.170.2/v2/credentials', /private address/)
})

test('rejects RFC1918 space', async () => {
    await assertRejected('http://10.0.0.1/', /private address/)
    await assertRejected('http://172.16.0.1/', /private address/)
    await assertRejected('http://172.31.255.255/', /private address/)
    await assertRejected('http://192.168.1.1/', /private address/)
})

test('does not over-block addresses adjacent to private ranges', () => {
    // Asserted against the predicate directly: going through safeFetchText
    // would make real connections to unroutable hosts and wait for TCP timeouts.
    for (const host of ['172.15.0.1', '172.32.0.1', '11.0.0.1', '126.0.0.1', '8.8.8.8', '1.1.1.1']) {
        assert.equal(isPrivateAddress(host), false, `${host} should be allowed`)
    }
    for (const host of ['2001:4860:4860::8888', '2606:4700::1111']) {
        assert.equal(isPrivateAddress(host), false, `${host} should be allowed`)
    }
})

test('blocks every private range at the predicate level', () => {
    for (const host of [
        '0.0.0.0', '10.1.2.3', '127.0.0.1', '169.254.169.254', '172.16.0.1',
        '172.31.255.255', '192.168.0.1', '100.64.0.1', '224.0.0.1', '255.255.255.255',
        '::1', '::', 'fc00::1', 'fe80::1', 'ff02::1', '::ffff:7f00:1', '2002:a00:1::',
        'not-an-ip', '',
    ]) {
        assert.equal(isPrivateAddress(host), true, `${host} should be blocked`)
    }
})

test('rejects CGNAT, link-local and multicast', async () => {
    await assertRejected('http://100.64.0.1/', /private address/)
    await assertRejected('http://169.254.1.1/', /private address/)
    await assertRejected('http://224.0.0.1/', /private address/)
    await assertRejected('http://255.255.255.255/', /private address/)
})

test('rejects IPv6 unique-local and link-local', async () => {
    await assertRejected('http://[fc00::1]/', /private address/)
    await assertRejected('http://[fd12:3456::1]/', /private address/)
    await assertRejected('http://[fe80::1]/', /private address/)
    await assertRejected('http://[::ffff:127.0.0.1]/', /private address/)
    await assertRejected('http://[::ffff:10.0.0.1]/', /private address/)
})

test('rejects IPv4-mapped loopback in its URL-normalised hex form', async () => {
    // new URL() rewrites [::ffff:127.0.0.1] to ::ffff:7f00:1, so the guard has
    // to expand the address rather than pattern-match a dotted quad.
    assert.equal(new URL('http://[::ffff:127.0.0.1]/').hostname, '[::ffff:7f00:1]')
    await assertRejected('http://[::ffff:7f00:1]/', /private address/)
    await assertRejected('http://[::ffff:a00:1]/', /private address/)
    await assertRejected('http://[::ffff:a9fe:a9fe]/', /private address/)
    await assertRejected('http://[0:0:0:0:0:ffff:7f00:1]/', /private address/)
})

test('rejects 6to4 wrapping a private IPv4', async () => {
    await assertRejected('http://[2002:a00:1::]/', /private address/)
})

test('rejects unresolvable hosts', async () => {
    await assertRejected('http://this-host-does-not-exist.invalid/', /could not be resolved/)
})

test('rejects malformed input', async () => {
    await assertRejected('not a url', /valid URL/)
})
