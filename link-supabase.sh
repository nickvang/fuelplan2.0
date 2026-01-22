#!/bin/bash

# Script to link Supabase project
# Run this in your terminal: ./link-supabase.sh

export PATH="/opt/homebrew/bin:$PATH"

echo "🔐 Step 1: Logging into Supabase..."
echo "This will open a browser window for authentication."
supabase login

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Login successful!"
    echo ""
    echo "🔗 Step 2: Linking project..."
    supabase link --project-ref ldfpakkhikhaxssqehpu
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Project linked successfully!"
        echo ""
        echo "📋 Next steps:"
        echo "  1. Deploy database migrations: supabase db push"
        echo "  2. Deploy Edge Functions: supabase functions deploy"
        echo "  3. Set secrets: supabase secrets set GEMINI_API_KEY=your_key"
    else
        echo ""
        echo "❌ Failed to link project. Please check the error above."
    fi
else
    echo ""
    echo "❌ Login failed. Please try again."
fi
