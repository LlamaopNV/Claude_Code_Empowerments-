#!/usr/bin/env python3
"""Bootstrap a new .NET Aspire project from the AspireApp1 template.

Handles all deterministic file operations: copy, rename, replace, configure.
Build, migrations, and error recovery are left to the calling skill.

Usage:
    python bootstrap.py --name BlogEngine --db sqlserver --template ./AspireApp1 --output /repo/root
"""

import argparse
import json
import shutil
import sys
from pathlib import Path

# ── Constants ──────────────────────────────────────────────────────────────

TEMPLATE_NAME = "AspireApp1"
TEMPLATE_NAME_LOWER = "aspireapp1"

CONTENT_EXTENSIONS = frozenset({
    ".cs", ".csproj", ".slnx", ".json", ".props",
    ".ps1", ".http", ".md", ".ts", ".tsx", ".js", ".esproj",
})

COPY_EXCLUDE_DIRS = frozenset({
    "bin", "obj", "node_modules", ".vs", ".next",
    "agent-memory-local", "Migrations",
})

CONTENT_EXCLUDE_DIRS = frozenset({
    "bin", "obj", "node_modules", ".vs", ".next",
    ".claude", "agent-memory-local", "Migrations",
})

DB_CHOICES = ["postgresql", "sqlserver", "mysql", "sqlite"]


# ── Utility functions ──────────────────────────────────────────────────────

def replace_in_file(path, old, new):
    """Replace all occurrences of old with new in file. Returns count."""
    text = path.read_text(encoding="utf-8-sig")
    count = text.count(old)
    if count > 0:
        path.write_text(text.replace(old, new), encoding="utf-8")
    return count


def remove_lines_containing(path, substring):
    """Remove all lines containing substring. Returns count removed."""
    text = path.read_text(encoding="utf-8-sig")
    lines = text.splitlines(keepends=True)
    filtered = [l for l in lines if substring not in l]
    removed = len(lines) - len(filtered)
    if removed > 0:
        path.write_text("".join(filtered), encoding="utf-8")
    return removed


# ── Step 1: Copy template ─────────────────────────────────────────────────

def copy_template(template_dir, output_dir):
    if output_dir.exists():
        print(f"  ERROR: Output directory already exists: {output_dir}", file=sys.stderr)
        sys.exit(1)

    def ignore(directory, contents):
        return {c for c in contents if c in COPY_EXCLUDE_DIRS}

    shutil.copytree(template_dir, output_dir, ignore=ignore)
    print(f"  Copied template to {output_dir}")


# ── Step 2: Rename directories ─────────────────────────────────────────────

def rename_directories(project_dir, name, name_lower):
    mappings = [
        ("Orchestration", f"{TEMPLATE_NAME}.AppHost", f"{name}.AppHost"),
        ("Orchestration", f"{TEMPLATE_NAME}.ServiceDefaults", f"{name}.ServiceDefaults"),
        ("Source", f"{TEMPLATE_NAME}.Api", f"{name}.Api"),
        ("Source", f"{TEMPLATE_NAME}.Application", f"{name}.Application"),
        ("Source", f"{TEMPLATE_NAME}.Domain", f"{name}.Domain"),
        ("Source", f"{TEMPLATE_NAME}.Infrastructure", f"{name}.Infrastructure"),
        ("Source", f"{TEMPLATE_NAME}.DbMigrator", f"{name}.DbMigrator"),
        ("Source", f"{TEMPLATE_NAME_LOWER}-client", f"{name_lower}-client"),
        ("Tests", f"{TEMPLATE_NAME}.Application.Tests", f"{name}.Application.Tests"),
    ]
    for parent, old_name, new_name in mappings:
        old_path = project_dir / parent / old_name
        if old_path.exists():
            old_path.rename(project_dir / parent / new_name)
            print(f"  {parent}/{old_name} -> {new_name}")


# ── Step 3: Rename files ──────────────────────────────────────────────────

