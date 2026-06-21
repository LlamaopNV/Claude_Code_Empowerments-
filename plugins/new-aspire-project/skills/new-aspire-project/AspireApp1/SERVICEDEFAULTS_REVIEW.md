# ServiceDefaults Usage Review

**Date:** 2026-02-10
**Status:** ✅ CORRECTED

## Executive Summary

This document provides a comprehensive review of `AspireApp1.ServiceDefaults` usage across all projects in the solution. A critical issue was identified and corrected in the API project.

---

## What ServiceDefaults Provides

ServiceDefaults is an Aspire pattern that provides centralized, consistent configuration for:

1. **OpenTelemetry Integration**
   - Structured logging with OpenTelemetry format
   - Distributed tracing (ASP.NET Core, HTTP Client instrumentation)
   - Runtime metrics (ASP.NET Core, HTTP Client, Runtime instrumentation)
   - Automatic OTLP exporter configuration
   - Support for Azure Monitor integration

2. **Service Discovery**
   - Enables services to discover each other in the Aspire orchestration environment
   - Automatic DNS-based service resolution

3. **HTTP Resilience Patterns**
   - Automatic retry policies on HTTP clients
   - Circuit breaker patterns
   - Timeout handling
   - Configured via `ConfigureHttpClientDefaults`

4. **Health Checks**
   - `/health` endpoint (all health checks must pass)
   - `/alive` endpoint (liveness probe, only "live" tagged checks)
   - Automatic "self" health check registration
   - Only exposed in Development environment for security

---

## Current State Analysis

### Projects CORRECTLY Using ServiceDefaults ✅

#### 1. AspireApp1.DbMigrator
- **Reference:** ✅ Present in .csproj (line 20)
- **Usage:** ✅ Calls `builder.AddServiceDefaults()` in Program.cs (line 11)
- **Rationale:** Database migrator benefits from telemetry and logging for observability in Aspire dashboard
- **Benefits:**
  - Track migration duration and success/failure in telemetry
  - Consistent logging format across all services
  - Integration with Aspire dashboard for monitoring

#### 2. AspireApp1.Api ✅ (CORRECTED)
- **Reference:** ✅ NOW ADDED to .csproj
- **Usage:** ✅ NOW CALLS `builder.AddServiceDefaults()` in Program.cs
- **Calls:** ✅ NOW CALLS `app.MapDefaultEndpoints()` for health checks
- **Previous Issue:** Was manually adding health checks instead of using ServiceDefaults
- **Fixed On:** 2026-02-10

### Projects CORRECTLY NOT Using ServiceDefaults ✅

#### 3. AspireApp1.Application
- **Reference:** ❌ Not present (CORRECT)
- **Rationale:** Business logic layer, no hosting concerns
- **Pattern:** This is a class library with CQRS handlers, validators, and DTOs

#### 4. AspireApp1.Infrastructure
- **Reference:** ❌ Not present (CORRECT)
- **Rationale:** Data access layer, no hosting concerns
- **Pattern:** This is a class library with DbContext and repositories

#### 5. AspireApp1.Domain
- **Reference:** ❌ Not present (CORRECT)
- **Rationale:** Pure domain entities, no dependencies on infrastructure
- **Pattern:** This is a pure domain model layer

#### 6. AspireApp1.AppHost
- **Reference:** ❌ Not present (CORRECT)
- **Rationale:** Orchestrator project, uses different Aspire SDK
- **Pattern:** Uses `Aspire.AppHost.Sdk` for orchestration, not service hosting

---

## Changes Made

### AspireApp1.Api.csproj
**Added ServiceDefaults project reference:**

```xml
<ItemGroup>
  <ProjectReference Include="..\AspireApp1.Application\AspireApp1.Application.csproj" />
  <ProjectReference Include="..\AspireApp1.Infrastructure\AspireApp1.Infrastructure.csproj" />
  <ProjectReference Include="..\AspireApp1.ServiceDefaults\AspireApp1.ServiceDefaults.csproj" />
</ItemGroup>
```

### AspireApp1.Api Program.cs

**BEFORE:**
```csharp
var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks(); // Manual health checks

// Register Application layer (CQRS handlers, validators, domain services)
builder.Services.AddApplication();

// Register Infrastructure layer (DbContext, data access)
builder.Services.AddInfrastructure(builder);

var app = builder.Build();

// ... middleware setup ...

// Manual health check endpoint
app.MapHealthChecks("/health");

// Register all endpoint groups automatically
app.MapEndpointGroups();

app.Run();
```

