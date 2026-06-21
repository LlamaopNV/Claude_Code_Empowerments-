# Products Feature - PostgreSQL Setup Complete

## Overview

A complete PostgreSQL database setup with CRUD operations for a Products feature has been implemented following CQRS and clean architecture patterns.

## What Was Added

### 1. Package Management
Updated `Directory.Packages.props` with:
- `Aspire.Hosting.PostgreSQL` (13.1.0) - For AppHost PostgreSQL orchestration
- `Aspire.Npgsql.EntityFrameworkCore.PostgreSQL` (13.1.0) - Aspire EF Core integration
- `Npgsql.EntityFrameworkCore.PostgreSQL` (10.0.0) - PostgreSQL provider
- `Microsoft.EntityFrameworkCore` (10.0.0) - EF Core base
- `Microsoft.EntityFrameworkCore.Design` (10.0.0) - For migrations
- `Microsoft.EntityFrameworkCore.Tools` (10.0.0) - For migrations

### 2. Domain Layer (`AspireApp1.Domain`)
- **Product Entity** (`Entities/Product.cs`)
  - Properties: Id, Name, Description, Price, Stock, CreatedAt, UpdatedAt
  - Updated target framework to net10.0

### 3. Infrastructure Layer (`AspireApp1.Infrastructure`)
- **ApplicationDbContext** (`Data/ApplicationDbContext.cs`)
  - Implements `IApplicationDbContext`
  - Configured Product entity with table name, constraints, indexes
  - Automatic CreatedAt/UpdatedAt timestamp management
  - PostgreSQL column naming conventions (snake_case)

- **DependencyInjection** (`DependencyInjection.cs`)
  - Registers DbContext using Aspire's PostgreSQL integration
  - Registers `IApplicationDbContext` interface

- **Initial Migration** (Created: `20260210133836_InitialCreate.cs`)
  - Creates `products` table with all columns
  - Adds indexes on `name` and `created_at`

### 4. Application Layer (`AspireApp1.Application`)

#### Common Interfaces
- **IApplicationDbContext** (`Common/Interfaces/IApplicationDbContext.cs`)
  - Defines contract for database operations
  - Exposes `DbSet<Product>` and `SaveChangesAsync`

#### Products Feature Structure
```
Products/
├── Commands/
│   ├── CreateProduct/
│   │   ├── CreateProductCommand.cs
│   │   ├── CreateProductCommandHandler.cs
│   │   └── CreateProductCommandValidator.cs
│   ├── UpdateProduct/
│   │   ├── UpdateProductCommand.cs
│   │   ├── UpdateProductCommandHandler.cs
│   │   └── UpdateProductCommandValidator.cs
│   └── DeleteProduct/
│       ├── DeleteProductCommand.cs
│       └── DeleteProductCommandHandler.cs
├── Queries/
│   ├── GetProductById/
│   │   ├── GetProductByIdQuery.cs
│   │   ├── GetProductByIdQueryHandler.cs
│   │   └── GetProductByIdQueryValidator.cs
│   └── GetAllProducts/
│       ├── GetAllProductsQuery.cs
│       └── GetAllProductsQueryHandler.cs
├── Models/
│   ├── ProductDto.cs
│   ├── CreateProductRequest.cs
│   └── UpdateProductRequest.cs
├── Mappers/
│   └── ProductMappingExtensions.cs
└── Exceptions/
    └── ProductNotFoundException.cs
```

#### Key Features
- **CQRS Handlers**: All use primary constructors for dependency injection
- **Validation**: FluentValidation rules for all commands and critical queries
- **Mapping**: Static extension methods for entity ↔ DTO conversion
- **Exception Handling**: Custom `ProductNotFoundException` for domain-specific errors

### 5. API Layer (`AspireApp1.Api`)

#### ProductEndpoints (`Endpoints/ProductEndpoints.cs`)
Implements `IEndpointGroup` with the following endpoints:

- **POST /api/products** - Create a new product
  - Returns 201 Created with product ID
  - Validates name, price > 0, stock >= 0

- **GET /api/products** - Get all products
  - Returns 200 OK with array of products
  - Ordered by name

- **GET /api/products/{id}** - Get product by ID
  - Returns 200 OK with product or 404 Not Found

- **PUT /api/products/{id}** - Update a product
  - Returns 204 No Content or 404 Not Found
  - Validates all product properties

- **DELETE /api/products/{id}** - Delete a product
  - Returns 204 No Content or 404 Not Found

All endpoints include:
- OpenAPI documentation (WithSummary, WithDescription)
- Proper status code responses (Produces, ProducesProblem)
- Type-safe results using `TypedResults`
- MediatR integration for CQRS pattern

### 6. AppHost Configuration
Updated `AspireApp1.AppHost/AppHost.cs`:
- Added PostgreSQL container resource
- Added pgAdmin for database management
- Configured connection string named "postgresdb"
- API project references PostgreSQL resource
- Added wait dependencies for PostgreSQL startup

### 7. Program.cs Updates
- **API** (`AspireApp1.Api/Program.cs`): Registered Infrastructure services
- **AppHost**: Added PostgreSQL orchestration

### 8. Project References
- **Application** → Domain (for Product entity)
- **Infrastructure** → Application + Domain
- **API** → Application + Infrastructure