def rename_files(project_dir, name, name_lower):
    # PascalCase (e.g., AspireApp1.Api.csproj)
    for path in sorted(project_dir.rglob(f"*{TEMPLATE_NAME}*")):
        if path.is_file():
            new_name = path.name.replace(TEMPLATE_NAME, name)
            if new_name != path.name:
                path.rename(path.parent / new_name)
                print(f"  {path.name} -> {new_name}")

    # lowercase (e.g., aspireapp1-client.esproj)
    for path in sorted(project_dir.rglob(f"*{TEMPLATE_NAME_LOWER}*")):
        if path.is_file():
            new_name = path.name.replace(TEMPLATE_NAME_LOWER, name_lower)
            if new_name != path.name:
                path.rename(path.parent / new_name)
                print(f"  {path.name} -> {new_name}")


# ── Step 4: Replace file contents ─────────────────────────────────────────

def replace_contents(project_dir, name, name_lower):
    files_updated = 0
    for path in project_dir.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in CONTENT_EXTENSIONS:
            continue
        if any(part in CONTENT_EXCLUDE_DIRS for part in path.parts):
            continue
        try:
            text = path.read_text(encoding="utf-8-sig")
        except (UnicodeDecodeError, PermissionError):
            continue

        original = text
        text = text.replace(TEMPLATE_NAME, name)
        text = text.replace(TEMPLATE_NAME_LOWER, name_lower)
        if text != original:
            path.write_text(text, encoding="utf-8")
            files_updated += 1

    print(f"  Updated content in {files_updated} files")


def verify_clean(project_dir):
    """Returns list of files still containing template references."""
    problems = []
    for path in project_dir.rglob("*"):
        if not path.is_file():
            continue
        if any(part in CONTENT_EXCLUDE_DIRS for part in path.parts):
            continue
        if TEMPLATE_NAME in path.name or TEMPLATE_NAME_LOWER in path.name:
            problems.append(f"filename: {path}")
            continue
        if path.suffix.lower() in CONTENT_EXTENSIONS:
            try:
                text = path.read_text(encoding="utf-8-sig")
                if TEMPLATE_NAME in text or TEMPLATE_NAME_LOWER in text:
                    problems.append(f"content: {path}")
            except (UnicodeDecodeError, PermissionError):
                pass
    return problems


# ── Step 5: Database configuration ─────────────────────────────────────────

def configure_postgresql(project_dir, name):
    print("  PostgreSQL is the template default — no changes needed")


def configure_sqlserver(project_dir, name):
    # Directory.Packages.props
    props = project_dir / "Directory.Packages.props"
    replace_in_file(props, "Aspire.Hosting.PostgreSQL", "Aspire.Hosting.SqlServer")
    replace_in_file(props, "Aspire.Npgsql.EntityFrameworkCore.PostgreSQL",
                          "Aspire.Microsoft.EntityFrameworkCore.SqlServer")
    replace_in_file(props, 'Npgsql.EntityFrameworkCore.PostgreSQL" Version="10.0.0"',
                          'Microsoft.EntityFrameworkCore.SqlServer" Version="10.0.1"')

    # Infrastructure.csproj
    infra = project_dir / "Source" / f"{name}.Infrastructure" / f"{name}.Infrastructure.csproj"
    replace_in_file(infra, "Aspire.Npgsql.EntityFrameworkCore.PostgreSQL",
                          "Aspire.Microsoft.EntityFrameworkCore.SqlServer")
    replace_in_file(infra, "Npgsql.EntityFrameworkCore.PostgreSQL",
                          "Microsoft.EntityFrameworkCore.SqlServer")

    # AppHost.csproj
    apphost_csproj = project_dir / "Orchestration" / f"{name}.AppHost" / f"{name}.AppHost.csproj"
    replace_in_file(apphost_csproj, "Aspire.Hosting.PostgreSQL", "Aspire.Hosting.SqlServer")

    # DbMigrator.csproj
    migrator_csproj = project_dir / "Source" / f"{name}.DbMigrator" / f"{name}.DbMigrator.csproj"
    replace_in_file(migrator_csproj, "Aspire.Npgsql.EntityFrameworkCore.PostgreSQL",
                                    "Aspire.Microsoft.EntityFrameworkCore.SqlServer")

    # AppHost.cs
    apphost = project_dir / "Orchestration" / f"{name}.AppHost" / "AppHost.cs"
    replace_in_file(apphost, 'AddPostgres("postgres")', 'AddSqlServer("sqlserver")')
    replace_in_file(apphost, '"postgresdb"', '"sqlserverdb"')
    replace_in_file(apphost, "var postgres", "var sqlserver")
    replace_in_file(apphost, "(postgres)", "(sqlserver)")

    # DependencyInjection.cs
    di = project_dir / "Source" / f"{name}.Infrastructure" / "DependencyInjection.cs"
    replace_in_file(di, "AddNpgsqlDbContext", "AddSqlServerDbContext")
    replace_in_file(di, '"postgresdb"', '"sqlserverdb"')
    replace_in_file(di, "// Register PostgreSQL", "// Register SQL Server")

    # DbMigrator/Program.cs
    migrator = project_dir / "Source" / f"{name}.DbMigrator" / "Program.cs"
    replace_in_file(migrator, "AddNpgsqlDbContext", "AddSqlServerDbContext")
    replace_in_file(migrator, '"postgresdb"', '"sqlserverdb"')
    replace_in_file(migrator, "// Add PostgreSQL", "// Add SQL Server")

    print("  Configured for SQL Server")


