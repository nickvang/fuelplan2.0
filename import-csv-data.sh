#!/bin/bash

# Import CSV data to Supabase
# This script imports the exported CSV files into the new Supabase project

set -e

export PATH="/opt/homebrew/bin:$PATH"

echo "📥 Importing CSV data to Supabase"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Project details
PROJECT_REF="ldfpakkhikhaxssqehpu"
DB_HOST="${PROJECT_REF}.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"

# Get service role key
echo -e "${YELLOW}⚠️  You'll need the Service Role Key from your Supabase project.${NC}"
echo "Get it from: Supabase Dashboard → Project Settings → API → service_role key"
echo ""
read -sp "Enter service role key: " SERVICE_KEY
echo ""

# Test connection
echo "Testing database connection..."
PGPASSWORD="${SERVICE_KEY}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1;" > /dev/null 2>&1 || {
    echo -e "${RED}❌ Cannot connect to database. Check your credentials.${NC}"
    exit 1
}
echo -e "${GREEN}✅ Connected to database${NC}"
echo ""

# CSV file paths
HYDRATION_CSV="/Users/nicklasvang/Downloads/hydration_profiles-export-2026-01-22_16-48-31.csv"
PROFILES_CSV="/Users/nicklasvang/Downloads/profiles-export-2026-01-22_16-48-50.csv"
USER_ROLES_CSV="/Users/nicklasvang/Downloads/user_roles-export-2026-01-22_16-49-45.csv"

# Check if files exist
for file in "$HYDRATION_CSV" "$PROFILES_CSV" "$USER_ROLES_CSV"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ File not found: $file${NC}"
        exit 1
    fi
done

# Count existing records
echo "📊 Current database state:"
HYDRATION_COUNT=$(PGPASSWORD="${SERVICE_KEY}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM public.hydration_profiles;" 2>/dev/null | xargs)
PROFILES_COUNT=$(PGPASSWORD="${SERVICE_KEY}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM public.profiles;" 2>/dev/null | xargs)
USER_ROLES_COUNT=$(PGPASSWORD="${SERVICE_KEY}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM public.user_roles;" 2>/dev/null | xargs)

echo "  hydration_profiles: ${HYDRATION_COUNT:-0} records"
echo "  profiles: ${PROFILES_COUNT:-0} records"
echo "  user_roles: ${USER_ROLES_COUNT:-0} records"
echo ""

# Count records in CSV files
HYDRATION_CSV_COUNT=$(tail -n +2 "$HYDRATION_CSV" | wc -l | xargs)
PROFILES_CSV_COUNT=$(tail -n +2 "$PROFILES_CSV" | wc -l | xargs)
USER_ROLES_CSV_COUNT=$(tail -n +2 "$USER_ROLES_CSV" | wc -l | xargs)

echo "📋 Records to import:"
echo "  hydration_profiles: ${HYDRATION_CSV_COUNT} records"
echo "  profiles: ${PROFILES_CSV_COUNT} records"
echo "  user_roles: ${USER_ROLES_CSV_COUNT} records"
echo ""

read -p "Do you want to proceed with import? (y/N): " CONFIRM
if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo "Import cancelled."
    exit 0
fi

echo ""
echo "🚀 Starting import..."
echo ""

# Import hydration_profiles
if [ "${HYDRATION_CSV_COUNT}" != "0" ]; then
    echo "Importing hydration_profiles..."
    # Use COPY with semicolon delimiter and proper encoding
    PGPASSWORD="${SERVICE_KEY}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" <<EOF
\copy public.hydration_profiles(id, created_at, profile_data, plan_data, consent_given, consent_timestamp, data_retention_expires_at, user_email, has_smartwatch_data, ip_address, user_agent, deletion_token) FROM '${HYDRATION_CSV}' WITH (FORMAT csv, DELIMITER ';', HEADER true, ENCODING 'UTF8')
EOF
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Imported hydration_profiles${NC}"
    else
        echo -e "${RED}❌ Failed to import hydration_profiles${NC}"
    fi
fi

# Import profiles (skip if empty)
if [ "${PROFILES_CSV_COUNT}" != "0" ]; then
    echo "Importing profiles..."
    PGPASSWORD="${SERVICE_KEY}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" <<EOF
\copy public.profiles(id, email, full_name, created_at, updated_at) FROM '${PROFILES_CSV}' WITH (FORMAT csv, DELIMITER ';', HEADER true, ENCODING 'UTF8')
EOF
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Imported profiles${NC}"
    else
        echo -e "${RED}❌ Failed to import profiles${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Skipping profiles (no data to import)${NC}"
fi

# Import user_roles (skip if empty)
if [ "${USER_ROLES_CSV_COUNT}" != "0" ]; then
    echo "Importing user_roles..."
    PGPASSWORD="${SERVICE_KEY}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" <<EOF
\copy public.user_roles(id, user_id, role, created_at) FROM '${USER_ROLES_CSV}' WITH (FORMAT csv, DELIMITER ';', HEADER true, ENCODING 'UTF8')
EOF
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Imported user_roles${NC}"
    else
        echo -e "${RED}❌ Failed to import user_roles${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Skipping user_roles (no data to import)${NC}"
fi

echo ""
echo "📊 Verifying import..."

# Count records after import
NEW_HYDRATION_COUNT=$(PGPASSWORD="${SERVICE_KEY}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM public.hydration_profiles;" 2>/dev/null | xargs)
NEW_PROFILES_COUNT=$(PGPASSWORD="${SERVICE_KEY}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM public.profiles;" 2>/dev/null | xargs)
NEW_USER_ROLES_COUNT=$(PGPASSWORD="${SERVICE_KEY}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM public.user_roles;" 2>/dev/null | xargs)

echo "New database counts:"
echo "  hydration_profiles: ${NEW_HYDRATION_COUNT:-0} records"
echo "  profiles: ${NEW_PROFILES_COUNT:-0} records"
echo "  user_roles: ${NEW_USER_ROLES_COUNT:-0} records"

echo ""
echo -e "${GREEN}✅ Import complete!${NC}"
