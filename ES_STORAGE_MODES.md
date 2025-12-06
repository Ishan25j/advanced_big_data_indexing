# Elasticsearch Storage Modes

Configure how data is stored in Elasticsearch using the `ES_STORAGE_MODE` environment variable.

## Configuration

Add to your `.env` file:

```env
ES_STORAGE_MODE=FULL    # or MINIMAL
```

---

## Mode Comparison

### MINIMAL Mode (Reference Format)

**Use when:**
- You want to match the reference implementation exactly
- You need minimal storage overhead
- You only care about searchable fields

**Document Structure:**
```json
{
  "_id": "27283xvx9sdf-507",
  "_routing": "12xvxc345ssdsds-508",
  "_source": {
    "objectId": "27283xvx9sdf-507",
    "objectType": "planservice",
    "_org": "example.com",
    "copay": 175,                    // Direct scalar fields only
    "deductible": 10,
    "plan_join": {
      "name": "linkedPlanServices",
      "parent": "12xvxc345ssdsds-508"
    }
  }
}
```

**Stored Fields:**
- ✅ `objectId`, `objectType`, `_org`
- ✅ Direct scalar fields: `planType`, `creationDate`, `deductible`, `copay`, `name`
- ❌ No nested object references

---

### FULL Mode (Default - Enhanced)

**Use when:**
- You want complete object data in Elasticsearch
- You need to see child references
- You want easier debugging
- You want type-safe document IDs

**Document Structure:**
```json
{
  "_id": "planservice:27283xvx9sdf-507",
  "_routing": "plan:12xvxc345ssdsds-508",
  "_source": {
    "objectId": "27283xvx9sdf-507",
    "objectType": "planservice",
    "_org": "example.com",
    "linkedService": {              // Nested references stored
      "objectId": "1234520xvc30sfs-505",
      "objectType": "service",
      "_org": "example.com"
    },
    "planserviceCostShares": {
      "objectId": "1234512xvc1314sdfsd-506",
      "objectType": "membercostshare",
      "_org": "example.com"
    },
    "plan_join": {
      "name": "linkedPlanServices",
      "parent": "plan:12xvxc345ssdsds-508"
    }
  }
}
```

**Stored Fields:**
- ✅ Complete decomposed object structure
- ✅ All nested object references
- ✅ Type-prefixed document IDs (prevents collisions)
- ✅ Type-prefixed routing

---

## Switching Modes

### 1. Update `.env`

```bash
# For minimal mode (reference format)
ES_STORAGE_MODE=MINIMAL

# For full mode (default)
ES_STORAGE_MODE=FULL
```

### 2. Delete Existing Index

```bash
# In Kibana Dev Tools
DELETE /healthcare_plans
```

### 3. Restart Consumer

```bash
# Stop current consumer (Ctrl+C)
# Start new consumer
node src/consumer.js
```

### 4. Re-index Data

```bash
# Create your plans again via API
POST http://localhost:3000/v1/plan
```

---

## Feature Comparison

| Feature | MINIMAL | FULL |
|---------|---------|------|
| Document ID | `objectId` | `type:objectId` |
| Routing | `parentObjectId` | `type:parentObjectId` |
| Nested References | ❌ Not stored | ✅ Stored |
| Collision Safety | ⚠️ Possible if IDs overlap | ✅ Type-prefixed |
| Storage Size | 🟢 Smaller | 🟡 Larger |
| Debug Info | 🟡 Limited | 🟢 Complete |
| Query Results | Minimal metadata | Full object structure |
| Reference Match | ✅ Exact match | ❌ Enhanced format |

---

## Recommendation

**For Demo/Production:** Use `FULL` mode
- More robust (no ID collisions)
- Better debugging
- Complete data available

**For Reference Compliance:** Use `MINIMAL` mode
- Matches exact reference format
- Smaller storage footprint
- Only essential searchable fields

---

## Example Query Results

**Query:**
```json
POST /healthcare_plans/_search
{
  "query": {
    "has_child": {
      "type": "planserviceCostShares",
      "query": {
        "range": { "copay": { "gte": 1 } }
      }
    }
  }
}
```

### MINIMAL Mode Result:
```json
{
  "_id": "27283xvx9sdf-507",
  "_source": {
    "objectId": "27283xvx9sdf-507",
    "objectType": "planservice",
    "_org": "example.com",
    "plan_join": {
      "name": "linkedPlanServices",
      "parent": "12xvxc345ssdsds-508"
    }
  }
}
```

### FULL Mode Result:
```json
{
  "_id": "planservice:27283xvx9sdf-507",
  "_source": {
    "objectId": "27283xvx9sdf-507",
    "objectType": "planservice",
    "_org": "example.com",
    "linkedService": {
      "objectId": "1234520xvc30sfs-505",
      "objectType": "service"
    },
    "planserviceCostShares": {
      "objectId": "1234512xvc1314sdfsd-506",
      "objectType": "membercostshare"
    },
    "plan_join": {
      "name": "linkedPlanServices",
      "parent": "plan:12xvxc345ssdsds-508"
    }
  }
}
```

Both are **functionally equivalent** for search queries!