def configure_mysql(project_dir, name):
    """Configure for MySQL using Oracle's MySql.EntityFrameworkCore (not Pomelo).

    Oracle's provider is EF Core 10 compatible. Pomelo 9.0 is not.
    Since there's no Aspire EF Core integration for Oracle's provider,
    we use manual DbContext registration with Aspire connection strings.
    """
    name_lower = name.lower()

    # Directory.Packages.props
    props = project_dir / "Directory.Packages.props"
    replace_in_file(props, "Aspire.Hosting.PostgreSQL", "Aspire.Hosting.MySql")
    # Remove the Aspire EF integration (no Oracle equivalent exists)
    remove_lines_containing(props, "Aspire.Npgsql.EntityFrameworkCore.PostgreSQL")
    # Replace Npgsql provider with Oracle's MySQL provider
    replace_in_file(props, 'Npgsql.EntityFrameworkCore.PostgreSQL" Version="10.0.0"',
                          'MySql.EntityFrameworkCore" Version="10.0.1"')

    # Infrastructure.csproj — use Oracle's provider, no Aspire integration
    infra = project_dir / "Source" / f"{name}.Infrastructure" / f"{name}.Infrastructure.csproj"
    remove_lines_containing(infra, "Aspire.Npgsql.EntityFrameworkCore.PostgreSQL")
    replace_in_file(infra, "Npgsql.EntityFrameworkCore.PostgreSQL",
                          "MySql.EntityFrameworkCore")

    # AppHost.csproj — hosting package is fine
    apphost_csproj = project_dir / "Orchestration" / f"{name}.AppHost" / f"{name}.AppHost.csproj"
    replace_in_file(apphost_csproj, "Aspire.Hosting.PostgreSQL", "Aspire.Hosting.MySql")

    # DbMigrator.csproj — use Oracle's provider, no Aspire integration
    migrator_csproj = project_dir / "Source" / f"{name}.DbMigrator" / f"{name}.DbMigrator.csproj"
    replace_in_file(migrator_csproj, "Aspire.Npgsql.EntityFrameworkCore.PostgreSQL",
                                    "MySql.EntityFrameworkCore")

    # AppHost.cs — same Aspire hosting changes
    apphost = project_dir / "Orchestration" / f"{name}.AppHost" / "AppHost.cs"
    replace_in_file(apphost, 'AddPostgres("postgres")', 'AddMySql("mysql")')
    replace_in_file(apphost, '"postgresdb"', '"mysqldb"')
    replace_in_file(apphost, "var postgres", "var mysql")
    replace_in_file(apphost, "(postgres)", "(mysql)")

    # DependencyInjection.cs — full rewrite for manual registration with UseMySQL()
    di = project_dir / "Source" / f"{name}.Infrastructure" / "DependencyInjection.cs"
    di.write_text(
        f"using {name}.Application.Common.Interfaces;\n"
        f"using {name}.Infrastructure.Data;\n"
        "using Microsoft.EntityFrameworkCore;\n"
        "using Microsoft.Extensions.Configuration;\n"
        "using Microsoft.Extensions.DependencyInjection;\n"
        "\n"
        f"namespace {name}.Infrastructure;\n"
        "\n"
        "public static class DependencyInjection\n"
        "{\n"
        "    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)\n"
        "    {\n"
        '        var connectionString = configuration.GetConnectionString("mysqldb");\n'
        "        services.AddDbContext<ApplicationDbContext>(options =>\n"
        "            options.UseMySQL(connectionString!));\n"
        "\n"
        "        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<ApplicationDbContext>());\n"
        "        return services;\n"
        "    }\n"
        "}\n",
        encoding="utf-8")

    # DbMigrator/Program.cs — replace Aspire registration with manual UseMySQL()
    migrator = project_dir / "Source" / f"{name}.DbMigrator" / "Program.cs"
    replace_in_file(migrator,
        '// Add PostgreSQL DbContext with Aspire integration\n'
        f'builder.AddNpgsqlDbContext<ApplicationDbContext>("postgresdb");',
        '// Add MySQL DbContext - read connection string from Aspire service discovery\n'
        'var connectionString = builder.Configuration.GetConnectionString("mysqldb");\n'
        'builder.Services.AddDbContext<ApplicationDbContext>(options =>\n'
        '    options.UseMySQL(connectionString!));')
    # Add missing using for GetConnectionString
    migrator_text = migrator.read_text(encoding="utf-8-sig")
    if "using Microsoft.Extensions.Configuration;" not in migrator_text:
        migrator_text = migrator_text.replace(
            "using Microsoft.Extensions.DependencyInjection;",
            "using Microsoft.Extensions.Configuration;\nusing Microsoft.Extensions.DependencyInjection;")
        migrator.write_text(migrator_text, encoding="utf-8")

    # Api/Program.cs — change AddInfrastructure(builder) to AddInfrastructure(builder.Configuration)
    api_program = project_dir / "Source" / f"{name}.Api" / "Program.cs"
    replace_in_file(api_program, "AddInfrastructure(builder)", "AddInfrastructure(builder.Configuration)")

    print("  Configured for MySQL (Oracle MySql.EntityFrameworkCore)")


