# Development to Production Workflow

Use this workflow to preview and test code changes in development before deploying the same code to production.

## 1. Start the development environment

From the repository root, run:

```powershell
docker compose up -d
```

Follow the application logs if needed:

```powershell
docker compose logs -f app
```

Open the development app at:

```text
http://localhost:5173
```

Frontend and backend code changes reload automatically. Development uses a database that is separate from production.

## 2. Test the changes

Use the development app to confirm that the changed feature works and that existing features still behave correctly.

Before deploying, validate the server code and production frontend build:

```powershell
docker compose exec app npm run check
docker compose exec app npm run build
```

## 3. Commit the tested code

Review and commit only the intended changes:

```powershell
git status
git diff
git add <changed-files>
git commit -m "Describe the change"
```

## 4. Deploy to production

Build new production images and recreate the production application with the tested code:

```powershell
docker compose -f docker-compose.prod.yml up -d --build
```

Use the production file on its own. Do not combine it with `docker-compose.yml`
using multiple `-f` flags: the development image, startup command, bind mounts,
and database credentials would carry over and break the production app.

Production is available locally at:

```text
http://127.0.0.1:8080
```

If Tailscale Serve is configured, the app is also available through its private Tailscale URL.

## 5. Verify production

Check that the production containers are healthy:

```powershell
docker compose -f docker-compose.prod.yml ps
```

Review application logs:

```powershell
docker compose -f docker-compose.prod.yml logs -f app
```

Then open the production app and test the changed feature once more.

## Environment separation

| Environment | App URL | Database volume |
| --- | --- | --- |
| Development | `http://localhost:5173` | `budget_postgres` |
| Production | `http://127.0.0.1:8080` | `budget_prod_postgres` |

Changes made to development data do not affect production data.

## Quick reference

```text
Edit code -> preview on localhost:5173 -> test -> validate -> commit -> rebuild production -> verify on localhost:8080
```

## Production database safety

Do not add `-v` when stopping the production Compose stack:

```powershell
docker compose -f docker-compose.prod.yml down
```

Using `down -v` deletes the production database volume and can permanently remove production data.
