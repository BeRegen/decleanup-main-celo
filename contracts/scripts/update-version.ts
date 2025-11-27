import * as fs from "fs";
import * as path from "path";

function updateVersion(customVersion?: string) {
  // Read package.json
  const packagePath = path.join(__dirname, "../package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));

  let newVersion: string;

  if (customVersion) {
    // Use custom version if provided
    newVersion = customVersion;
  } else {
    // If no version exists, start with 1.0.0
    if (!packageJson.version) {
      newVersion = "1.0.0";
    } else {
      // Parse current version
      const [major, minor, patch] = packageJson.version.split(".").map(Number);
      // Increment patch version
      newVersion = `${major}.${minor}.${patch + 1}`;
    }
  }

  // Update package.json
  packageJson.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));

  console.log(`Updated version to ${newVersion}`);
  return newVersion;
}

// Parse command line arguments
const args = process.argv.slice(2);
const customVersion = args.includes("--set-version")
  ? args[args.indexOf("--set-version") + 1]
  : undefined;

// Update version and export it for use in workflow
const newVersion = updateVersion(customVersion);

// For GitHub Actions, we need to output the version in a specific format
if (process.env.GITHUB_ACTIONS) {
  // Output in a format that GitHub Actions can use
  console.log(`::set-output name=version::${newVersion}`);
  // Also set it as an environment variable
  console.log(`::set-env name=NEW_VERSION::${newVersion}`);
} else {
  // For local use, just output the version
  process.stdout.write(newVersion);
}