def configure_sqlite(project_dir, name):
    name_lower = name.lower()

    # Directory.Packages.props — remove Aspire DB packages, add SQLite
    props = project_dir / "Directory.Packages.props"
    remove_lines_containing(props, "Aspire.Hosting.PostgreSQL")
    remove_lines_containing(props, "Aspire.Npgsql.EntityFrameworkCore.PostgreSQL")
    replace_in_file(props, "Npgsql.EntityFrameworkCore.PostgreSQL",
                          "Microsoft.EntityFrameworkCore.Sqlite")

    # Infrastructure.csproj
    infra = project_dir / "Source" / f"{name}.Infrastructure" / f"{name}.Infrastructure.csproj"
    remove_lines_containing(infra, "Aspire.Npgsql.EntityFrameworkCore.PostgreSQL")
    replace_in_file(infra, "Npgsql.EntityFrameworkCore.PostgreSQL",
                          "Microsoft.EntityFrameworkCore.Sqlite")

    # AppHost.csproj — remove postgres hosting package
    apphost_csproj = project_dir / "Orchestration" / f"{name}.AppHost" / f"{name}.AppHost.csproj"
    remove_lines_containing(apphost_csproj, "Aspire.Hosting.PostgreSQL")

    # DbMigrator.csproj
    migrator_csproj = project_dir / "Source" / f"{name}.DbMigrator" / f"{name}.DbMigrator.csproj"
    remove_lines_containing(migrator_csproj, "Aspire.Npgsql.EntityFrameworkCore.PostgreSQL")

    # AppHost.cs — remove postgres resource, fix method chains
    apphost = project_dir / "Orchestration" / f"{name}.AppHost" / "AppHost.cs"
    text = apphost.read_text(encoding="utf-8-sig")

    # Remove postgres declaration + .AddDatabase
    text = text.replace(
        'var postgres = builder.AddPostgres("postgres")\n    .AddDatabase("postgresdb");\n\n', '')

    # Fix migrator chain: remove postgres refs
    text = text.replace(
        f'.AddProject<Projects.{name}_DbMigrator>("dbmigrator")\n'
        '    .WithReference(postgres)\n'
        '    .WaitFor(postgres);',
        f'.AddProject<Projects.{name}_DbMigrator>("dbmigrator");')

    # Fix server chain: remove .WithReference(postgres) line
    text = text.replace('    .WithReference(postgres)\n', '')

    apphost.write_text(text, encoding="utf-8")

    # DependencyInjection.cs — full rewrite for SQLite
    di = project_dir / "Source" / f"{name}.Infrastructure" / "DependencyInjection.cs"
    di.write_text(
        f"using {name}.Application.Common.Interfaces;\n"
        f"using {name}.Infrastructure.Data;\n"
        "using Microsoft.EntityFrameworkCore;\n"
        "using Microsoft.Extensions.Configuration;\n"
        "using Microsoft.Extensions.DependencyInjection;\n"
        "\n"
        f"namespace {name}.Infrastructure;\n"
        "\n"
        "public static class DependencyInjection\n"
        "{\n"
        "    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)\n"
        "    {\n"
        "        // Register SQLite database context - use solution root for shared database\n"
        '        var solutionRoot = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..");\n'
        f'        var dbPath = Path.GetFullPath(Path.Combine(solutionRoot, "{name_lower}.db"));\n'
        "        services.AddDbContext<ApplicationDbContext>(options =>\n"
        '            options.UseSqlite($"Data Source={dbPath}"));\n'
        "\n"
        "        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<ApplicationDbContext>());\n"
        "        return services;\n"
        "    }\n"
        "}\n",
        encoding="utf-8")

    # DbMigrator/Program.cs — replace Aspire registration with SQLite
    migrator = project_dir / "Source" / f"{name}.DbMigrator" / "Program.cs"
    replace_in_file(migrator,
        '// Add PostgreSQL DbContext with Aspire integration\n'
        f'builder.AddNpgsqlDbContext<ApplicationDbContext>("postgresdb");',
        '// Add SQLite DbContext - use solution root for shared database\n'
        'var solutionRoot = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..");\n'
        f'var dbPath = Path.GetFullPath(Path.Combine(solutionRoot, "{name_lower}.db"));\n'
        'builder.Services.AddDbContext<ApplicationDbContext>(options =>\n'
        f'    options.UseSqlite($"Data Source={{dbPath}}"));')

    # Api/Program.cs — change AddInfrastructure(builder) to AddInfrastructure(builder.Configuration)
    api_program = project_dir / "Source" / f"{name}.Api" / "Program.cs"
    replace_in_file(api_program, "AddInfrastructure(builder)", "AddInfrastructure(builder.Configuration)")

    print("  Configured for SQLite")


