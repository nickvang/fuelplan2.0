#!/bin/bash

# Data Migration Script
# This script migrates data from old Supabase project to new one
# 
# Prerequisites:
# 1. You need access to both old and new Supabase projects
# 2. You need the service role keys for both projects
# 3. Install psql (PostgreSQL client) if not already installed

set -e

echo "🔄 Supabase Data Migration Script"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Old project details
OLD_PROJECT_REF="bepotbhwdxlznkohaevv"
OLD_PROJECT_URL="https://${OLD_PROJECT_REF}.supabase.co"

# New project details  
NEW_PROJECT_REF="ldfpakkhikhaxssqehpu"
NEW_PROJECT_URL="https://${NEW_PROJECT_REF}.supabase.co"

echo "📋 Migration Plan:"
echo "  From: ${OLD_PROJECT_REF}"
echo "  To:   ${NEW_PROJECT_REF}"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  psql not found. Installing via Homebrew...${NC}"
    brew install postgresql@15 || {
        echo -e "${RED}❌ Failed to install psql. Please install PostgreSQL manually.${NC}"
        exit 1
    }
    export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
fi

# Prompt for service role keys
echo -e "${YELLOW}⚠️  You'll need the Service Role Key from both projects.${NC}"
echo "Get them from: Supabase Dashboard → Project Settings → API → service_role key"
echo ""
read -p "Enter OLD project service role key: " OLD_SERVICE_KEY
read -p "Enter NEW project service role key: " NEW_SERVICE_KEY

# Extract database connection details
OLD_DB_URL="${OLD_PROJECT_URL#https://}"
OLD_DB_URL="${OLD_DB_URL%.supabase.co}"
OLD_DB_HOST="${OLD_DB_URL}.supabase.co"
OLD_DB_PORT="5432"

NEW_DB_URL="${NEW_PROJECT_URL#https://}"
NEW_DB_URL="${NEW_DB_URL%.supabase.co}"
NEW_DB_HOST="${NEW_DB_URL}.supabase.co"
NEW_DB_PORT="5432"

# Database name is typically 'postgres'
DB_NAME="postgres"

echo ""
echo "🔍 Checking connections..."

# Test old database connection
echo "Testing connection to old database..."
PGPASSWORD="${OLD_SERVICE_KEY}" psql -h "${OLD_DB_HOST}" -p "${OLD_DB_PORT}" -U postgres -d "${DB_NAME}" -c "SELECT 1;" > /dev/null 2>&1 || {
    echo -e "${RED}❌ Cannot connect to old database. Check your credentials.${NC}"
    exit 1
}
echo -e "${GREEN}✅ Connected to old database${NC}"

# Test new database connection
echo "Testing connection to new database..."
PGPASSWORD="${NEW_SERVICE_KEY}" psql -h "${NEW_DB_HOST}" -p "${NEW_DB_PORT}" -U postgres -d "${DB_NAME}" -c "SELECT 1;" > /dev/null 2>&1 || {
    echo -e "${RED}❌ Cannot connect to new database. Check your credentials.${NC}"
    exit 1
}
echo -e "${GREEN}✅ Connected to new database${NC}"

echo ""
echo "📊 Checking data in old database..."

