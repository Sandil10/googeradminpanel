# Load Test & Capacity Analysis

## ✅ Fix Applied

### Problem
The estimated capacity calculation was using **TOTAL memory** instead of **AVAILABLE memory**, making it unrealistic.

**Before (Wrong):**
```javascript
const estimatedMaximumConcurrentUsers = Math.round(
    cpuCores * 220 * (totalMemoryBytes / (1024 ** 3) / 2) * 1.2
);
// With 7.8GB total: ~2,071 users (even though 91.6% is already used!)
```

**After (Fixed):**
```javascript
const estimatedMaximumConcurrentUsers = Math.round(
    cpuCores * 220 * (freeMemoryBytes / (1024 ** 3) / 2) * 1.2
);
// With 0.67GB free: ~150-200 users (realistic!)
```

---

## 🤖 Run Load Test

Test actual concurrent capacity with fake bot users:

```bash
# Basic test: 100 bots for 30 seconds
node load-test.js

# Custom test: 50 bots for 60 seconds, heartbeat every 10s
BASE_URL=http://localhost:6001 \
BOTS=50 \
DURATION=60000 \
INTERVAL=10000 \
node load-test.js
```

### Environment Variables
- `BASE_URL` - Server URL (default: http://localhost:6001)
- `BOTS` - Number of concurrent bots (default: 100)
- `DURATION` - Test duration in ms (default: 30000)
- `INTERVAL` - Heartbeat interval in ms (default: 5000)

---

## 📊 What It Measures

The test creates fake bot users and sends heartbeat requests to measure:

- **Response Times** - Min, avg, max (ms)
- **Success Rate** - % of requests that succeeded
- **Errors** - Network failures, timeouts, HTTP errors
- **Estimated Capacity** - How many concurrent users the server can handle

---

## 📈 Expected Results

### Your Current Setup (2 CPU, 7.8GB RAM, 91.6% memory used)

**Realistic Capacity: 150-300 concurrent users**
- Not 2,071 (the old wrong number)
- Only ~0.67GB free memory available
- Already under stress at 91.6% utilization

---

## 🚀 To Improve Capacity

1. **Increase Free Memory** - Stop background processes or add more RAM
2. **Add CPU Cores** - Horizontal scaling
3. **Move to Split-Services** - Separate app, cache, database (1.2x multiplier boost)
4. **Enable Object Storage** - Move uploads off local disk

---

## ℹ️ Formula Details

```
Estimated Capacity = CPU Cores × 220 × (Free Memory in GB / 2) × Topology Multiplier

Where:
- 220 = concurrent users per CPU core (baseline)
- /2 = conservative memory allocation per user
- Topology Multiplier = 1.0 (single-server) or 1.2 (split-services)
```

Example with your fixed setup:
```
2 × 220 × (0.67 / 2) × 1.2 = 176 concurrent users
```

---

## 🔍 Next Steps

1. Run the load test to see actual capacity
2. Monitor CPU, memory, and disk during the test
3. Identify bottlenecks (CPU, memory, disk, or database)
4. Plan scaling based on results
