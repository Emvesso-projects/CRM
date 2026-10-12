import { prisma } from "../config/db";
import { storageService, StorageObjectInfo } from "../config/storage/storage.service";
import { logger } from "../config/logger";

/**
 * Storage Reconciliation & Cleanup Utility:
 * Identifies and purges abandoned temporary uploads and unreferenced storage objects.
 *
 * Usage:
 *   npx tsx src/scripts/reconcileStorage.ts [--dry-run] [--prune] [--all]
 *
 * Options:
 *   --dry-run (default)  Lists stale temp files and unreferenced objects without deleting.
 *   --prune              Deletes identified stale temp files (and unreferenced objects if --all).
 *   --all                Also scans for orphaned permanent files not referenced in database.
 */

const DRY_RUN = !process.argv.includes("--prune");
const SCAN_ALL = process.argv.includes("--all");
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function gatherDatabaseKeys(): Promise<Set<string>> {
  const referencedKeys = new Set<string>();

  // 1. User avatars
  const users = await prisma.user.findMany({
    where: { profileImage: { not: null } },
    select: { profileImage: true },
  });
  for (const u of users) {
    if (u.profileImage) referencedKeys.add(u.profileImage.replace(/^\/+/, ""));
  }

  // 2. Organization assets
  const orgs = await prisma.organization.findMany({
    select: { companyLogo: true, signature: true, qrCode: true },
  });
  for (const o of orgs) {
    if (o.companyLogo) referencedKeys.add(o.companyLogo.replace(/^\/+/, ""));
    if (o.signature) referencedKeys.add(o.signature.replace(/^\/+/, ""));
    if (o.qrCode) referencedKeys.add(o.qrCode.replace(/^\/+/, ""));
  }

  // 3. Lead photos
  const leads = await prisma.lead.findMany({
    where: { profilePicture: { not: null } },
    select: { profilePicture: true },
  });
  for (const l of leads) {
    if (l.profilePicture) referencedKeys.add(l.profilePicture.replace(/^\/+/, ""));
  }


  // 4. Quotation attachments
  const attachments = await prisma.quotationAttachment.findMany({
    select: { key: true },
  });
  for (const a of attachments) {
    if (a.key) referencedKeys.add(a.key.replace(/^\/+/, ""));
  }

  return referencedKeys;
}

async function reconcile() {
  console.log("==================================================");
  console.log(`Starting Storage Reconciliation`);
  console.log(`Provider: ${storageService.getProviderType()}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (preview only)" : "PRUNE (live deletion)"}`);
  console.log(`Scope: ${SCAN_ALL ? "All objects (including unreferenced permanent assets)" : "Temporary uploads only"}`);
  console.log("==================================================\n");

  const objects: StorageObjectInfo[] = await storageService.list();
  console.log(`Found ${objects.length} total objects in storage provider.\n`);

  const now = Date.now();
  let staleTempCount = 0;
  let staleTempBytes = 0;
  let unreferencedCount = 0;
  let unreferencedBytes = 0;

  const dbKeys = SCAN_ALL ? await gatherDatabaseKeys() : new Set<string>();

  for (const obj of objects) {
    const isTemp = obj.key.includes("/temp/");
    const ageMs = obj.lastModified ? now - obj.lastModified.getTime() : 0;
    const isOlderThan24h = ageMs > ONE_DAY_MS;

    if (isTemp) {
      if (isOlderThan24h) {
        staleTempCount++;
        staleTempBytes += obj.size || 0;
        console.log(
          `[STALE TEMP] ${obj.key} (size: ${obj.size || 0} bytes, age: ${Math.round(ageMs / 3600000)}h)`,
        );

        if (!DRY_RUN) {
          try {
            await storageService.delete(obj.key);
            console.log(`  -> Deleted from storage`);
          } catch (err: any) {
            console.error(`  -> Failed to delete ${obj.key}:`, err.message);
          }
        }
      }
    } else if (SCAN_ALL) {
      // Check if permanent key is unreferenced in DB
      const cleanKey = obj.key.replace(/^\/+/, "");
      if (!dbKeys.has(cleanKey)) {
        unreferencedCount++;
        unreferencedBytes += obj.size || 0;
        console.log(
          `[UNREFERENCED] ${obj.key} (size: ${obj.size || 0} bytes, last modified: ${obj.lastModified?.toISOString() || "unknown"})`,
        );

        if (!DRY_RUN) {
          try {
            await storageService.delete(obj.key);
            console.log(`  -> Deleted unreferenced object`);
          } catch (err: any) {
            console.error(`  -> Failed to delete ${obj.key}:`, err.message);
          }
        }
      }
    }
  }

  console.log("\n==================================================");
  console.log("Reconciliation Summary:");
  console.log(
    `Stale temp files (>24h): ${staleTempCount} (${(staleTempBytes / (1024 * 1024)).toFixed(2)} MB) ${
      DRY_RUN && staleTempCount > 0 ? "[Would be deleted with --prune]" : ""
    }`,
  );
  if (SCAN_ALL) {
    console.log(
      `Unreferenced permanent files: ${unreferencedCount} (${(unreferencedBytes / (1024 * 1024)).toFixed(2)} MB) ${
        DRY_RUN && unreferencedCount > 0 ? "[Would be deleted with --prune --all]" : ""
      }`,
    );
  }
  console.log("==================================================");
}

async function main() {
  try {
    await reconcile();
  } catch (err: any) {
    logger.error("Reconciliation failed:", { error: err.message, stack: err.stack });
    console.error("Reconciliation failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
