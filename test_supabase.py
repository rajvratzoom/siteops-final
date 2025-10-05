"""Quick test of Supabase connection."""

from src.supabase_client import get_supabase_client

print("Testing Supabase connection...")
client = get_supabase_client()

if client.enabled:
    print("\n✅ Supabase connected successfully!")
    print(f"   URL: {client.url}")
    
    # Test fetching site config
    import asyncio
    import os
    
    site_id = os.getenv("DEFAULT_SITE_ID")
    if site_id:
        print(f"\n🔍 Testing site config fetch for: {site_id}")
        site = asyncio.run(client.get_site_config(site_id))
        if site:
            print(f"✅ Site found: {site.get('name', 'Unknown')}")
        else:
            print("⚠️  Site not found - check DEFAULT_SITE_ID in .env")
    
    print("\n🎉 All systems ready! You can now run:")
    print("   python -m src.main --expected-people 2")
else:
    print("\n❌ Supabase not connected")
    print("   Check your .env file configuration")
