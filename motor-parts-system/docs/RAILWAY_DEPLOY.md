# Railway Deployment Instructions

## Issue: Dockerfile Not Found

If Railway reports that the Dockerfile doesn't exist, follow these steps:

### Step 1: Verify Dockerfile is in your repository

```bash
# Check if Dockerfile exists
ls -la Dockerfile

# Verify it's in Git
git status Dockerfile
```

### Step 2: Ensure Dockerfile is in the correct branch

Railway may be deploying from a different branch (like `main`). Make sure the Dockerfile exists in that branch:

```bash
# Check current branch
git branch

# If deploying from main, merge or copy Dockerfile to main
git checkout main
git merge deep-web  # or copy Dockerfile manually
git push origin main
```

### Step 3: Configure Railway

1. **Option A: Let Railway auto-detect** (Recommended)
   - Remove or rename `railway.json` temporarily
   - Railway will auto-detect the Dockerfile in the root

2. **Option B: Use railway.json**
   - Keep `railway.json` with the Dockerfile path
   - Ensure the path is correct: `"dockerfilePath": "Dockerfile"`

### Step 4: Railway Dashboard Configuration

1. Go to your Railway project settings
2. Under "Build Settings":
   - **Builder**: Select "Dockerfile"
   - **Dockerfile Path**: Leave empty (auto-detect) or enter `Dockerfile`
   - **Root Directory**: Leave empty (root)

### Step 5: Verify Build Context

Railway should detect:
- ✅ `Dockerfile` in root directory
- ✅ `package.json` exists
- ✅ `next.config.js` exists

### Step 6: Push and Deploy

```bash
# Commit all files
git add Dockerfile railway.json .dockerignore
git commit -m "Add Docker configuration for Railway"
git push origin deep-web  # or main, depending on your setup

# If Railway is connected to GitHub, it will auto-deploy
```

### Troubleshooting

**If Railway still can't find Dockerfile:**

1. **Check branch**: Railway might be watching `main` branch
   ```bash
   git checkout main
   git cherry-pick <commit-with-dockerfile>
   git push origin main
   ```

2. **Manual file path**: In Railway dashboard, explicitly set:
   - Dockerfile Path: `./Dockerfile`

3. **Check .dockerignore**: Ensure it's not excluding the Dockerfile itself

4. **Railway CLI**: Use Railway CLI to verify
   ```bash
   railway link
   railway up
   ```

### Current Files Status

- ✅ `Dockerfile` exists in root
- ✅ `railway.json` configured
- ✅ `.dockerignore` configured
- ✅ `next.config.js` has `output: 'standalone'`

### Next Steps

1. Ensure Dockerfile is in the branch Railway is deploying from
2. Push the branch to trigger a new deployment
3. Check Railway build logs for errors

