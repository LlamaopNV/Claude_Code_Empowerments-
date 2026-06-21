# ServiceDefaults Quick Reference

## TL;DR

**AspireApp1.Api was missing ServiceDefaults integration. This has been corrected.**

---

## What Changed

### Files Modified

1. **`AspireApp1.Api\AspireApp1.Api.csproj`**
   - Added ServiceDefaults project reference

2. **`AspireApp1.Api\Program.cs`**
   - Added `builder.AddServiceDefaults()` call (FIRST, before other services)
   - Removed manual `builder.Services.AddHealthChecks()` call
   - Removed manual `app.MapHealthChecks("/health")` call
   - Added `app.MapDefaultEndpoints()` call (LAST, after other endpoints)

---

## Current ServiceDefaults Usage

| Project | Uses ServiceDefaults? | Why? |
|---------|----------------------|------|
| **AspireApp1.Api** | ✅ YES (FIXED) | API service needs telemetry, health checks, service discovery |
| **AspireApp1.DbMigrator** | ✅ YES | Console app benefits from observability in Aspire dashboard |
| **AspireApp1.Application** | ❌ NO | Business logic layer, no hosting concerns |
| **AspireApp1.Infrastructure** | ❌ NO | Data access layer, no hosting concerns |
| **AspireApp1.Domain** | ❌ NO | Pure domain entities, no dependencies |
| **AspireApp1.AppHost** | ❌ NO | Orchestrator, uses different SDK |

---

## ServiceDefaults Provides

1. **OpenTelemetry** - Logging, metrics, distributed tracing
2. **Service Discovery** - DNS-based service resolution
3. **HTTP Resilience** - Retries, circuit breakers, timeouts
4. **Health Checks** - `/health` and `/alive` endpoints (dev only)

---

## Standard Program.cs Pattern

```csharp
var builder = WebApplication.CreateBuilder(args);

// 1. ServiceDefaults FIRST
builder.AddServiceDefaults();

// 2. Application services SECOND
builder.Services.AddOpenApi();
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder);

var app = builder.Build();

// 3. Middleware and custom endpoints
app.MapEndpointGroups();

// 4. Default endpoints LAST
app.MapDefaultEndpoints();

app.Run();
```

---

## Next Steps

**IMPORTANT:** The API process is currently running and will need to be restarted for changes to take effect.

1. Stop the running AspireApp1.Api process
2. Rebuild the solution:
   ```bash
   dotnet build AspireApp1.slnx
   ```
3. Start the application via the AppHost:
   ```bash
   dotnet run --project AspireApp1.AppHost
   ```

---

## Verification

Once restarted, verify:

- [ ] API starts without errors
- [ ] `/health` endpoint returns 200 OK
- [ ] `/alive` endpoint returns 200 OK
- [ ] Telemetry appears in Aspire dashboard
- [ ] Logs show OpenTelemetry initialization

---

## Documentation

For complete details, see:
- **`SERVICEDEFAULTS_REVIEW.md`** - Full review and analysis
- **`AspireApp1.ServiceDefaults\Extensions.cs`** - Implementation source code

---

## Key Takeaway

ServiceDefaults is the foundation for Aspire observability and resilience. Always add it FIRST in hosted services (APIs, workers, console apps), but NOT in class libraries (Application, Infrastructure, Domain).
