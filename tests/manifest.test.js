const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.join(__dirname, '..');
const manifest = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, 'manifest.json'), 'utf8')
);

test('manifest uses supported extension metadata', () => {
    assert.equal(manifest.manifest_version, 3);
    assert.match(manifest.version, /^\d+(?:\.\d+){0,3}$/);
    assert.equal(
        manifest.content_security_policy.extension_pages,
        "script-src 'self'; object-src 'self'"
    );
});

test('every local file referenced by the manifest exists', () => {
    const referencedFiles = [
        manifest.action.default_popup,
        ...Object.values(manifest.action.default_icon),
        manifest.background.service_worker,
        ...manifest.content_scripts.flatMap(contentScript => contentScript.js || [])
    ];

    for (const file of new Set(referencedFiles)) {
        assert.ok(fs.existsSync(path.join(repositoryRoot, file)), `${file} must exist`);
    }
});

test('content scripts are limited to Credit Karma pages', () => {
    for (const contentScript of manifest.content_scripts) {
        assert.deepEqual(contentScript.matches, ['*://www.creditkarma.com/*']);
    }
});