# ── Step 6: Create ApplicationDbContextFactory.cs ──────────────────────────

def create_context_factory(project_dir, name, db_type):
    name_lower = name.lower()
    factory_dir = project_dir / "Source" / f"{name}.Infrastructure" / "Data"
    factory_dir.mkdir(parents=True, exist_ok=True)
    factory_path = factory_dir / "ApplicationDbContextFactory.cs"

    if db_type == "postgresql":
        db_line = (
            '        optionsBuilder.UseNpgsql('
            f'"Host=localhost;Database={name_lower};Username=postgres;Password=postgres");'
        )
    elif db_type == "sqlserver":
        db_line = (
            '        optionsBuilder.UseSqlServer('
            f'"Server=localhost;Database={name};Integrated Security=true;TrustServerCertificate=true;");'
        )
    elif db_type == "mysql":
        db_line = (
            '        optionsBuilder.UseMySQL('
            f'"Server=localhost;Database={name_lower};User=root;Password=root;");'
        )
    elif db_type == "sqlite":
        db_line = (
            f'        var dbPath = Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "{name_lower}.db");\n'
            '        optionsBuilder.UseSqlite($"Data Source={dbPath}");'
        )

    factory_path.write_text(
        "using Microsoft.EntityFrameworkCore;\n"
        "using Microsoft.EntityFrameworkCore.Design;\n"
        "\n"
        f"namespace {name}.Infrastructure.Data;\n"
        "\n"
        "public class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>\n"
        "{\n"
        "    public ApplicationDbContext CreateDbContext(string[] args)\n"
        "    {\n"
        "        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();\n"
        f"{db_line}\n"
        "        return new ApplicationDbContext(optionsBuilder.Options);\n"
        "    }\n"
        "}\n",
        encoding="utf-8")

    print(f"  Created ApplicationDbContextFactory.cs ({db_type})")


