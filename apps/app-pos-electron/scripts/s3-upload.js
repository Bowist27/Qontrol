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

const files = [
  `Qontrol POS Setup ${version}.exe`,
  `Qontrol POS Setup ${version}.exe.blockmap`,
  'latest.yml',
];

async function upload() {
  for (const file of files) {
    const filePath = path.join(releaseDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`  Warning: ${file} not found, skipping`);
      continue;
    }
    const body = fs.readFileSync(filePath);
    const key = `${PREFIX}/${file}`;
    console.log(`  Uploading ${file} (${(body.length / 1024 / 1024).toFixed(1)} MB)...`);
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
    }));
    console.log(`  ✓ ${file}`);
  }
  console.log('\n  All files uploaded successfully.');
}

upload().catch((err) => {
  console.error(`\n  Upload failed: ${err.message}`);
  process.exit(1);
});