# Count records in old database
OLD_HYDRATION_COUNT=$(PGPASSWORD="${OLD_SERVICE_KEY}" psql -h "${OLD_DB_HOST}" -p "${OLD_DB_PORT}" -U postgres -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM public.hydration_profiles;" 2>/dev/null | xargs)
OLD_PROFILES_COUNT=$(PGPASSWORD="${OLD_SERVICE_KEY}" psql -h "${OLD_DB_HOST}" -p "${OLD_DB_PORT}" -U postgres -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM public.profiles;" 2>/dev/null | xargs)
OLD_USER_ROLES_COUNT=$(PGPASSWORD="${OLD_SERVICE_KEY}" psql -h "${OLD_DB_HOST}" -p "${OLD_DB_PORT}" -U postgres -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM public.user_roles;" 2>/dev/null | xargs)

echo "  hydration_profiles: ${OLD_HYDRATION_COUNT:-0} records"
echo "  profiles: ${OLD_PROFILES_COUNT:-0} records"
echo "  user_roles: ${OLD_USER_ROLES_COUNT:-0} records"

if [ "${OLD_HYDRATION_COUNT:-0}" = "0" ] && [ "${OLD_PROFILES_COUNT:-0}" = "0" ] && [ "${OLD_USER_ROLES_COUNT:-0}" = "0" ]; then
    echo -e "${YELLOW}⚠️  No data found in old database. Nothing to migrate.${NC}"
    exit 0
fi

echo ""
read -p "Do you want to proceed with migration? (y/N): " CONFIRM
if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo "🚀 Starting migration..."

# Create temporary directory for data export
TEMP_DIR=$(mktemp -d)
trap "rm -rf ${TEMP_DIR}" EXIT

# Export hydration_profiles
if [ "${OLD_HYDRATION_COUNT:-0}" != "0" ]; then
    echo "Exporting hydration_profiles..."
    PGPASSWORD="${OLD_SERVICE_KEY}" psql -h "${OLD_DB_HOST}" -p "${OLD_DB_PORT}" -U postgres -d "${DB_NAME}" \
        -c "\COPY (SELECT * FROM public.hydration_profiles) TO '${TEMP_DIR}/hydration_profiles.csv' WITH CSV HEADER;" || {
        echo -e "${YELLOW}⚠️  Could not export hydration_profiles (table might not exist)${NC}"
    }
    
    if [ -f "${TEMP_DIR}/hydration_profiles.csv" ]; then
        echo "Importing hydration_profiles..."
        PGPASSWORD="${NEW_SERVICE_KEY}" psql -h "${NEW_DB_HOST}" -p "${NEW_DB_PORT}" -U postgres -d "${DB_NAME}" \
            -c "\COPY public.hydration_profiles FROM '${TEMP_DIR}/hydration_profiles.csv' WITH CSV HEADER;" && \
            echo -e "${GREEN}✅ Migrated hydration_profiles${NC}" || \
            echo -e "${RED}❌ Failed to import hydration_profiles${NC}"
    fi
fi

# Export profiles
if [ "${OLD_PROFILES_COUNT:-0}" != "0" ]; then
    echo "Exporting profiles..."
    PGPASSWORD="${OLD_SERVICE_KEY}" psql -h "${OLD_DB_HOST}" -p "${OLD_DB_PORT}" -U postgres -d "${DB_NAME}" \
        -c "\COPY (SELECT * FROM public.profiles) TO '${TEMP_DIR}/profiles.csv' WITH CSV HEADER;" || {
        echo -e "${YELLOW}⚠️  Could not export profiles (table might not exist)${NC}"
    }
    
    if [ -f "${TEMP_DIR}/profiles.csv" ]; then
        echo "Importing profiles..."
        PGPASSWORD="${NEW_SERVICE_KEY}" psql -h "${NEW_DB_HOST}" -p "${NEW_DB_PORT}" -U postgres -d "${DB_NAME}" \
            -c "\COPY public.profiles FROM '${TEMP_DIR}/profiles.csv' WITH CSV HEADER;" && \
            echo -e "${GREEN}✅ Migrated profiles${NC}" || \
            echo -e "${RED}❌ Failed to import profiles${NC}"
    fi
fi

# Export user_roles
if [ "${OLD_USER_ROLES_COUNT:-0}" != "0" ]; then
    echo "Exporting user_roles..."
    PGPASSWORD="${OLD_SERVICE_KEY}" psql -h "${OLD_DB_HOST}" -p "${OLD_DB_PORT}" -U postgres -d "${DB_NAME}" \
        -c "\COPY (SELECT * FROM public.user_roles) TO '${TEMP_DIR}/user_roles.csv' WITH CSV HEADER;" || {
        echo -e "${YELLOW}⚠️  Could not export user_roles (table might not exist)${NC}"
    }
    
    if [ -f "${TEMP_DIR}/user_roles.csv" ]; then
        echo "Importing user_roles..."
        PGPASSWORD="${NEW_SERVICE_KEY}" psql -h "${NEW_DB_HOST}" -p "${NEW_DB_PORT}" -U postgres -d "${DB_NAME}" \
            -c "\COPY public.user_roles FROM '${TEMP_DIR}/user_roles.csv' WITH CSV HEADER;" && \
            echo -e "${GREEN}✅ Migrated user_roles${NC}" || \
            echo -e "${RED}❌ Failed to import user_roles${NC}"
    fi
fi

echo ""
echo "📊 Verifying migration..."

# Count records in new database
NEW_HYDRATION_COUNT=$(PGPASSWORD="${NEW_SERVICE_KEY}" psql -h "${NEW_DB_HOST}" -p "${NEW_DB_PORT}" -U postgres -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM public.hydration_profiles;" 2>/dev/null | xargs)
NEW_PROFILES_COUNT=$(PGPASSWORD="${NEW_SERVICE_KEY}" psql -h "${NEW_DB_HOST}" -p "${NEW_DB_PORT}" -U postgres -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM public.profiles;" 2>/dev/null | xargs)
NEW_USER_ROLES_COUNT=$(PGPASSWORD="${NEW_SERVICE_KEY}" psql -h "${NEW_DB_HOST}" -p "${NEW_DB_PORT}" -U postgres -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM public.user_roles;" 2>/dev/null | xargs)

echo "New database counts:"
echo "  hydration_profiles: ${NEW_HYDRATION_COUNT:-0} records"
echo "  profiles: ${NEW_PROFILES_COUNT:-0} records"
echo "  user_roles: ${NEW_USER_ROLES_COUNT:-0} records"

echo ""
echo -e "${GREEN}✅ Migration complete!${NC}"
echo ""
echo "⚠️  Note: Auth users (auth.users) are NOT migrated by this script."
echo "   If you have user accounts, you'll need to migrate them separately"
echo "   or have users re-register."
