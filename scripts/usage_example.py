#!/usr/bin/env python3
"""
Usage example for sync_tickets.py

This script demonstrates how to use the ticket sync functionality
and includes pre-flight checks for the API.
"""

import subprocess
import sys
from pathlib import Path

import requests

API_BASE_URL = "http://localhost:8000"
SCRAPED_DATA_FILE = "scrape/texas811-all-tickets-2025-09-03.json"


def check_api_status():
    """Check if the backend API is running."""
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            print("✅ Backend API is running")
            return True
        else:
            print(f"❌ API returned status {response.status_code}")
            return False
    except requests.ConnectionError:
        print("❌ Cannot connect to backend API")
        print(f"   Make sure the backend is running on {API_BASE_URL}")
        print("   Try: uvicorn src.texas811_poc.main:app --reload --port 8000")
        return False
    except requests.RequestException as e:
        print(f"❌ API request failed: {e}")
        return False


def check_data_file():
    """Check if the scraped data file exists."""
    path = Path(SCRAPED_DATA_FILE)
    if path.exists():
        print(f"✅ Data file found: {SCRAPED_DATA_FILE}")
        return True
    else:
        print(f"❌ Data file not found: {SCRAPED_DATA_FILE}")
        print("   Make sure you're running from the project root directory")
        return False


def run_sync():
    """Run the sync script."""
    try:
        print("\n🚀 Starting ticket sync...")
        result = subprocess.run(
            [sys.executable, "scripts/sync_tickets.py"], capture_output=False
        )

        if result.returncode == 0:
            print("\n✅ Sync completed successfully")
        else:
            print(f"\n❌ Sync failed with exit code {result.returncode}")

        return result.returncode == 0

    except Exception as e:
        print(f"\n❌ Failed to run sync script: {e}")
        return False


def main():
    """Main workflow with pre-flight checks."""
    print("Texas811 Ticket Sync - Usage Example")
    print("=" * 50)

    print("\n1. Pre-flight checks...")

    # Check API status
    if not check_api_status():
        print("\n💡 Start the backend API first:")
        print("   uvicorn src.texas811_poc.main:app --reload --port 8000")
        sys.exit(1)

    # Check data file
    if not check_data_file():
        sys.exit(1)

    print("\n2. Running sync script...")
    if run_sync():
        print("\n🎉 All done! Check the API or dashboard for synced tickets.")
    else:
        print("\n❌ Sync failed. Check the output above for details.")
        sys.exit(1)


if __name__ == "__main__":
    main()