**AFTER:**
```csharp
var builder = WebApplication.CreateBuilder(args);

// Add ServiceDefaults FIRST (telemetry, resilience, health checks, service discovery)
builder.AddServiceDefaults();

// Add services to the container.
builder.Services.AddOpenApi();

// Register Application layer (CQRS handlers, validators, domain services)
builder.Services.AddApplication();

// Register Infrastructure layer (DbContext, data access)
builder.Services.AddInfrastructure(builder);

var app = builder.Build();

// ... middleware setup ...

// Register all endpoint groups automatically
app.MapEndpointGroups();

// Map default endpoints LAST (health checks, liveness probes, telemetry)
app.MapDefaultEndpoints();

app.Run();
```

**Key Changes:**
1. Added `builder.AddServiceDefaults()` call FIRST (before other services)
2. Removed manual `builder.Services.AddHealthChecks()` (now handled by ServiceDefaults)
3. Removed manual `app.MapHealthChecks("/health")` endpoint
4. Added `app.MapDefaultEndpoints()` call at the END (provides `/health` and `/alive` endpoints)

---

## Standard Program.cs Pattern for Aspire Services

### Recommended Structure

```csharp
using AspireApp1.Api.Endpoints;
using AspireApp1.Application;
using AspireApp1.Infrastructure;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// 1. Add ServiceDefaults FIRST (sets up telemetry, resilience, health checks, service discovery)
builder.AddServiceDefaults();

// 2. Add other services (OpenAPI, Application layer, Infrastructure layer, etc.)
builder.Services.AddOpenApi();
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder);

var app = builder.Build();

// 3. Configure middleware
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();

// 4. Map custom endpoints
app.MapGet("/", () => Results.Redirect("/scalar/v1", permanent: false))
    .ExcludeFromDescription();

app.MapEndpointGroups();

// 5. Map default endpoints LAST (health checks, liveness probes)
app.MapDefaultEndpoints();

app.Run();
```

### Order of Operations Explained

1. **`builder.AddServiceDefaults()` FIRST**
   - Sets up OpenTelemetry (logging, metrics, tracing)
   - Configures service discovery
   - Adds resilience to HTTP clients
   - Registers base health checks

2. **Application-specific services SECOND**
   - OpenAPI/Swagger configuration
   - Business logic layer registration
   - Data access layer registration
   - Custom services and dependencies

3. **Middleware configuration THIRD**
   - HTTPS redirection
   - Authentication/Authorization (if applicable)
   - CORS (if applicable)

4. **Custom endpoints FOURTH**
   - API endpoint groups
   - Custom routes

5. **`app.MapDefaultEndpoints()` LAST**
   - Health check endpoints (`/health`, `/alive`)
   - Only exposed in Development environment
   - Integrates with Aspire dashboard

---

## ServiceDefaults Implementation Details

### Location
`Orchestration/AspireApp1.ServiceDefaults/Extensions.cs`

### Key Extension Methods

#### 1. `AddServiceDefaults<TBuilder>()`
Main entry point that orchestrates all service defaults setup:
- Configures OpenTelemetry
- Adds default health checks
- Enables service discovery
- Configures HTTP client resilience

#### 2. `ConfigureOpenTelemetry<TBuilder>()`
Sets up complete observability stack:
- **Logging**: OpenTelemetry format with formatted messages and scopes
- **Metrics**: ASP.NET Core, HTTP Client, and Runtime instrumentation
- **Tracing**: Custom source traces, ASP.NET Core traces, HTTP Client traces
- **Filters**: Excludes health check endpoints from tracing to reduce noise

#### 3. `AddDefaultHealthChecks<TBuilder>()`
Registers base health checks:
- Self health check (always returns Healthy)
- Tagged with "live" for liveness probes

#### 4. `MapDefaultEndpoints()`
Exposes health check endpoints (Development only):
- `/health` - All health checks must pass (readiness probe)
- `/alive` - Only "live" tagged checks must pass (liveness probe)

---

## Benefits of ServiceDefaults

### 1. Consistency Across Services
- All services use the same telemetry format
- Unified health check patterns
- Consistent resilience policies

