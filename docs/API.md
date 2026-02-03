# API Documentation

## Authentication

All API endpoints require authentication via Bearer token. Only admin users can access the API.

### Getting an API Token

1. Log in to the web application as an admin user
2. Go to Settings > API tab
3. Click "Generate API Token"
4. Copy the token (format: `ic_` followed by 32 hex characters)

### Using the Token

Include the token in the `Authorization` header:

```
Authorization: Bearer ic_your_token_here
```

## Base URL

```
/api/v1
```

## Rate Limits

- `/generate` endpoint: 10 requests per minute

## Endpoints

### Get Current User

```
GET /api/v1/me
```

Returns information about the authenticated user.

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "User Name",
  "credits": 150,
  "unlimited_credits": true
}
```

---

### Get Settings

```
GET /api/v1/settings
```

Returns available options for generation parameters.

**Response:**
```json
{
  "genres": ["Fantasy", "Science Fiction", "Romance", ...],
  "aspect_ratios": {
    "2:3": {"width": 1024, "height": 1536, "label": "2:3 (Book Cover)"},
    "1:1": {"width": 1024, "height": 1024, "label": "1:1 (Square)"},
    ...
  },
  "reference_modes": ["both", "background", "text"],
  "text_blending_modes": ["ai_blend", "direct_overlay", "separate_reference"]
}
```

---

### List Style References

```
GET /api/v1/styles
```

Returns all style references owned by the user.

**Response:**
```json
{
  "styles": [
    {
      "id": 1,
      "title": "My Style",
      "image_url": "https://...",
      "feeling": "Dark and moody",
      "layout": "Centered title",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

---

### Get Style Reference

```
GET /api/v1/styles/:id
```

Returns a specific style reference.

**Response:**
```json
{
  "id": 1,
  "title": "My Style",
  "image_url": "https://...",
  "feeling": "Dark and moody",
  "layout": "Centered title",
  "illustration_rules": "Detailed illustrations",
  "typography": "Serif fonts",
  "created_at": "2025-01-15T10:30:00Z"
}
```

**Errors:**
- `404` - Style reference not found

---

### Estimate Generation Cost

```
POST /api/v1/estimate
```

Estimates the credit cost for a generation without actually running it.

**Request Body:**
```json
{
  "use_style_image": false,
  "style_reference_id": null,
  "base_image_only": false,
  "reference_mode": "both",
  "text_blending_mode": "ai_blend",
  "two_step_generation": true
}
```

**Response:**
```json
{
  "total": 25,
  "can_afford": true,
  "breakdown": {
    "base_image": 10,
    "text_overlay": 15
  }
}
```

---

### Generate Book Cover

```
POST /api/v1/generate
```

Generates a book cover. This is a synchronous endpoint that returns when generation is complete.

**Request Body:**
```json
{
  "book_title": "The Great Adventure",
  "author_name": "Jane Smith",
  "description": "An epic tale of...",
  "genres": ["Fantasy", "Adventure"],
  "mood": "Epic & Grand",
  "color_preference": "Dark blues and gold",
  "character_description": "A young warrior with...",
  "keywords": ["sword", "castle", "dragon"],
  "cover_ideas": "A castle on a cliff...",
  "aspect_ratio": "2:3",
  "use_style_image": false,
  "style_reference_id": null,
  "base_image_only": false,
  "reference_mode": "both",
  "text_blending_mode": "ai_blend",
  "two_step_generation": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `book_title` | string | Yes | Title of the book |
| `author_name` | string | Yes | Author's name |
| `description` | string | No | Book description/synopsis |
| `genres` | array | No | List of genres (max 5) |
| `mood` | string | No | Desired mood/atmosphere |
| `color_preference` | string | No | Color preferences |
| `character_description` | string | No | Description of characters to include |
| `keywords` | array | No | Keywords for the cover (max 10) |
| `cover_ideas` | string | No | Specific ideas for the cover |
| `aspect_ratio` | string | No | Default: "2:3". Options from `/settings` |
| `use_style_image` | boolean | No | Use a style reference |
| `style_reference_id` | integer | No | Required if `use_style_image` is true |
| `base_image_only` | boolean | No | Generate only the base image without text |
| `reference_mode` | string | No | "both", "background", or "text" |
| `text_blending_mode` | string | No | "ai_blend", "direct_overlay", or "separate_reference" |
| `two_step_generation` | boolean | No | Default: true. Use two-step generation |

**Response:**
```json
{
  "id": 123,
  "status": "completed",
  "base_image_url": "https://...",
  "final_image_url": "https://...",
  "credits_used": 25,
  "created_at": "2025-01-15T10:30:00Z",
  "completed_at": "2025-01-15T10:31:45Z"
}
```

**Errors:**
- `400` - Missing required fields or invalid parameters
- `402` - Insufficient credits
- `404` - Style reference not found
- `500` - Generation failed

---

### List Generations

```
GET /api/v1/generations
```

Returns paginated list of completed generations.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `per_page` | integer | 20 | Items per page (max 100) |

**Response:**
```json
{
  "generations": [
    {
      "id": 123,
      "book_title": "The Great Adventure",
      "author_name": "Jane Smith",
      "status": "completed",
      "base_image_url": "https://...",
      "final_image_url": "https://...",
      "created_at": "2025-01-15T10:30:00Z",
      "completed_at": "2025-01-15T10:31:45Z"
    }
  ],
  "total": 45,
  "page": 1,
  "per_page": 20,
  "pages": 3
}
```

---

### Get Generation

```
GET /api/v1/generations/:id
```

Returns details of a specific generation.

**Response:**
```json
{
  "id": 123,
  "book_title": "The Great Adventure",
  "author_name": "Jane Smith",
  "description": "An epic tale of...",
  "genres": ["Fantasy", "Adventure"],
  "mood": "Epic & Grand",
  "aspect_ratio": "2:3",
  "status": "completed",
  "base_image_url": "https://...",
  "final_image_url": "https://...",
  "created_at": "2025-01-15T10:30:00Z",
  "completed_at": "2025-01-15T10:31:45Z"
}
```

**Errors:**
- `404` - Generation not found

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message here"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad request (missing/invalid parameters) |
| 401 | Unauthorized (missing or invalid token) |
| 402 | Payment required (insufficient credits) |
| 403 | Forbidden (non-admin user) |
| 404 | Not found |
| 429 | Too many requests (rate limited) |
| 500 | Internal server error |

---

## Example Usage

### cURL

```bash
# Get user info
curl -H "Authorization: Bearer ic_your_token_here" \
  https://your-api.com/api/v1/me

# Generate a cover
curl -X POST \
  -H "Authorization: Bearer ic_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "book_title": "The Great Adventure",
    "author_name": "Jane Smith",
    "genres": ["Fantasy"],
    "mood": "Epic"
  }' \
  https://your-api.com/api/v1/generate
```

### Python

```python
import requests

API_TOKEN = "ic_your_token_here"
BASE_URL = "https://your-api.com/api/v1"

headers = {"Authorization": f"Bearer {API_TOKEN}"}

# Get user info
response = requests.get(f"{BASE_URL}/me", headers=headers)
print(response.json())

# Generate a cover
data = {
    "book_title": "The Great Adventure",
    "author_name": "Jane Smith",
    "genres": ["Fantasy", "Adventure"],
    "mood": "Epic & Grand"
}
response = requests.post(f"{BASE_URL}/generate", headers=headers, json=data)
result = response.json()
print(f"Generated: {result['final_image_url']}")
```

### JavaScript

```javascript
const API_TOKEN = "ic_your_token_here";
const BASE_URL = "https://your-api.com/api/v1";

const headers = {
  "Authorization": `Bearer ${API_TOKEN}`,
  "Content-Type": "application/json"
};

// Get user info
const userResponse = await fetch(`${BASE_URL}/me`, { headers });
const user = await userResponse.json();

// Generate a cover
const generateResponse = await fetch(`${BASE_URL}/generate`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    book_title: "The Great Adventure",
    author_name: "Jane Smith",
    genres: ["Fantasy", "Adventure"],
    mood: "Epic & Grand"
  })
});
const result = await generateResponse.json();
console.log(`Generated: ${result.final_image_url}`);
```
