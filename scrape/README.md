# Texas 811 Production Scraper

A robust, production-ready web scraper for extracting ticket data and utility member responses from the Texas 811 system.

## Features

- **Advanced Print Dialog Suppression**: Sophisticated browser automation with hardened print dialog interception
- **Comprehensive Data Extraction**: Complete ticket information including utility member responses
- **Critical Clear/Not Clear Detection**: Accurately captures response status for each utility member
- **Multi-Method Response Extraction**: Uses multiple fallback strategies for robust data capture
- **Fast Processing**: 500ms rate limiting for efficient scraping
- **Robust Error Handling**: Automatic retries and fallback mechanisms
- **Progress Tracking**: Real-time progress saving and session management

## Requirements

- Node.js (v16 or higher)
- npm or yarn
- Playwright browser automation library

## Installation

1. Clone or download the scraper files
2. Install dependencies:
```bash
npm install playwright
```

3. Install browser dependencies:
```bash
npx playwright install
```

## Configuration

The scraper is configured via the `CONFIG` object in `texas811-production-scraper-hybrid-fixed.js`:

```javascript
const CONFIG = {
  credentials: {
    username: 'your-username@domain.com',
    password: 'your-password'
  },
  company: 'YOUR COMPANY NAME',
  options: {
    headless: false,           // Set to true for headless mode
    rateLimitMs: 500,          // Delay between requests (milliseconds)
    maxRetries: 3,             // Maximum retry attempts
    outputFile: 'output.json', // Output filename
    saveProgress: true         // Save progress after each page
  }
};
```

## Usage

### Basic Usage

Run the scraper with default settings:
```bash
node texas811-production-scraper-hybrid-fixed.js
```

### Output Files

The scraper automatically generates timestamped output files:
- Format: `texas811-all-tickets-YYYY-MM-DD.json`
- Example: `texas811-all-tickets-2025-09-03.json`

### Test Mode

To test on a specific ticket, modify the `TEST_TICKET_ID` variable in the script:
```javascript
const TEST_TICKET_ID = '2574458426';
```

### Production Mode

For full dataset extraction, remove or comment out the test mode filtering logic (lines ~740-760).

## Output Format

The scraper generates a JSON file with the following structure:

```json
{
  "metadata": {
    "scraping_started": "2025-09-03T09:00:00.000Z",
    "company_filter": "BRIGHT STAR SOLUTIONS",
    "total_pages_processed": 3,
    "total_tickets_extracted": 17,
    "scraper_version": "2.0.0-advanced-print-suppression"
  },
  "tickets": [
    {
      "ticket_id": "2574458426",
      "extraction_success": true,
      "created_at": "September 01, 2025, 5:54 PM",
      "status": "Normal",
      "excavator_company": "BRIGHT STAR SOLUTIONS",
      "excavator_address": "PO BOX 667, SOUR LAKE, TX 77659",
      "caller_name": "PRESTON MILLER",
      "county": "MONTGOMERY",
      "city": "NEW CANEY",
      "address": "CROSS PINES DR",
      "work_description": "Power Line Construction",
      "responses": [
        {
          "member_code": "TGC",
          "member_name": "TGC",
          "response_status": "clear",
          "response_date": "September 02, 2025",
          "extraction_method": "pattern_1_based"
        }
      ],
      "response_count": 5
    }
  ]
}
```

## Response Status Classifications

The scraper normalizes utility member responses into three categories:

- **`"clear"`**: Member has provided a clear response
- **`"not_clear"`**: Member response indicates conflict, not clear, or any non-clear status
- **`"no_response"`**: No response detected from member

## Extraction Methods

The scraper uses multiple extraction strategies for maximum reliability:

1. **Table-based Extraction**: Analyzes HTML tables for structured response data
2. **Members Section Parsing**: Extracts member lists from dedicated sections
3. **Response Status Analysis**: Searches for status-specific sections
4. **Pattern Matching**: Uses regex patterns for text-based extraction
5. **Default Assignment**: Ensures every member gets a status classification

## Error Handling

- **Authentication Retries**: Automatic retry on login failures
- **Network Resilience**: Handles network timeouts and connection issues
- **Print Dialog Suppression**: Advanced browser automation prevents print interruptions
- **Progress Recovery**: Can resume from saved progress files

## Performance

- **Processing Speed**: ~500ms per ticket (configurable)
- **Memory Efficient**: Streams data processing for large datasets
- **Browser Optimization**: Disabled unnecessary browser features for speed

## Logging

The scraper provides detailed logging:
- Authentication status
- Pagination detection
- Per-ticket processing status
- Response extraction details
- Error reporting and recovery

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify credentials in CONFIG
   - Check for account lockouts
   - Ensure VPN/network access

2. **Print Dialog Issues**
   - Print suppression is automatically handled
   - No manual intervention required

3. **Data Extraction Issues**
   - Check browser console logs
   - Verify page structure hasn't changed
   - Review extraction method priorities

### Debug Mode

For debugging, set `headless: false` in CONFIG to see browser automation in action.

## File Structure

```
/scrape/
├── texas811-production-scraper-hybrid-fixed.js  # Main scraper
├── texas811-all-tickets-YYYY-MM-DD.json        # Output files
└── README.md                                    # This documentation
```

## Security

- Credentials are stored in the script (consider environment variables for production)
- Browser runs with security restrictions disabled (necessary for automation)
- Output files contain sensitive business data - protect accordingly

## Version History

- **v2.0.0**: Advanced print suppression, comprehensive member response extraction
- **v1.x**: Initial versions with basic scraping capabilities

---

**Important**: This scraper is designed for authorized use only. Ensure compliance with Texas 811 terms of service and applicable regulations.
