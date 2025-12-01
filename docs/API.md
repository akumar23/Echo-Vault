# API Documentation

Base URL: `http://localhost:8000`

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Endpoints

### Auth

#### POST `/auth/register`
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "password123"
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "username",
  "created_at": "2024-01-01T00:00:00Z",
  "is_active": true
}
```

#### POST `/auth/login`
Login and get JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

#### GET `/auth/me`
Get current user info.

**Response:** `200 OK`
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "username",
  "created_at": "2024-01-01T00:00:00Z",
  "is_active": true
}
```

### Entries

#### POST `/entries`
Create a new entry.

**Request:**
```json
{
  "title": "My Entry",
  "content": "Entry content here",
  "tags": ["tag1", "tag2"],
  "mood_user": 4
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "user_id": 1,
  "title": "My Entry",
  "content": "Entry content here",
  "tags": ["tag1", "tag2"],
  "mood_user": 4,
  "mood_inferred": null,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": null
}
```

#### GET `/entries`
List entries.

**Query Parameters:**
- `skip`: int (default: 0)
- `limit`: int (default: 100)

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "user_id": 1,
    "title": "My Entry",
    "content": "Entry content",
    "tags": ["tag1"],
    "mood_user": 4,
    "mood_inferred": 3,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": null
  }
]
```

#### GET `/entries/{entry_id}`
Get a specific entry.

**Response:** `200 OK`
```json
{
  "id": 1,
  "user_id": 1,
  "title": "My Entry",
  "content": "Entry content",
  "tags": ["tag1"],
  "mood_user": 4,
  "mood_inferred": 3,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": null
}
```

#### PUT `/entries/{entry_id}`
Update an entry.

**Request:**
```json
{
  "title": "Updated Title",
  "content": "Updated content",
  "tags": ["newtag"],
  "mood_user": 5
}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "user_id": 1,
  "title": "Updated Title",
  "content": "Updated content",
  "tags": ["newtag"],
  "mood_user": 5,
  "mood_inferred": 3,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T01:00:00Z"
}
```

#### DELETE `/entries/{entry_id}`
Delete an entry (soft delete).

**Response:** `204 No Content`

### Search

#### POST `/search/semantic`
Semantic search with time decay.

**Request:**
```json
{
  "query": "feeling anxious about work",
  "k": 10,
  "date_range": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "tags": ["work", "anxiety"]
}
```

**Response:** `200 OK`
```json
[
  {
    "entry_id": 1,
    "title": "Work Stress",
    "content": "Feeling overwhelmed...",
    "score": 0.85,
    "created_at": "2024-01-15T00:00:00Z"
  }
]
```

### Insights

#### GET `/insights/recent`
Get recent insights.

**Query Parameters:**
- `limit`: int (default: 5)

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "user_id": 1,
    "summary": "This week you focused on...",
    "themes": ["work", "family", "growth"],
    "actions": [
      "Consider taking breaks during work",
      "Spend more time with family"
    ],
    "period_start": "2024-01-01T00:00:00Z",
    "period_end": "2024-01-08T00:00:00Z",
    "created_at": "2024-01-08T00:00:00Z"
  }
]
```

### Settings

#### GET `/settings`
Get user settings.

**Response:** `200 OK`
```json
{
  "id": 1,
  "user_id": 1,
  "search_half_life_days": 30.0,
  "privacy_hard_delete": false
}
```

#### PUT `/settings`
Update settings.

**Request:**
```json
{
  "search_half_life_days": 15.0,
  "privacy_hard_delete": true
}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "user_id": 1,
  "search_half_life_days": 15.0,
  "privacy_hard_delete": true
}
```

### Forget

#### POST `/forget/{entry_id}`
Forget an entry (soft or hard delete based on settings).

**Response:** `204 No Content`

### Export

#### GET `/export/entries`
Export all entries as JSONL.

**Response:** `200 OK`
Content-Type: `application/x-ndjson`

```
{"id":1,"title":"Entry 1","content":"...","embedding":[...]}
{"id":2,"title":"Entry 2","content":"...","embedding":[...]}
```

### WebSocket

#### WS `/ws/reflections/{entry_id}`
Stream reflection for a specific entry.

**Message Format:**
Server sends text messages with reflection tokens as they're generated.

**Example:**
```
This week you've been focusing on...
[continues streaming]
```

## Error Responses

### 400 Bad Request
```json
{
  "detail": "Error message"
}
```

### 401 Unauthorized
```json
{
  "detail": "Invalid authentication credentials"
}
```

### 404 Not Found
```json
{
  "detail": "Entry not found"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error"
}
```