# ── Step 7: Update .aspire/settings.json ───────────────────────────────────

def update_aspire_settings(repo_root, project_name):
    settings_path = repo_root / ".aspire" / "settings.json"
    if not settings_path.exists():
        print("  No .aspire/settings.json found — skipping")
        return

    data = json.loads(settings_path.read_text(encoding="utf-8"))
    data["appHostPath"] = (
        f"../{project_name}/Orchestration/{project_name}.AppHost/{project_name}.AppHost.csproj"
    )
    settings_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"  Updated appHostPath -> {data['appHostPath']}")


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Bootstrap a new .NET Aspire project from the AspireApp1 template")
    parser.add_argument("--name", required=True, help="Project name (PascalCase)")
    parser.add_argument("--db", required=True, choices=DB_CHOICES, help="Database type")
    parser.add_argument("--template", required=True, help="Path to AspireApp1 template folder")
    parser.add_argument("--output", required=True, help="Repo root (project created as subdirectory)")
    args = parser.parse_args()

    name = args.name
    name_lower = name.lower()
    db_type = args.db.lower()
    template_dir = Path(args.template).resolve()
    repo_root = Path(args.output).resolve()
    project_dir = repo_root / name

    # Validate
    if not template_dir.is_dir():
        print(f"ERROR: Template directory not found: {template_dir}", file=sys.stderr)
        return 1
    if not name.isidentifier():
        print(f"ERROR: '{name}' is not a valid C# identifier", file=sys.stderr)
        return 1

    print(f"Creating '{name}' with {db_type} at {project_dir}\n")

    print("[1/7] Copying template...")
    copy_template(template_dir, project_dir)

    print("\n[2/7] Renaming directories...")
    rename_directories(project_dir, name, name_lower)

    print("\n[3/7] Renaming files...")
    rename_files(project_dir, name, name_lower)

    print("\n[4/7] Replacing file contents...")
    replace_contents(project_dir, name, name_lower)
    problems = verify_clean(project_dir)
    if problems:
        print("\n  WARNING — remaining template references:")
        for p in problems:
            print(f"    {p}")
    else:
        print("  Verified: no remaining template references")

    print(f"\n[5/7] Configuring {db_type} database...")
    configurators = {
        "postgresql": configure_postgresql,
        "sqlserver": configure_sqlserver,
        "mysql": configure_mysql,
        "sqlite": configure_sqlite,
    }
    configurators[db_type](project_dir, name)

    print("\n[6/7] Creating ApplicationDbContextFactory.cs...")
    create_context_factory(project_dir, name, db_type)

    print("\n[7/7] Updating Aspire settings...")
    update_aspire_settings(repo_root, name)

    print(f"\n{'=' * 60}")
    print(f"Bootstrap complete: {project_dir}")
    print("Next steps (handled by skill):")
    print("  1. dotnet restore && dotnet build")
    print("  2. dotnet ef migrations add InitialCreate")
    print(f"{'=' * 60}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