## Running the Application

### 1. Start the Application with Aspire
```bash
cd Orchestration/AspireApp1.AppHost
dotnet run
```

The Aspire dashboard will start and orchestrate:
- PostgreSQL container
- pgAdmin container (accessible via dashboard)
- API project
- Client project

### 2. Apply Database Migrations
The database will be created automatically when the API starts, but migrations need to be applied:

**Option A: Automatically on startup (recommended for development)**
Add this to `AspireApp1.Api/Program.cs` before `app.Run()`:

```csharp
// Apply migrations automatically in development
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await dbContext.Database.MigrateAsync();
}
```

**Option B: Manual migration**
```bash
dotnet ef database update --project Source/AspireApp1.Infrastructure/AspireApp1.Infrastructure.csproj --startup-project Source/AspireApp1.Api/AspireApp1.Api.csproj
```

### 3. Access the API
Once running, access the API documentation at:
- **Scalar UI**: `https://localhost:<port>/scalar/v1`
- **OpenAPI JSON**: `https://localhost:<port>/openapi/v1.json`

The Aspire dashboard will show the API port.

## Testing the Endpoints

### Create a Product
```bash
curl -X POST https://localhost:<port>/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "description": "A test product",
    "price": 29.99,
    "stock": 100
  }'
```

### Get All Products
```bash
curl https://localhost:<port>/api/products
```

### Get Product by ID
```bash
curl https://localhost:<port>/api/products/{id}
```

### Update Product
```bash
curl -X PUT https://localhost:<port>/api/products/{id} \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Product",
    "description": "Updated description",
    "price": 39.99,
    "stock": 150
  }'
```

### Delete Product
```bash
curl -X DELETE https://localhost:<port>/api/products/{id}
```

## Database Access

### Using pgAdmin
The Aspire dashboard provides a link to pgAdmin for visual database management.

### Connection String
When running in Aspire, the connection string is automatically configured.

For local development/testing outside Aspire:
```
Host=localhost;Port=5432;Database=postgresdb;Username=postgres;Password=<password>
```

## Creating Additional Migrations

When modifying the Product entity or adding new entities:

```bash
dotnet ef migrations add <MigrationName> \
  --project Source/AspireApp1.Infrastructure/AspireApp1.Infrastructure.csproj \
  --startup-project Source/AspireApp1.Api/AspireApp1.Api.csproj
```

## Architectural Notes

### Clean Architecture Layers
- **API Layer**: Minimal endpoints, no business logic
- **Application Layer**: CQRS commands/queries, validation, DTOs
- **Infrastructure Layer**: Database context, EF Core configuration
- **Domain Layer**: Pure entities, no dependencies

### Design Decisions
1. **Primary Constructors**: Used in all handlers for concise dependency injection
2. **IApplicationDbContext Interface**: Allows mocking for unit tests, maintains clean boundaries
3. **Static Mapping Extensions**: Keeps mapping logic testable and separate from entities
4. **Automatic Timestamps**: DbContext override handles CreatedAt/UpdatedAt automatically
5. **PostgreSQL Conventions**: Snake_case column names for PostgreSQL best practices
6. **Aspire Integration**: Uses `AddNpgsqlDbContext` for automatic connection string management

### Validation Rules
- **Name**: Required, max 200 characters
- **Description**: Optional, max 1000 characters
- **Price**: Must be > 0
- **Stock**: Must be >= 0

### Exception Handling
- `ProductNotFoundException`: Thrown when product is not found
- Caught at endpoint level, converted to 404 Not Found responses
- Validation errors returned as 400 Bad Request (handled by FluentValidation)

## Next Steps

Consider adding:
1. Pagination for GetAllProducts query
2. Search/filtering capabilities
3. Soft delete functionality
4. Product categories or tags
5. Inventory management features
6. Integration tests for the database layer
7. Automatic migration on startup (see Running section)

## Files Modified/Created

### New Files
- `AspireApp1.Domain/Entities/Product.cs`
- `AspireApp1.Infrastructure/Data/ApplicationDbContext.cs`
- `AspireApp1.Infrastructure/DependencyInjection.cs`
- `AspireApp1.Infrastructure/Migrations/*` (3 files)
- `AspireApp1.Application/Common/Interfaces/IApplicationDbContext.cs`
- `AspireApp1.Application/Products/` (entire feature folder structure - 15 files)
- `AspireApp1.Api/Endpoints/ProductEndpoints.cs`

### Modified Files
- `Directory.Packages.props` - Added EF Core and PostgreSQL packages
- `AspireApp1.Domain/AspireApp1.Domain.csproj` - Updated to net10.0
- `AspireApp1.Application/AspireApp1.Application.csproj` - Added Domain reference and EF Core
- `AspireApp1.Infrastructure/AspireApp1.Infrastructure.csproj` - Added packages and references
- `AspireApp1.Api/AspireApp1.Api.csproj` - Added Infrastructure reference and Design package
- `AspireApp1.AppHost/AppHost.cs` - Added PostgreSQL configuration
- `AspireApp1.AppHost/AspireApp1.AppHost.csproj` - Added PostgreSQL package
- `AspireApp1.Api/Program.cs` - Registered Infrastructure services

## Build Status
Build succeeded with all dependencies resolved correctly.
