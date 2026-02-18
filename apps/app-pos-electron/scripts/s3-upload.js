/**
 * Upload release files to S3 for Electron auto-update
 * Usage: node scripts/s3-upload.js <version>
 */
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/s3-upload.js <version>');
  process.exit(1);
}

const BUCKET = 'comex-auditorias-2026-production';
const REGION = 'mx-central-1';
const PREFIX = 'electron-updates';

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const releaseDir = path.join(__dirname, '..', 'release');

// Versioned files go into electron-updates/<version>/
const versionedFiles = [
  `Qontrol POS Setup ${version}.exe`,
  `Qontrol POS Setup ${version}.exe.blockmap`,
];

async function upload() {
  // 1. Upload installer + blockmap to version subfolder
  for (const file of versionedFiles) {
    const filePath = path.join(releaseDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`  Warning: ${file} not found, skipping`);
      continue;
    }
    const body = fs.readFileSync(filePath);
    const key = `${PREFIX}/${version}/${file}`;
    console.log(`  Uploading ${version}/${file} (${(body.length / 1024 / 1024).toFixed(1)} MB)...`);
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
    }));
    console.log(`  ✓ ${file}`);
  }

  // 2. Upload latest.yml to root, rewriting URLs to point to version subfolder
  const ymlPath = path.join(releaseDir, 'latest.yml');
  if (!fs.existsSync(ymlPath)) {
    console.log('  Warning: latest.yml not found, skipping');
  } else {
    let yml = fs.readFileSync(ymlPath, 'utf8');
    // Prefix file URLs with version folder (e.g. "url: Setup.exe" → "url: 1.0.0/Setup.exe")
    yml = yml.replace(/^(\s*url:\s*)(.+)$/gm, `$1${version}/$2`);
    yml = yml.replace(/^(path:\s*)(.+)$/gm, `$1${version}/$2`);
    console.log(`  Uploading latest.yml (patched with ${version}/ prefix)...`);
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: `${PREFIX}/latest.yml`,
      Body: Buffer.from(yml, 'utf8'),
      ContentType: 'text/yaml',
    }));
    console.log('  ✓ latest.yml');
  }

  console.log('\n  All files uploaded successfully.');
}

upload().catch((err) => {
  console.error(`\n  Upload failed: ${err.message}`);
  process.exit(1);
});