### 2. Reduced Boilerplate
- Single line to add comprehensive observability
- No need to manually configure OpenTelemetry in each service
- Automatic HTTP client resilience

### 3. Aspire Dashboard Integration
- Telemetry automatically flows to Aspire dashboard
- Health checks visible in orchestration UI
- Service-to-service communication tracked

### 4. Production-Ready Patterns
- Circuit breakers and retries out of the box
- Proper health check segregation (liveness vs. readiness)
- Security-conscious (health endpoints only in Development)

### 5. Extensibility
- Can be extended with project-specific defaults
- Easy to add custom health checks
- Simple to integrate Azure Monitor or other exporters

---

## Decision Matrix: When to Use ServiceDefaults

| Project Type | Use ServiceDefaults? | Rationale |
|--------------|---------------------|-----------|
| API Service (ASP.NET Core) | ✅ YES | Needs telemetry, health checks, service discovery |
| Worker Service | ✅ YES | Long-running process benefits from observability |
| Console App (short-lived) | ⚠️ MAYBE | Consider if observability is valuable |
| Console App (orchestrated) | ✅ YES | DbMigrator pattern - track execution in dashboard |
| Class Library (Application layer) | ❌ NO | Business logic, no hosting concerns |
| Class Library (Infrastructure) | ❌ NO | Data access, no hosting concerns |
| Class Library (Domain) | ❌ NO | Pure domain model, no dependencies |
| AppHost | ❌ NO | Uses `Aspire.AppHost.Sdk` for orchestration |

---

## Testing Checklist

After making ServiceDefaults changes, verify:

- [ ] Project builds successfully
- [ ] Application starts without errors
- [ ] Health endpoints respond correctly:
  - `/health` returns 200 OK with all checks
  - `/alive` returns 200 OK with liveness checks
- [ ] Telemetry appears in Aspire dashboard:
  - Logs are captured
  - Metrics are reported
  - Traces are recorded
- [ ] Service discovery works between services
- [ ] HTTP client resilience is active (check for retries on failures)

---

## Common Issues and Solutions

### Issue: Build fails after adding ServiceDefaults
**Solution:** The API process may be running and locking DLL files. Stop the running application and rebuild.

### Issue: Health checks return 404
**Solution:** Ensure `app.MapDefaultEndpoints()` is called after all other endpoint mappings.

### Issue: Telemetry not appearing in Aspire dashboard
**Solution:**
1. Verify `builder.AddServiceDefaults()` is called before other services
2. Check that `OTEL_EXPORTER_OTLP_ENDPOINT` is configured in Aspire orchestration
3. Ensure service is registered in AppHost with `.WithReference(serviceDefaults)`

### Issue: Service discovery not working
**Solution:** Verify the service is registered with the AppHost and that both services use ServiceDefaults.

---

## Future Enhancements

Consider extending ServiceDefaults with:

1. **Custom Resilience Policies**
   - Different retry strategies for external APIs vs. internal services
   - Custom circuit breaker thresholds

2. **Additional Health Checks**
   - Database connectivity checks
   - External dependency checks (Redis, message queues)

3. **Authentication/Authorization Defaults**
   - JWT bearer token configuration
   - OAuth2/OIDC integration

4. **CORS Policies**
   - Centralized CORS configuration for frontend integration

5. **Rate Limiting**
   - Default rate limiting policies for public APIs

6. **API Versioning**
   - Consistent versioning strategy across all APIs

---

## References

- [Aspire Service Defaults Documentation](https://aka.ms/dotnet/aspire/service-defaults)
- [OpenTelemetry in .NET](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/observability-with-otel)
- [Health Checks in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/health-checks)
- [Service Discovery in .NET Aspire](https://learn.microsoft.com/en-us/dotnet/aspire/service-discovery/overview)

---

## Conclusion

The AspireApp1 solution now correctly uses ServiceDefaults across all appropriate projects:

- **AspireApp1.Api:** ✅ Uses ServiceDefaults (CORRECTED)
- **AspireApp1.DbMigrator:** ✅ Uses ServiceDefaults (was already correct)
- **All other projects:** ✅ Correctly do NOT use ServiceDefaults

This ensures consistent observability, resilience, and health check patterns across all hosted services while maintaining clean architecture boundaries in library projects.

The API will gain full OpenTelemetry integration, HTTP resilience, service discovery, and proper health check endpoints once it is restarted with the corrected configuration.
