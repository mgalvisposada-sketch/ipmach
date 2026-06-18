# Railway Dockerfile Detection Troubleshooting

## Current Status
- ✅ Dockerfile exists in `deep-web` branch
- ✅ Dockerfile is in root directory
- ✅ railway.json configured

## If Railway Still Can't Find Dockerfile

### Solution 1: Configure Railway to Use `deep-web` Branch

1. Go to Railway Dashboard → Your Project → Settings
2. Under "Source" or "Git Repository":
   - **Branch**: Change from `main` to `deep-web`
   - Save changes

### Solution 2: Remove railway.json and Let Railway Auto-Detect

Railway can auto-detect Dockerfile. Try removing `railway.json` temporarily:

```bash
# Backup railway.json
mv railway.json railway.json.backup

# Push to trigger new build
git add .
git commit -m "Remove railway.json for auto-detection"
git push origin deep-web
```

Then Railway should auto-detect the Dockerfile.

### Solution 3: Explicitly Set Dockerfile Path in Railway Dashboard

1. Railway Dashboard → Project Settings → Build
2. Set:
   - **Builder**: `Dockerfile`
   - **Dockerfile Path**: Leave empty OR set to `./Dockerfile`
   - **Root Directory**: Leave empty (root)

### Solution 4: Verify Dockerfile is in Git

```bash
# Check if Dockerfile is tracked
git ls-files | grep Dockerfile

# If not, add it
git add Dockerfile
git commit -m "Add Dockerfile"
git push origin deep-web
```

### Solution 5: Use Railway CLI to Verify

```bash
# Install Railway CLI if needed
npm i -g @railway/cli

# Login and link project
railway login
railway link

# Check build
railway up
```

## Current Branch Configuration

Make sure Railway is watching the correct branch:
- Current branch: `deep-web`
- Dockerfile location: Root directory
- File name: `Dockerfile` (exact case, no extension)

## Quick Fix: Force Railway to Use Dockerfile

In Railway Dashboard:
1. Go to Settings → Build
2. Clear any custom build commands
3. Set Builder to: `Dockerfile`
4. Remove any Dockerfile path (let it auto-detect)
5. Save and trigger a new deployment

## Verification Checklist

- [ ] Dockerfile exists in root: `ls Dockerfile`
- [ ] Dockerfile is in Git: `git ls-files Dockerfile`
- [ ] Railway is watching `deep-web` branch
- [ ] No build commands override in Railway settings
- [ ] railway.json doesn't conflict (or remove it)

